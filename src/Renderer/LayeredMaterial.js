import * as THREE from 'three';
import TileVS from 'Renderer/Shader/TileVS.glsl';
import TileFS from 'Renderer/Shader/TileFS.glsl';
import ShaderUtils from 'Renderer/Shader/ShaderUtils';
import Capabilities from 'Core/System/Capabilities';
import RenderMode from 'Renderer/RenderMode';
import MaterialLayer from 'Renderer/MaterialLayer';
import CommonMaterial from 'Renderer/CommonMaterial';

const defaultTex = THREE.Texture();
const fullExtent = new THREE.Vector4(-180, -90, 180, 90);

// from three.js packDepthToRGBA
const UnpackDownscale = 255 / 256; // 0..1 -> fraction (excluding 1)
const bitSh = new THREE.Vector4(
    UnpackDownscale / (256.0 * 256.0 * 256.0),
    UnpackDownscale / (256.0 * 256.0),
    UnpackDownscale / 256.0,
    UnpackDownscale);

export function unpack1K(color, factor) {
    return factor ? bitSh.dot(color) * factor : bitSh.dot(color);
}

// From glsl-proj4
const proj_l93 = {
    lon0: 0.05235987755982989,
    p0: new THREE.Vector3(700000, 6600000, 0),
    k0: 1,
    e: 0.08181919104281582,
    ns: 0.725607765053269,
    af0: 11754255.426096005,
    rh: 6055612.049875989,
};
const proj_wgs84 = {
    a: 6378137,
    b: 6356752.314245179,
    e: 0.08181919084262149,
    eprime: 0.08209443794969568,
    e2: 0.006694379990141283,
    p0: new THREE.Vector3(0, 0, 0),
    k0: 1,
};

// Max sampler color count to LayeredMaterial
// Because there's a statement limitation to unroll, in getColorAtIdUv method
const maxSamplersColorCount = 15;
const samplersElevationCount = 1;

const PI_OVER_4 = 0.25 * Math.PI;
const PI_OVER_360 = Math.PI / 360.0;

export function getMaxColorSamplerUnitsCount() {
    const maxSamplerUnitsCount = Capabilities.getMaxTextureUnitsCount();
    return Math.min(maxSamplerUnitsCount - samplersElevationCount, maxSamplersColorCount);
}

const defaultStructLayer = {
    bias: 0,
    zmin: 0,
    zmax: 0,
    scale: 0,
    mode: 0,
    textureOffset: 0,
    opacity: 0,
    crs: 0,
    effect: 0,
};

function updateLayersUniforms(uniforms, olayers, max) {
    // prepare convenient access to elevation or color uniforms
    const layers = uniforms.layers.value;
    const textures = uniforms.textures.value;
    const extents = uniforms.extents.value;
    const textureCount = uniforms.textureCount;

    // flatten the 2d array [i,j] -> layers[_layerIds[i]].textures[j]
    let count = 0;
    for (const layer of olayers) {
        layer.textureOffset = count;
        for (let i = 0, il = layer.textures.length; i < il; ++i, ++count) {
            const t = layer.textures[i];
            if (count < max && t.extent) {
                let extent = t.extent;
                if (extent.crs == 'TMS:3857') {
                    extent = extent.as('EPSG:4326');
                    extent.south = Math.log(Math.tan(PI_OVER_4 + PI_OVER_360 * extent.south));
                    extent.north = Math.log(Math.tan(PI_OVER_4 + PI_OVER_360 * extent.north));
                } else if (extent.crs == 'TMS:4326') {
                    extent = extent.as('EPSG:4326');
                } else if (extent.crs == 'TMS:3946') {
                    extent = extent.as('EPSG:3946');
                } else {
                    console.warn(extent.crs, ' extents are not handled yet');
                }

                extents[count].set(extent.west, extent.south, extent.east, extent.north);
                textures[count] = t;
                layers[count] = layer;
            }
        }
    }
    if (count > max) {
        console.warn(`LayeredMaterial: Not enough texture units (${max} < ${count}), excess textures have been discarded.`);
    }
    textureCount.value = count;

    // WebGL 2.0 doesn't support the undefined uniforms.
    // So the undefined uniforms are defined by default value.
    for (let i = count; i < textures.length; i++) {
        textures[i] = defaultTex;
        extents[i] = fullExtent;
        layers[i] = defaultStructLayer;
    }
}

