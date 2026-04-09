import * as THREE from 'three';

// SceneDiorama — variant of Scene.js that swaps the sky/fog for the diorama
// look (warmer dusk gradient + thicker fog so the four corners feel framed
// against a stage backdrop rather than a flat blue sky).
//
// Mirrors the Scene API exactly so main.js can swap it in via SceneMode.

export class SceneDiorama {
    constructor() {
        this.threeScene = new THREE.Scene();

        // Slightly desaturated dusk-blue — pushes the saturated corner pads
        // and neon landmarks forward instead of competing with them.
        const skyColor = new THREE.Color(0x6c8ec4);
        this.threeScene.background = skyColor;

        // Thicker exponential fog to soften the rim and hide hard edges of
        // the corner pads. Same fog type as the legacy scene so anything
        // that reads .fog (e.g. shaders) keeps working unchanged.
        this.threeScene.fog = new THREE.FogExp2(0x6c8ec4, 0.018);
    }

    add(object) {
        this.threeScene.add(object);
    }

    get instance() {
        return this.threeScene;
    }
}
