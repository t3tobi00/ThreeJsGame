import * as THREE from 'three';
import { COLORS, PLAYER_CONFIG } from '../config/gameConfig.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.createBody();
        this.createCrown();
        this.createHighlight();

        this.velocity = new THREE.Vector3();
    }

    createBody() {
        const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.6, 4, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: COLORS.player,
            roughness: 0.4,
            metalness: 0.3
        });

        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.6; // Base at 0
        this.body.castShadow = true;
        this.group.add(this.body);
    }

    createHighlight() {
        // Glowing cyan ring under player
        const ringGeo = new THREE.RingGeometry(0.5, 0.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        this.highlight = new THREE.Mesh(ringGeo, ringMat);
        this.highlight.rotation.x = -Math.PI / 2;
        this.highlight.position.y = 0.05;
        this.group.add(this.highlight);
    }

    createCrown() {
        // Floating golden crown
        const crownGeo = new THREE.TorusGeometry(0.25, 0.05, 8, 24);
        const crownMat = new THREE.MeshStandardMaterial({
            color: COLORS.crown,
            emissive: COLORS.crown,
            emissiveIntensity: 0.5,
            metalness: 0.9,
            roughness: 0.1
        });

        this.crown = new THREE.Mesh(crownGeo, crownMat);
        this.crown.rotation.x = Math.PI / 2;
        this.crown.position.y = 1.4;
        this.group.add(this.crown);
    }

    update(deltaTime, movementVector) {
        if (movementVector.length() > 0) {
            // Squash and stretch during movement
            const speed = movementVector.length();
            const stretch = 1 + speed * PLAYER_CONFIG.squashStretchFactor;
            const squash = 1 / stretch;
            this.body.scale.set(squash, stretch, squash);

            // Snap rotation
            const targetRotation = Math.atan2(movementVector.x, movementVector.z);
            this.group.rotation.y = targetRotation;
        } else {
            // Settle scale
            this.body.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        }

        // Crown float animation
        const time = Date.now() * 0.001;
        this.crown.position.y = 1.4 + Math.sin(time * PLAYER_CONFIG.crownFloatSpeed) * PLAYER_CONFIG.crownFloatHeight;
        this.crown.rotation.z += 0.01;
    }

    get position() {
        return this.group.position;
    }
}