export const ELEVATION_MODES = {
    RGBA: 0,
    COLOR: 1,
    DATA: 2,
};

let nbSamplers;
const fragmentShader = [];
class LayeredMaterial extends THREE.RawShaderMaterial {
    constructor(options = {}, crsCount) {
        super(options);

        crsCount = 3; // WGS84, PM, L93 // TODO !!!

        nbSamplers = nbSamplers || [samplersElevationCount, getMaxColorSamplerUnitsCount()];

        this.defines.NUM_VS_TEXTURES = nbSamplers[0];
        this.defines.NUM_FS_TEXTURES = nbSamplers[1];
        this.defines.USE_FOG = 1;
        this.defines.NUM_CRS = crsCount;

        CommonMaterial.setDefineMapping(this, 'ELEVATION', ELEVATION_MODES);
        CommonMaterial.setDefineMapping(this, 'MODE', RenderMode.MODES);
        CommonMaterial.setDefineProperty(this, 'mode', 'MODE', RenderMode.MODES.FINAL);

        if (__DEBUG__) {
            this.defines.DEBUG = 1;
            const outlineColors = [];
            for (let i = 0; i < this.defines.NUM_CRS; ++i) {
                outlineColors.push(new THREE.Vector3(1.0, i / (crsCount - 1.0), 0.0));
            }
            CommonMaterial.setUniformProperty(this, 'showOutline', true);
            CommonMaterial.setUniformProperty(this, 'outlineWidth', 0.008);
            CommonMaterial.setUniformProperty(this, 'outlineColors', outlineColors);
        }

        if (Capabilities.isLogDepthBufferSupported()) {
            this.defines.USE_LOGDEPTHBUF = 1;
            this.defines.USE_LOGDEPTHBUF_EXT = 1;
        }

        this.vertexShader = TileVS;
        fragmentShader[crsCount] = fragmentShader[crsCount] || ShaderUtils.unrollLoops(TileFS, this.defines);
        this.fragmentShader = fragmentShader[crsCount];

        // Color uniforms
        CommonMaterial.setUniformProperty(this, 'diffuse', new THREE.Color(0.04, 0.23, 0.35));
        CommonMaterial.setUniformProperty(this, 'opacity', this.opacity);
        CommonMaterial.setUniformProperty(this, 'skirtHeight', 0.0);

        // Lighting uniforms
        CommonMaterial.setUniformProperty(this, 'lightingEnabled', false);
        CommonMaterial.setUniformProperty(this, 'lightPosition', new THREE.Vector3(-0.5, 0.0, 1.0));

        // Misc properties
        CommonMaterial.setUniformProperty(this, 'fogDistance', 1000000000.0);
        CommonMaterial.setUniformProperty(this, 'fogColor', new THREE.Color(0.76, 0.85, 1.0));
        CommonMaterial.setUniformProperty(this, 'overlayAlpha', 0);
        CommonMaterial.setUniformProperty(this, 'overlayColor', new THREE.Color(1.0, 0.3, 0.0));
        CommonMaterial.setUniformProperty(this, 'objectId', 0);
        CommonMaterial.setUniformProperty(this, 'extent', fullExtent.clone());

        // > 0 produces gaps,
        // < 0 causes oversampling of textures
        // = 0 causes sampling artefacts due to bad estimation of texture-uv gradients
        // best is a small negative number
        CommonMaterial.setUniformProperty(this, 'minBorderDistance', -0.01);

        // LayeredMaterialLayers
        this.layers = [];
        this.elevationLayerIds = [];
        this.colorLayerIds = [];

        // elevation layer uniforms, to be updated using updateUniforms()
        this.uniforms.elevationLayers = new THREE.Uniform(new Array(nbSamplers[0]).fill(defaultStructLayer));
        this.uniforms.elevationTextures = new THREE.Uniform(new Array(nbSamplers[0]).fill(defaultTex));
        this.uniforms.elevationExtents = new THREE.Uniform(new Array(nbSamplers[0]).fill(null));
        this.uniforms.elevationTextureCount = new THREE.Uniform(0);

        // color layer uniforms, to be updated using updateUniforms()
        this.uniforms.colorLayers = new THREE.Uniform(new Array(nbSamplers[1]).fill(defaultStructLayer));
        this.uniforms.colorTextures = new THREE.Uniform(new Array(nbSamplers[1]).fill(defaultTex));
        this.uniforms.colorExtents = new THREE.Uniform(new Array(nbSamplers[1]).fill(null));
        this.uniforms.colorTextureCount = new THREE.Uniform(0);

        for (let i = 0; i < nbSamplers[0]; ++i) {
            this.uniforms.elevationExtents.value[i] = fullExtent.clone();
        }
        for (let i = 0; i < nbSamplers[1]; ++i) {
            this.uniforms.colorExtents.value[i] = fullExtent.clone();
        }

        this.uniforms.proj_geocent = new THREE.Uniform([proj_wgs84]);
        this.uniforms.proj_lcc = new THREE.Uniform([proj_l93]);

        let _visible = this.visible;
        // can't do an ES6 setter/getter here
        Object.defineProperty(this, 'visible', {
            get() { return _visible; },
            set(v) {
                if (_visible != v) {
                    _visible = v;
                    this.dispatchEvent({ type: v ? 'shown' : 'hidden' });
                }
            },
        });
    }

