import * as THREE from 'three';

export class Scene {
    constructor() {
        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.threeScene.fog = new THREE.FogExp2(0x87ceeb, 0.01);
    }

    add(object) {
        this.threeScene.add(object);
    }

    get instance() {
        return this.threeScene;
    }
}
