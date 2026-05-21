import * as THREE from 'three';

/**
 * PlayerGun — heavy LMG mesh attached to the player.
 *
 * Slice 3 redesign: M249/SAW-style light machine gun silhouette built from
 * 7 primitives so it reads as a HEAVY weapon from top-down, not a stick:
 *
 *   - body         long thick housing (barrel rail)
 *   - stock        rear shoulder stock
 *   - drum         circular drum magazine hanging beneath
 *   - rail         flat top rail running over the body
 *   - optic        small mounted scope on the rail (visible from above)
 *   - shroud       perforated barrel cover extending forward
 *   - muzzle tip   short final barrel protrusion
 *   - foregrip     small vertical grip under the front
 *
 * Owns the muzzle flash sprite + a smoke-wisp anchor. Recoil is a TWO-axis
 * kick: back along local -Z AND a pitch-up rotation around local +X. Both
 * decay over ~90ms so the gun visibly settles after each shot.
 */

const BODY_COLOR    = 0x1a1a1f;
const STOCK_COLOR   = 0x2a2a32;
const DRUM_COLOR    = 0x10121a;
const RAIL_COLOR    = 0x202028;
const OPTIC_COLOR   = 0x080a10;
const SHROUD_COLOR  = 0x16181c;
const BARREL_COLOR  = 0x080808;
const GRIP_COLOR    = 0x101015;

const RECOIL_DURATION = 0.09;
const RECOIL_KICK_Z   = 0.15; // local -Z displacement at peak (was 0.08 — heavier)
const RECOIL_KICK_X   = 0.22; // rad — barrel pitch up at peak (slice 3 addition)

