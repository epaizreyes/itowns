/**
* Class: BuildingTile
* Description: Tile containing a set of 3D buildings
*/


import defaultValue from 'Core/defaultValue';
import BoundingBox from 'Scene/BoundingBox';
import NodeMesh from 'Renderer/NodeMesh';
import BasicMaterial from 'Renderer/BasicMaterial';
import THREE from 'THREE';

function BuildingTile(params) {
    //Constructor
    NodeMesh.call(this);
    this.bboxId = params.id;
    this.bbox = new BoundingBox(params.bbox[0], params.bbox[3],
        params.bbox[1], params.bbox[4],
        params.bbox[2], params.bbox[5]);
    this.box3D = new THREE.Box3(new THREE.Vector3(params.bbox[0], params.bbox[1], params.bbox[2]),
        new THREE.Vector3(params.bbox[3], params.bbox[4], params.bbox[5]));
    this.level = params.level;
    this.childrenBboxes = params.childrenBboxes;
    this.geometricError = ((params.bbox[3] - params.bbox[0]) +
        (params.bbox[4] - params.bbox[1])) / 100;
    // TODO: geometric error doesn't really make sense in our case

    this.geometry = params.geometry;
    this.centerSphere = this.geometry.boundingSphere.center;

    this.material = new BasicMaterial(new THREE.Color(0.8, 0.8, 0.8));
}

BuildingTile.prototype = Object.create(NodeMesh.prototype);

BuildingTile.prototype.constructor = BuildingTile;

BuildingTile.prototype.dispose = function() {
    // TODO à mettre dans node mesh
    this.material.dispose();
    this.geometry.dispose();
    this.geometry = null;
    this.material = null;
};

BuildingTile.prototype.disposeChildren = function() {
    while (this.children.length > 0) {
        var child = this.children[0];
        this.remove(child);
        child.dispose();
    }
};

BuildingTile.prototype.enableRTC = function(enable) {
    this.material.enableRTC(enable);
};

BuildingTile.prototype.enablePickingRender = function(enable) {
    //this.material.enablePickingRender(enable);
};

BuildingTile.prototype.setFog = function(fog) {
    this.material.setFogDistance(fog);
};

BuildingTile.prototype.setMatrixRTC = function(rtc) {
    this.material.setMatrixRTC(rtc);
};

BuildingTile.prototype.setDebug = function(enable) {
    this.material.setDebug(enable);
};

BuildingTile.prototype.setSelected = function(select) {
    this.material.setSelected(select);
};

export default BuildingTile;
