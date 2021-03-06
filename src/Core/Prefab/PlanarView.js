import * as THREE from 'three';

import View from 'Core/View';
import CameraUtils from 'Utils/CameraUtils';

import PlanarLayer from './Planar/PlanarLayer';

class PlanarView extends View {
    /**
     * @constructor
     * @extends View
     *
     * @example <caption><b>Enable WebGl 1.0 instead of WebGl 2.0.</b></caption>
     * var viewerDiv = document.getElementById('viewerDiv');
     * const extent = new Extent('EPSG:3946', 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);
     * var view = new itowns.GlobeView(viewerDiv, extent, {  renderer: { isWebGL2: false } });
     *
     * @example <caption><b>Instance with placement on the ground.</b></caption>
     * var viewerDiv = document.getElementById('viewerDiv');
     * const extent = new Extent('EPSG:3946', 1837816.94334, 1847692.32501, 5170036.4587, 5178412.82698);
     * var view = new itowns.GlobeView(viewerDiv, extent, { placement: { heading: -49.6, range: 6200, tilt: 17 } });
     *
     * @param {HTMLDivElement} viewerDiv - Where to attach the view and display it
     * in the DOM.
     * @param {Extent} extent - The ground extent.
     * @param {object=} options - See options of {@link View}.
     */
    constructor(viewerDiv, extent, options = {}) {
        THREE.Object3D.DefaultUp.set(0, 0, 1);

        // Setup View
        super(extent.crs, viewerDiv, options);
        this.isPlanarView = true;

        // Configure camera
        const dim = extent.dimensions();
        const max = Math.max(dim.x, dim.y);
        const camera3D = this.camera.camera3D;
        camera3D.near = 0.1;
        camera3D.far = 2 * max;
        this.camera.camera3D.updateProjectionMatrix();

        const tileLayer = new PlanarLayer('planar', extent, options.object3d, options);
        this.mainLoop.gfxEngine.label2dRenderer.infoTileLayer = tileLayer.info;

        this.addLayer(tileLayer);

        const placement = options.placement || {};
        placement.coord = placement.coord || extent.center();
        placement.tilt = placement.tilt || 90;
        placement.heading = placement.heading || 0;
        placement.range = placement.range || max;

        CameraUtils.transformCameraToLookAtTarget(this, camera3D, placement);

        this.tileLayer = tileLayer;
    }

    addLayer(layer) {
        return super.addLayer(layer, this.tileLayer);
    }
}

export default PlanarView;