    onBeforeCompile(shader, renderer) {
        if (renderer.capabilities.isWebGL2) {
            this.defines.WEBGL2 = true;
            shader.glslVersion = '300 es';
        }
    }

    getUniformByType(type) {
        return {
            layers: this.uniforms[`${type}Layers`],
            textures: this.uniforms[`${type}Textures`],
            extents: this.uniforms[`${type}Extents`],
            textureCount: this.uniforms[`${type}TextureCount`],
        };
    }

    updateLayersUniforms() {
        const colorlayers = this.layers.filter(l => this.colorLayerIds.includes(l.id) && l.visible && l.opacity > 0);
        colorlayers.sort((a, b) => this.colorLayerIds.indexOf(a.id) - this.colorLayerIds.indexOf(b.id));
        updateLayersUniforms(this.getUniformByType('color'), colorlayers, this.defines.NUM_FS_TEXTURES);

        // if (this.elevationLayerIds.some(id => this.getLayer(id)) ||
        //    (this.uniforms.elevationTextureCount.value && !this.elevationLayerIds.length)) {
        const elevationLayer = this.getElevationLayer() ? [this.getElevationLayer()] : [];
        updateLayersUniforms(this.getUniformByType('elevation'), elevationLayer, this.defines.NUM_VS_TEXTURES);
        // }
        this.layersNeedUpdate = false;
    }

    dispose() {
        this.dispatchEvent({ type: 'dispose' });
        this.layers.forEach(l => l.dispose(true));
        this.layers.length = 0;
        this.layersNeedUpdate = true;
    }

    // TODO: rename to setColorLayerIds and add setElevationLayerIds ?
    setSequence(sequenceLayer) {
        this.colorLayerIds = sequenceLayer;
        this.layersNeedUpdate = true;
    }

    setSequenceElevation(layerId) {
        this.elevationLayerIds[0] = layerId;
        this.layersNeedUpdate = true;
    }

    removeLayer(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index > -1) {
            this.layers[index].dispose();
            this.layers.splice(index, 1);
            const idSeq = this.colorLayerIds.indexOf(layerId);
            if (idSeq > -1) {
                this.colorLayerIds.splice(idSeq, 1);
            } else {
                this.elevationLayerIds = [];
            }
        }
    }

    addLayer(layer) {
        if (layer.id in this.layers) {
            console.warn('The "{layer.id}" layer was already present in the material, overwritting.');
        }
        const lml = new MaterialLayer(this, layer);
        this.layers.push(lml);
        if (layer.isColorLayer) {
            this.setSequence(layer.parent.colorLayersOrder);
        } else {
            this.setSequenceElevation(layer.id);
        }
        return lml;
    }

    getLayer(id) {
        return this.layers.find(l => l.id === id);
    }

    getLayers(ids) {
        return this.layers.filter(l => ids.includes(l.id));
    }

    getElevationLayer() {
        return this.layers.find(l => l.id === this.elevationLayerIds[0]);
    }

    setElevationScale(scale) {
        if (this.elevationLayerIds.length) {
            this.getElevationLayer().scale = scale;
        }
    }
}

export default LayeredMaterial;
