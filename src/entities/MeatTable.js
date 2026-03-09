import * as THREE from 'three';
import { SELLING_CONFIG, COLORS_P2 } from '../config/gameConfig.js';

export class MeatTable {
    constructor(scene, tablePosition) {
        this.scene = scene;
        this.tablePosition = tablePosition;
        this.meatOnTable = [];
        this.maxCapacity = SELLING_CONFIG.tableCapacity;

        // In-transit meat (flying animations)
        this.inTransitMeat = [];
    }

    addMeatToTable(meatMesh) {
        if (this.meatOnTable.length >= this.maxCapacity) {
            return false; // Table is full
        }

        // Position meat on table
        const slotIndex = this.meatOnTable.length;
        const slotX = (slotIndex % 3) * 0.5 - 0.5; // Spread across table width
        const slotZ = Math.floor(slotIndex / 3) * 0.4 - 0.2; // Spread across table depth

        meatMesh.position.set(
            this.tablePosition.x + slotX,
            this.tablePosition.y + 0.5,
            this.tablePosition.z + slotZ
        );

        meatMesh.rotation.set(0, 0, 0);
        this.scene.add(meatMesh);
        this.meatOnTable.push(meatMesh);

        return true;
    }

    removeMeatFromTable(count) {
        const removed = [];

        for (let i = 0; i < count && this.meatOnTable.length > 0; i++) {
            const meat = this.meatOnTable.pop();
            this.scene.remove(meat);
            meat.geometry.dispose();
            meat.material.dispose();
            removed.push(meat);
        }

        return removed;
    }

    getMeatCount() {
        return this.meatOnTable.length;
    }

    update(deltaTime) {
        // Update in-transit meat animations
        this.inTransitMeat = this.inTransitMeat.filter(transit => {
            transit.time += deltaTime;
            const progress = transit.time / transit.duration;

            if (progress >= 1) {
                // Arrived at table
                const added = this.addMeatToTable(transit.mesh);
                if (!added) {
                    // Table full, just remove
                    transit.mesh.geometry.dispose();
                    transit.mesh.material.dispose();
                }
                return false; // Remove from in-transit list
            }

            // Animate along bezier curve
            const t = progress;
            const bezier = this.calculateBezierPoint(t, transit.start, transit.control, transit.end);
            transit.mesh.position.copy(bezier);

            // Arc height (parabolic)
            transit.mesh.position.y += Math.sin(t * Math.PI) * 2.0;

            // Rotation during flight
            transit.mesh.rotation.y += transit.rotationSpeed * deltaTime;

            return true; // Keep in transit
        });
    }

    calculateBezierPoint(t, p0, p1, p2) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        const x = mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x;
        const y = mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y;
        const z = mt2 * p0.z + 2 * mt * t * p1.z + t2 * p2.z;

        return new THREE.Vector3(x, y, z);
    }

    transferMeat(startPos, count = 1) {
        let transferred = 0;

        for (let i = 0; i < count; i++) {
            if (this.meatOnTable.length >= this.maxCapacity) {
                break; // Table is full
            }

            // Create meat mesh for animation
            const meatGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 8);
            const meatMat = new THREE.MeshStandardMaterial({
                color: COLORS_P2.meatDisk,
                roughness: 0.6,
                metalness: 0.1
            });
            const meatMesh = new THREE.Mesh(meatGeo, meatMat);
            meatMesh.position.copy(startPos);
            meatMesh.castShadow = true;
            this.scene.add(meatMesh);

            // Set up bezier curve for flight
            const endPos = new THREE.Vector3(
                this.tablePosition.x + (Math.random() - 0.5) * 1.0,
                this.tablePosition.y + 0.5,
                this.tablePosition.z + (Math.random() - 0.5) * 0.8
            );
            const controlPos = new THREE.Vector3(
                (startPos.x + endPos.x) / 2,
                startPos.y + 3.0, // High arc
                (startPos.z + endPos.z) / 2
            );

            this.inTransitMeat.push({
                mesh: meatMesh,
                start: startPos.clone(),
                control: controlPos,
                end: endPos,
                time: 0,
                duration: 0.5, // Flight duration
                rotationSpeed: (Math.random() - 0.5) * 10
            });

            transferred++;
        }

        return transferred;
    }

    dispose() {
        // Clear all meat
        this.meatOnTable.forEach(meat => {
            this.scene.remove(meat);
            meat.geometry.dispose();
            meat.material.dispose();
        });
        this.meatOnTable = [];

        // Clear in-transit meat
        this.inTransitMeat.forEach(transit => {
            this.scene.remove(transit.mesh);
            transit.mesh.geometry.dispose();
            transit.mesh.material.dispose();
        });
        this.inTransitMeat = [];
    }
}
