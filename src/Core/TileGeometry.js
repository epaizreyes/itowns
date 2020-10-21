import * as THREE from 'three';
import computeBuffers from 'Core/Prefab/computeBufferTileGeometry';

function defaultBuffers(params) {
    params.buildIndex = true;
    params.center = params.builder.center(params.extent).clone();
    const buffers = computeBuffers(params);
    buffers.index = new THREE.BufferAttribute(buffers.index, 1);
    buffers.position = new THREE.BufferAttribute(buffers.position, 3);
    buffers.normal = new THREE.BufferAttribute(buffers.normal, 3);
    buffers.wgs84 = new THREE.BufferAttribute(buffers.wgs84, 2);
    buffers.l93 = new THREE.BufferAttribute(buffers.l93, 2);
    return buffers;
}

class TileGeometry extends THREE.BufferGeometry {
    constructor(params, buffers = defaultBuffers(params)) {
        super();
        this.center = params.center;
        this.extent = params.extent;

        this.setIndex(buffers.index);
        this.setAttribute('position', buffers.position);
        this.setAttribute('normal', buffers.normal);
        this.setAttribute('wgs84', buffers.wgs84);
        this.setAttribute('l93', buffers.l93);

        this.computeBoundingBox();
        this.OBB = {};
    }
}

export default TileGeometry;