export class PlayerGun extends THREE.Group {
    constructor() {
        super();

        // ── Body — long thick housing (barrel rail) ──────────────────────
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.09, 0.55),
            new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.4 })
        );
        body.position.z = 0.15;
        this.add(body);

        // ── Stock — rear shoulder block ──────────────────────────────────
        const stock = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.13, 0.2),
            new THREE.MeshStandardMaterial({ color: STOCK_COLOR, roughness: 0.6 })
        );
        stock.position.z = -0.2;
        stock.position.y = -0.005;
        this.add(stock);

        // ── Drum magazine — circular, hangs beneath the body ─────────────
        // Cylinder axis along Y (default) — reads as a flat disc from
        // top-down. Larger than the slice-2 box mag for visual weight.
        const drum = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.11, 0.08, 18),
            new THREE.MeshStandardMaterial({ color: DRUM_COLOR, roughness: 0.5 })
        );
        drum.position.set(0, -0.13, -0.05);
        this.add(drum);
        // Drum cap detail — a slightly raised inner cylinder for "rivet" look
        const drumCap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.09, 12),
            new THREE.MeshStandardMaterial({ color: 0x202028, roughness: 0.5 })
        );
        drumCap.position.set(0, -0.13, -0.05);
        this.add(drumCap);

        // ── Top rail — flat strip over the body ──────────────────────────
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.025, 0.36),
            new THREE.MeshStandardMaterial({ color: RAIL_COLOR, roughness: 0.3 })
        );
        rail.position.set(0, 0.062, 0.13);
        this.add(rail);

        // ── Optic / scope — small box on the rail (top-down readable) ────
        const optic = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.06, 0.13),
            new THREE.MeshStandardMaterial({ color: OPTIC_COLOR, roughness: 0.25, metalness: 0.4 })
        );
        optic.position.set(0, 0.105, 0.08);
        this.add(optic);
        // Optic glass front — a tiny bright disc for "this is a scope" hint
        const opticGlass = new THREE.Mesh(
            new THREE.CircleGeometry(0.022, 12),
            new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.85 })
        );
        opticGlass.rotation.x = -Math.PI / 2; // face up so it's visible from above
        opticGlass.position.set(0, 0.137, 0.08);
        this.add(opticGlass);

        // ── Barrel shroud — perforated cover forward of the body ─────────
        const shroud = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, 0.32, 14),
            new THREE.MeshStandardMaterial({ color: SHROUD_COLOR, roughness: 0.4 })
        );
        shroud.rotation.x = Math.PI / 2;
        shroud.position.z = 0.46;
        this.add(shroud);

        // ── Muzzle tip — final barrel protrusion ─────────────────────────
        const tip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10),
            new THREE.MeshStandardMaterial({ color: BARREL_COLOR, roughness: 0.3 })
        );
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.65;
        this.add(tip);

        // ── Foregrip — small vertical grip beneath the front ─────────────
        const grip = new THREE.Mesh(
            new THREE.BoxGeometry(0.045, 0.1, 0.06),
            new THREE.MeshStandardMaterial({ color: GRIP_COLOR, roughness: 0.6 })
        );
        grip.position.set(0, -0.07, 0.32);
        this.add(grip);

        // Muzzle position in local space — bullets + flash + smoke anchor
        this.muzzleLocal = new THREE.Vector3(0, 0, 0.71);

        // ── Muzzle flash sprite — bigger than slice 2, additive ──────────
        const flashTexture = this._buildFlashTexture();
        const flashMat = new THREE.SpriteMaterial({
            map: flashTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0
        });
        this.flash = new THREE.Sprite(flashMat);
        this.flash.scale.set(1.3, 1.3, 1); // 2x slice-2 size (was 0.65)
        this.flash.position.copy(this.muzzleLocal);
        this.add(this.flash);

        // Recoil state
        this._recoilLeft = 0;
        this._restPos = new THREE.Vector3();

        // Cached temps
        this._worldQuat = new THREE.Quaternion();
    }

    /**
     * Parent this gun to the player's root mesh and place at the right
     * shoulder. The local +Z direction matches the player's forward.
     */
    attachToPlayer(playerMesh) {
        playerMesh.add(this);
        this.position.set(0.27, 0.85, 0.1);
        this._restPos.copy(this.position);
        this.rotation.set(0, 0, 0);
    }

    update(deltaTime) {
        if (this._recoilLeft > 0) {
            this._recoilLeft = Math.max(0, this._recoilLeft - deltaTime);
            const t = this._recoilLeft / RECOIL_DURATION; // 1 → 0 as decay completes
            // Two-axis kick: back along -Z AND pitch up around +X
            this.position.z = this._restPos.z - RECOIL_KICK_Z * t;
            this.rotation.x = RECOIL_KICK_X * t;
            // Muzzle flash fades with the recoil
            this.flash.material.opacity = t;
        } else if (this.flash.material.opacity !== 0 || this.rotation.x !== 0) {
            this.position.copy(this._restPos);
            this.rotation.x = 0;
            this.flash.material.opacity = 0;
        }
    }

    /** Trigger one shot — kicks gun back+up and lights muzzle flash. */
    fire() {
        this._recoilLeft = RECOIL_DURATION;
        this.flash.material.opacity = 1;
    }

    /** Compute muzzle position in world space (for bullet + smoke spawn). */
    getMuzzleWorld(out) {
        out.copy(this.muzzleLocal);
        this.localToWorld(out);
        return out;
    }

    /** Compute gun's world-space right vector (for brass eject direction). */
    getRightWorld(out) {
        this.getWorldQuaternion(this._worldQuat);
        out.set(1, 0, 0).applyQuaternion(this._worldQuat);
        return out;
    }

    _buildFlashTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 128; // higher res for the bigger sprite
        const ctx = c.getContext('2d');
        // Hot core + warm bloom radial — wider than slice 2 for the heavy feel
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
        gradient.addColorStop(0.00, 'rgba(255, 250, 220, 1)');
        gradient.addColorStop(0.20, 'rgba(255, 220, 140, 0.95)');
        gradient.addColorStop(0.45, 'rgba(255, 160,  60, 0.7)');
        gradient.addColorStop(0.75, 'rgba(255, 100,  30, 0.35)');
        gradient.addColorStop(1.00, 'rgba(255,  90,  30, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    }
}
