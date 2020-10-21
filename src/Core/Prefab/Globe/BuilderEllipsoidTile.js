import * as THREE from 'three';
import Coordinates from 'Core/Geographic/Coordinates';

const axisY = new THREE.Vector3(0, 1, 0);
const quatToAlignLatitude = new THREE.Quaternion();
const quatNormalToZ = new THREE.Quaternion();

class BuilderEllipsoidTile {
    constructor(options = {}) {
        this.tmp = {
            coords: [
                new Coordinates('EPSG:4326', 0, 0),
                new Coordinates('EPSG:4326', 0, 0)],
            position: new THREE.Vector3(),
            dimension: new THREE.Vector2(),
        };

        this.crs = options.crs;
        // Order crs projection on tiles
        this.uvCount = options.uvCount;
    }
    // prepare params
    // init projected object -> params.projected
    prepare(params) {
        params.nbRow = 2 ** (params.level + 1.0);

        // transformation to align tile's normal to z axis
        params.quatNormalToZ = quatNormalToZ.setFromAxisAngle(
            axisY,
            -(Math.PI * 0.5 - THREE.MathUtils.degToRad(params.extent.center().latitude)));

        // let's avoid building too much temp objects
        params.projected = { longitude: 0, latitude: 0 };
        params.extent.dimensions(this.tmp.dimension);
    }

    // get center tile in cartesian 3D
    center(extent) {
        return extent.center(this.tmp.coords[0])
            .as(this.crs, this.tmp.coords[1]).toVector3();
    }

    // get position 3D cartesian
    vertexPosition(params) {
        this.tmp.coords[0].setFromValues(
            params.projected.longitude,
            params.projected.latitude);

        this.tmp.coords[0].as(this.crs, this.tmp.coords[1]).toVector3(this.tmp.position);
        return this.tmp.position;
    }

    // get normal for last vertex
    vertexNormal() {
        return this.tmp.coords[1].geodesicNormal;
    }

    // coord u tile to projected
    uProjecte(u, params) {
        params.projected.longitude = params.extent.west + u * this.tmp.dimension.x;
    }

    // coord v tile to projected
    vProjecte(v, params) {
        params.projected.latitude = params.extent.south + v * this.tmp.dimension.y;
    }

    computeSharableExtent(extent) {
        // Compute sharable extent to pool the geometries
        // the geometry in common extent is identical to the existing input
        // with a transformation (translation, rotation)

        // compute rotation to transform tile to position it on ellipsoid
        // this transformation take into account the transformation of the parents
        const rotLat = THREE.MathUtils.degToRad(90 - extent.center(this.tmp.coords[0]).latitude);
        quatToAlignLatitude.setFromAxisAngle(axisY, rotLat);

        return {
            sharableExtent: extent,
            quaternion: quatToAlignLatitude.clone(),
            position: this.center(extent),
        };
    }
}

export default BuilderEllipsoidTile;
