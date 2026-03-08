import * as THREE from 'three';

export class Renderer {
    constructor() {
        this.threeRenderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });

        this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
        this.threeRenderer.shadowMap.enabled = true;
        this.threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.threeRenderer.outputColorSpace = THREE.SRGBColorSpace;

        document.body.appendChild(this.threeRenderer.domElement);

        window.addEventListener('resize', this.onResize.bind(this));
    }

    onResize() {
        this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
    }

    get domElement() {
        return this.threeRenderer.domElement;
    }

    render(scene, camera) {
        this.threeRenderer.render(scene, camera);
    }
}
