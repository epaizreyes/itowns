/* global page, itowns, view, TimeoutError, initialPosition */
// eslint-disable-next-line import/no-extraneous-dependencies
const puppeteer = require('puppeteer');
// const { TimeoutError } = require('puppeteer/Errors');
const net = require('net');
const fs = require('fs');
const http = require('http');
// this line allows to disable a warning generated by node when more than 10
// listeners are added for a particular event (this default warning helps
// finding memory leaks). In our case, the listener to blame is
// 'page.on('pageerror', (e) => { pageErrors.push(e); });' in loadExample()
// allowing to trap errors from the console when a page is loaded: one
// listener is added for every example test but this is intentional and it
// is not related to a memory leak so we disable this warning.
// More info: https://nodejs.org/docs/latest/api/events.html#events_emitter_setmaxlisteners_n
require('events').EventEmitter.prototype._maxListeners = 100;

let itownsServer;
let itownsPort;
let browser;
// We could run 'npm start' to serve itowns for the tests,
// but it's slow to start (so tests might fail on timeouts).
// Since the 'test-examples' target depends on the 'run' target,
// we instead run the simplest http server.
function startStaticFileServer() {
    return new Promise((resolve) => {
        const ext2mime = new Map();
        ext2mime.set('html', 'text/html');
        ext2mime.set('js', 'text/javascript');
        ext2mime.set('css', 'text/css');
        ext2mime.set('json', 'application/json');

        itownsServer = http.createServer((req, res) => {
            const file = `./${req.url}`;
            fs.readFile(file, (err, data) => {
                if (err) {
                    res.writeHead(500);
                } else {
                    const extension = file.substr(file.lastIndexOf('.') + 1);
                    if (ext2mime.has(extension)) {
                        res.writeHead(200, { 'Content-Type': ext2mime.get(extension) });
                    }
                    res.end(data);
                }
            });
        });

        itownsServer.listen(0, () => {
            resolve(itownsServer.address().port);
        });
    });
}

function _waitServerReady(port, resolve) {
    const client = net.createConnection({ port }, () => {
        resolve(port);
    });
    client.on('error', () => {
        setTimeout(() => {
            _waitServerReady(port, resolve);
        }, 100);
    });
}

async function saveScreenshot(page, screenshotName) {
    if (process.env.SCREENSHOT_FOLDER && screenshotName) {
        const sanitized = screenshotName.replace(/[^\w_]/g, '_');
        const file = `${process.env.SCREENSHOT_FOLDER}/${sanitized}.png`;
        await page.screenshot({ path: file });
        // eslint-disable-next-line
        console.log('Wrote ', file);
    }
}

function waitServerReady(port) {
    return new Promise((resolve) => {
        _waitServerReady(port, resolve);
    });
}

const layersAreInitialized = async () => {
    await page.waitFor(() => view.mainLoop.scheduler.commandsWaitingExecutionCount() === 0
        && view.mainLoop.renderingState === 0
        && view.getLayers().every(layer => layer.ready), { timeout: 60000 });
};

const waitNextRender = async page => page.evaluate(() => new Promise((resolve) => {
    function resolveWhenDrawn() {
        view.removeFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, resolveWhenDrawn);

        // make sure the loading screen is hidden
        const container = document.getElementById('itowns-loader');
        if (container) {
            container.style.display = 'none';
        }
        const divScaleWidget = document.querySelectorAll('.divScaleWidget');
        if (divScaleWidget && divScaleWidget.length) {
            divScaleWidget[0].style.display = 'none';
        }

        resolve();
    }
    view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.AFTER_RENDER, resolveWhenDrawn);
    view.notifyChange();
}));

