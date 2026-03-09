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
        this.characterMesh = new THREE.Group();

        // Toy chunkier body
        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: COLORS.player,
            roughness: 0.6,
            metalness: 0.1
        });

        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.25;
        body.castShadow = true;
        body.receiveShadow = true;

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xffccaa, // Skin tone
            roughness: 0.7
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.7;
        head.castShadow = true;

        // Cape
        const capeGeo = new THREE.BoxGeometry(0.5, 0.7, 0.1);
        const capeMat = new THREE.MeshStandardMaterial({
            color: 0x1133aa, // Dark blue
            roughness: 0.8
        });
        const cape = new THREE.Mesh(capeGeo, capeMat);
        cape.position.set(0, 0.3, -0.25);
        cape.rotation.x = -0.2;
        cape.castShadow = true;

        this.characterMesh.add(body);
        this.characterMesh.add(head);
        this.characterMesh.add(cape);

        // Ground offset
        this.characterMesh.position.y = 0.1;
        this.group.add(this.characterMesh);
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
        this.crown.position.y = 1.2;
        this.group.add(this.crown);
    }

    update(deltaTime, movementVector) {
        if (movementVector.length() > 0) {
            // Squash and stretch during movement
            const speed = movementVector.length();
            const stretch = 1 + speed * PLAYER_CONFIG.squashStretchFactor;
            const squash = 1 / stretch;
            this.characterMesh.scale.set(squash, stretch, squash);

            // Snap rotation
            const targetRotation = Math.atan2(movementVector.x, movementVector.z);
            this.group.rotation.y = targetRotation;
        } else {
            // Settle scale
            this.characterMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        }

        // Crown float animation
        const time = Date.now() * 0.001;
        this.crown.position.y = 1.1 + Math.sin(time * PLAYER_CONFIG.crownFloatSpeed) * PLAYER_CONFIG.crownFloatHeight;
        this.crown.rotation.z += 0.01;
    }

    get position() {
        return this.group.position;
    }
}
