import * as THREE from 'three';

/**
 * CombatVFXSystem — Transient mesh effects for melee strikes.
 *
 * Two effect kinds:
 *   - 'arc'       — a partial-torus slash trail in front of the attacker,
 *                   used by Scout. Cyan, vertical, scales+fades fast.
 *   - 'shockwave' — a flat expanding ring on the ground, used by Bruiser.
 *                   Red/orange, grows from small to wide while fading.
 *
 * Standalone (not ECS-registered). Tick from main.js animate loop.
 * LungeAnimSystem owns the spawn-timing decision and calls into us.
 */
export class CombatVFXSystem {
    constructor(scene) {
        this.scene = scene;
        this._fx = [];
    }

    /**
     * Cyan slash arc for Scout — a partial-torus trail oriented vertically
     * in front of the attacker, like a weapon-swing trail. Briefly visible.
     */
    spawnSlashArc({ position, direction, color = 0x44eeff }) {
        const radius = 0.85;
        const tube   = 0.08;
        const geo = new THREE.TorusGeometry(radius, tube, 8, 24, Math.PI * 0.6);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);

        // Make the arc face forward (along `direction`) and open horizontally.
        // Default torus lies in the XY plane (axis along +Z). After lookAt the
        // axis points toward the target; rotate the local Z so the gap (the
        // open side of the partial torus) faces the strike direction.
        const lookTarget = position.clone().add(direction);
        mesh.lookAt(lookTarget);
        mesh.rotateZ(Math.PI / 2);

        this.scene.add(mesh);
        this._fx.push({
            kind: 'arc',
            mesh, geo, mat,
            life: 0.20,
            lifeMax: 0.20,
            startOpacity: 0.95,
            startScale: 0.55,
            endScale:   1.30
        });
    }

    /**
     * Red ground shockwave for Bruiser — a flat ring that expands rapidly
     * outward from the impact point on the ground plane.
     */
    spawnShockwave({ position, color = 0xff5522 }) {
        const innerR = 0.85;
        const outerR = 1.0;
        const geo = new THREE.RingGeometry(innerR, outerR, 36);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.90,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, 0.04, position.z);
        mesh.rotation.x = -Math.PI / 2;          // lie flat
        mesh.scale.setScalar(0.5);

        this.scene.add(mesh);
        this._fx.push({
            kind: 'shockwave',
            mesh, geo, mat,
            life: 0.40,
            lifeMax: 0.40,
            startOpacity: 0.90,
            startScale: 0.5,
            endScale:   2.8
        });
    }

    update(deltaTime) {
        for (let i = this._fx.length - 1; i >= 0; i--) {
            const f = this._fx[i];
            f.life -= deltaTime;
            if (f.life <= 0) {
                this.scene.remove(f.mesh);
                f.geo.dispose();
                f.mat.dispose();
                this._fx.splice(i, 1);
                continue;
            }

            const t = 1 - (f.life / f.lifeMax);   // 0 → 1 over lifetime
            const scale = f.startScale + (f.endScale - f.startScale) * t;
            f.mesh.scale.setScalar(scale);
            // Slash arc: ease-out fade. Shockwave: linear fade.
            const fade = f.kind === 'arc' ? (1 - t * t) : (1 - t);
            f.mat.opacity = f.startOpacity * fade;
        }
    }
}
