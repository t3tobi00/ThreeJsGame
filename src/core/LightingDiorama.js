import * as THREE from 'three';
import { COLORS } from '../config/gameConfig.js';

// LightingDiorama — variant of Lighting.js with the same sun + shadow setup,
// PLUS four soft tinted point lights anchored at each corner of the map.
// The tints are very gentle (low intensity, large range) — they're not "real"
// light, they're a fake colored bounce that makes each biome read as its own
// place when you walk into it. The sun stays as the dominant key light so
// shadow direction and overall exposure are unchanged from legacy.

export class LightingDiorama {
    constructor(scene) {
        this.scene = scene;

        // --- Sun (identical to legacy Lighting.js) ---
        this.hemiLight = new THREE.HemisphereLight(0xffffff, COLORS.dangerZone, 0.7);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(COLORS.sun, 1.4);
        this.sunLight.position.set(10, 20, -5);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        const d = 25;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 100;
        this.sunLight.shadow.bias = -0.001;
        this.sunLight.shadow.normalBias = 0;
        this.scene.add(this.sunLight);

        // --- Corner tints (4 fake bounce lights) ---
        // Each light sits low at the corner center, with a generous range and
        // low intensity so it tints nearby props without blowing out the sun.
        // No shadows — they're cosmetic only.
        const tints = [
            { name: 'nw-jungle',   x: -22, z: -22, color: 0x66ff88, intensity: 0.55 }, // cool green
            { name: 'ne-business', x:  22, z: -22, color: 0xff7fbf, intensity: 0.7  }, // neon pink
            { name: 'se-factory',  x:  22, z:  22, color: 0xffcc44, intensity: 0.55 }, // sodium yellow
            { name: 'sw-combat',   x: -22, z:  22, color: 0xff3344, intensity: 0.75 }  // hive red
        ];
        this.cornerLights = [];
        for (const t of tints) {
            const light = new THREE.PointLight(t.color, t.intensity, 28, 1.6);
            light.position.set(t.x, 4, t.z);
            light.name = `diorama-corner-${t.name}`;
            this.scene.add(light);
            this.cornerLights.push(light);
        }
    }
}