// Helper function: returns true if there are no errors on the page
// and when all layers are ready and rendering has been done
const loadExample = async (url, screenshotName) => {
    url = `http://localhost:${itownsPort}/${url}`;

    const pageErrors = [];
    page.on('pageerror', (e) => { pageErrors.push(e); });

    await page.goto(url);

    pageErrors.forEach((e) => { throw e; });

    await page.waitFor(() => typeof (view) === 'object');

    await page.evaluate(() => {
        itowns.CameraUtils.defaultStopPlaceOnGroundAtEnd = true;
    });

    try {
        await layersAreInitialized();
    } catch (e) {
        if (e instanceof TimeoutError) {
            await page.evaluate(() => {
                itowns.CameraUtils.stop(view, view.camera.camera3D);
            });
            await layersAreInitialized();
        }
    }

    await waitNextRender(page);

    await saveScreenshot(page, screenshotName);

    return true;
};

// Use waitUntilItownsIsIdle to wait until itowns has finished all its work (= layer updates)
const waitUntilItownsIsIdle = async (screenshotName) => {
    const result = await page.evaluate(() => new Promise((resolve) => {
        function resolveWhenReady() {
            if (view.mainLoop.renderingState === 0) {
                view.mainLoop.removeEventListener('command-queue-empty', resolveWhenReady);
                itowns.CameraUtils.stop(view, view.camera.camera3D);
                resolve(true);
            }
        }
        view.mainLoop.addEventListener('command-queue-empty', resolveWhenReady);
    }));

    await waitNextRender(page);

    await saveScreenshot(page, screenshotName);

    return result;
};

exports.mochaHooks = {
    beforeAll: async () => {
        let server;
        if (!process.env.USE_DEV_SERVER) {
            server = startStaticFileServer();
        } else {
            server = waitServerReady(process.env.USE_DEV_SERVER);
        }

        // wait for the server to be ready
        itownsPort = await server;

        // global variable stored for resetting the page state
        global.initialPosition = {};

        // For now the '--no-sandbox' flag is needed. Otherwise Chrome fails to start:
        //
        // FATAL:zygote_host_impl_linux.cc(124)] No usable sandbox! Update your kernel
        // or see
        // https://chromium.googlesource.com/chromium/src/+/master/docs/linux_suid_sandbox_development.md
        // for more information on developing with the SUID sandbox.
        // If you want to live dangerously and need an immediate workaround, you can try
        // using --no-sandbox.
        const args = [];

        if (process.env.HTTPS_PROXY) {
            args.push(`--proxy-server=${process.env.HTTPS_PROXY}`);
        }

        if (process.env.REMOTE_DEBUGGING) {
            args.push(`--remote-debugging-port=${process.env.REMOTE_DEBUGGING}`);
        }

        browser = await puppeteer.launch({
            executablePath: process.env.CHROME,
            headless: !process.env.DEBUG,
            devtools: !!process.env.DEBUG,
            defaultViewport: { width: 400, height: 300 },
            args,
        });

        // the page all tests will be tested in
        return browser.newPage().then((p) => { global.page = p; });
    },
    // store initial position for restoration after the test
    afterAll(done) {
        browser.close();
        if (itownsServer) {
            // stop server
            itownsServer.close(done);
        } else {
            done();
        }
    },
    beforeEach: async () => {
        global.initialPosition = await page.evaluate(() => {
            if (view.isGlobeView && view.controls) {
                return Promise.resolve(itowns.CameraUtils.getTransformCameraLookingAtTarget(view, view.controls.camera));
            } else if (view.isPlanarView) {
                // TODO: make the controls accessible from PlanarView before doing
                // anything more here
                return Promise.resolve();
            }
        });
    },
    // reset browser state instead of closing it
    afterEach: async () => {
        await page.evaluate((init) => {
            if (view.isGlobeView && view.controls) {
                // eslint-disable-next-line no-param-reassign
                init.coord = new itowns.Coordinates(
                    init.coord.crs,
                    init.coord.x,
                    init.coord.y,
                    init.coord.z,
                );
                view.controls.lookAtCoordinate(init, false);
                view.notifyChange();
            } else if (view.isPlanarView) {
                // TODO: make the controls accessible from PlanarView before doing
                // anything more here
            }
        }, initialPosition);

        await page.mouse.move(0, 0);
    },
};

global.loadExample = loadExample;
global.waitUntilItownsIsIdle = waitUntilItownsIsIdle;


