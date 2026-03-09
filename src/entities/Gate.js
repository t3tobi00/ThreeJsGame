import * as THREE from 'three';

export class Gate {
    constructor(scene, position, width = 1.5) {
        this.scene = scene;
        this.position = position;
        this.width = width;
        this.isOpen = false;
        this.openRatio = 0; // 0 is closed, 1 is open

        this.container = new THREE.Group();
        this.container.position.copy(position);

        this.createVisuals();
        this.scene.add(this.container);
    }

    createVisuals() {
        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

        // Two posts
        const postLeft = new THREE.Mesh(postGeo, postMat);
        postLeft.position.set(-this.width / 2, 0.4, 0);
        postLeft.castShadow = true;
        this.container.add(postLeft);

        const postRight = new THREE.Mesh(postGeo, postMat);
        postRight.position.set(this.width / 2, 0.4, 0);
        postRight.castShadow = true;
        this.container.add(postRight);

        // The door (a single bar that rotates)
        const doorGeo = new THREE.BoxGeometry(this.width, 0.15, 0.08);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0xac7339 });

        this.door = new THREE.Mesh(doorGeo, doorMat);
        // Pivot point at the left post
        this.doorGroup = new THREE.Group();
        this.doorGroup.position.set(-this.width / 2, 0.5, 0);
        this.door.position.set(this.width / 2, 0, 0);

        this.doorGroup.add(this.door);
        this.container.add(this.doorGroup);

        // Add some vertical planks to the door for a "fence" look
        const plankGeo = new THREE.BoxGeometry(0.1, 0.4, 0.05);
        for (let i = 0; i < 3; i++) {
            const plank = new THREE.Mesh(plankGeo, doorMat);
            plank.position.set((i * (this.width / 2)) - (this.width / 2) + 0.1, -0.1, 0.05);
            this.door.add(plank);
        }
    }

    update(deltaTime, playerPosition) {
        const dist = this.container.position.distanceTo(playerPosition);
        const targetOpen = dist < 4.0 ? 1 : 0;

        // Linear interpolation with a bit of "bouncy" feel logic
        const speed = 8.0;
        this.openRatio = THREE.MathUtils.lerp(this.openRatio, targetOpen, deltaTime * speed);

        // Swing the door open 90 degrees (Math.PI / 2)
        this.doorGroup.rotation.y = this.openRatio * (Math.PI / 2);

        // Bouncy scale feedback when hitting limits
        const scaleVal = 1.0 + Math.sin(this.openRatio * Math.PI) * 0.1;
        this.doorGroup.scale.set(1, scaleVal, 1);
    }
}
