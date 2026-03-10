import * as THREE from 'three';

/**
 * Component_Transform — Connects an ECS entity to a visual Three.js object.
 */
export class Component_Transform {
    /**
     * @param {THREE.Object3D} meshOrGroup The actual Three.js object in the scene.
     */
    constructor(meshOrGroup) {
        this.mesh = meshOrGroup;
        this.position = meshOrGroup.position;
        this.rotation = meshOrGroup.rotation;
        this.scale = meshOrGroup.scale;
    }
}
