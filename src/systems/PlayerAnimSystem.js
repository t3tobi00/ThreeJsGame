import * as THREE from 'three';

/**
 * PlayerAnimSystem — Procedural walk cycle, body bob, idle breath, and
 * squash/stretch for hero-tier characters that have named limb pivots
 * ('leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'torso', 'body') in their mesh.
 *
 * Driven by per-frame position delta — works for any entity with a Movement
 * component, but only animates ones whose mesh actually exposes the limb
 * pivots (i.e. the 'character-player' preset). Other characters are skipped.
 *
 * Required components: ['Transform', 'Movement', 'WalkAnim']
 * Optional: 'SquashStretch'
 */
export class PlayerAnimSystem {
    update(entities, deltaTime, ecs) {
        if (deltaTime <= 0) return;

        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const walkAnim  = ecs.getComponent(id, 'WalkAnim');
            if (!transform || !walkAnim) continue;

            const root = transform.mesh;
            if (!root) continue;

            // Lazy-cache limb refs the first time we see this mesh
            if (!walkAnim._refs) {
                walkAnim._refs = {
                    torso:     root.getObjectByName('torso'),
                    body:      root.getObjectByName('body'),
                    leftArm:   root.getObjectByName('leftArm'),
                    rightArm:  root.getObjectByName('rightArm'),
                    leftElbow: root.getObjectByName('leftElbow'),
                    rightElbow:root.getObjectByName('rightElbow'),
                    leftLeg:   root.getObjectByName('leftLeg'),
                    rightLeg:  root.getObjectByName('rightLeg'),
                    leftKnee:  root.getObjectByName('leftKnee'),
                    rightKnee: root.getObjectByName('rightKnee'),
                };
                walkAnim._prevPos = new THREE.Vector3().copy(root.position);
                walkAnim._bodyRestY = root.userData.bodyRestY ?? (walkAnim._refs.body?.position.y ?? 0);
                // Detect a tool tagged isWorkerAxe inside the rightArm
                // subtree. When present, the walk cycle skips animating
                // rightArm so the axe stays still while the worker
                // walks. (The chop animation rotates the axe directly
                // via LungeAnimSystem; the arm never needs to move.)
                walkAnim._holdsAxe = false;
                if (walkAnim._refs.rightArm) {
                    walkAnim._refs.rightArm.traverse(o => {
                        if (o.userData?.isWorkerAxe) walkAnim._holdsAxe = true;
                    });
                }
            }

            const refs = walkAnim._refs;
            // No limb pivots → not a hero-tier character, nothing to animate
            if (!refs.leftArm || !refs.rightArm || !refs.leftLeg || !refs.rightLeg) continue;

            // ── Speed from world-space movement delta ──
            const dx = root.position.x - walkAnim._prevPos.x;
            const dz = root.position.z - walkAnim._prevPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const speed = distance / deltaTime;
            walkAnim._prevPos.set(root.position.x, root.position.y, root.position.z);

            // Movement.speed gives us the entity's max speed for normalization
            const movement = ecs.getComponent(id, 'Movement');
            const maxSpeed = (movement && movement.speed) || 8;
            const speed01 = Math.min(1, speed / maxSpeed);
            const moving = speed01 > 0.05;

            // Advance walk phase
            walkAnim.phase += deltaTime * walkAnim.bobFreq * (0.4 + speed01);

            // ── Zombie style: arms locked forward, stiff lurch, side-to-side sway ──
            if (walkAnim.style === 'zombie') {
                const armRest   = root.userData.zombieArmRestX  ?? -Math.PI / 2;
                const torsoRest = root.userData.zombieTorsoRestX ?? 0.12;

                if (moving) {
                    const swing = Math.sin(walkAnim.phase) * (0.4 + speed01 * 0.3);
                    refs.leftArm.rotation.x  = armRest + Math.sin(walkAnim.phase) * 0.08;
                    refs.rightArm.rotation.x = armRest - Math.sin(walkAnim.phase) * 0.08;
                    refs.leftLeg.rotation.x  = -swing * 0.55;
                    refs.rightLeg.rotation.x =  swing * 0.55;
                    if (refs.body) {
                        refs.body.position.y =
                            walkAnim._bodyRestY +
                            Math.abs(Math.sin(walkAnim.phase)) * walkAnim.bobHeight * 0.6;
                    }
                    if (refs.torso) {
                        refs.torso.rotation.z = Math.sin(walkAnim.phase) * 0.10;
                        refs.torso.rotation.x = torsoRest + walkAnim.tiltAngle * speed01;
                    }
                } else {
                    const k = Math.min(1, deltaTime * 6);
                    refs.leftArm.rotation.x  += (armRest - refs.leftArm.rotation.x)  * k;
                    refs.rightArm.rotation.x += (armRest - refs.rightArm.rotation.x) * k;
                    refs.leftLeg.rotation.x  += (0 - refs.leftLeg.rotation.x)  * k;
                    refs.rightLeg.rotation.x += (0 - refs.rightLeg.rotation.x) * k;
                    if (refs.torso) {
                        refs.torso.rotation.z += (0 - refs.torso.rotation.z) * k;
                        refs.torso.rotation.x += (torsoRest - refs.torso.rotation.x) * k;
                    }
                    if (refs.body) {
                        const t = performance.now() * 0.0015;
                        refs.body.position.y = walkAnim._bodyRestY + Math.sin(t) * 0.012;
                    }
                }
                continue;
            }

            // Constant slight forward curl on the elbows so arms never look
            // stick-straight (matches casual human idle pose). Walks add knee
            // bend on top to humanize the stride.
            const ELBOW_BASELINE = -0.18;

            if (moving) {
                const swing = Math.sin(walkAnim.phase) * (0.6 + speed01 * 0.4);

                refs.leftArm.rotation.x  =  swing;
                if (!walkAnim._holdsAxe) refs.rightArm.rotation.x = -swing;
                refs.leftLeg.rotation.x  = -swing * 0.8;
                refs.rightLeg.rotation.x =  swing * 0.8;

                // Knee bend — peaks when each leg is in back-swing (lifting).
                // Scales with speed so very slow movement reads as a glide.
                if (refs.leftKnee) {
                    refs.leftKnee.rotation.x  = Math.max(0, -Math.sin(walkAnim.phase)) * 0.7 * speed01;
                }
                if (refs.rightKnee) {
                    refs.rightKnee.rotation.x = Math.max(0,  Math.sin(walkAnim.phase)) * 0.7 * speed01;
                }

                // Elbow — hold the baseline curl while walking. Right elbow
                // stays locked if a tool/axe is parented to it (worker case).
                if (refs.leftElbow)  refs.leftElbow.rotation.x  = ELBOW_BASELINE;
                if (refs.rightElbow && !walkAnim._holdsAxe) refs.rightElbow.rotation.x = ELBOW_BASELINE;

                if (refs.body) {
                    refs.body.position.y =
                        walkAnim._bodyRestY +
                        Math.abs(Math.sin(walkAnim.phase * 2)) * walkAnim.bobHeight;
                }
                if (refs.torso) {
                    refs.torso.rotation.x = walkAnim.tiltAngle * speed01;
                }
            } else {
                // Idle: lerp limbs back to rest, gentle breath on body
                const k = Math.min(1, deltaTime * 8);
                refs.leftArm.rotation.x  += (0 - refs.leftArm.rotation.x)  * k;
                if (!walkAnim._holdsAxe) refs.rightArm.rotation.x += (0 - refs.rightArm.rotation.x) * k;
                refs.leftLeg.rotation.x  += (0 - refs.leftLeg.rotation.x)  * k;
                refs.rightLeg.rotation.x += (0 - refs.rightLeg.rotation.x) * k;
                if (refs.leftKnee)  refs.leftKnee.rotation.x  += (0 - refs.leftKnee.rotation.x)  * k;
                if (refs.rightKnee) refs.rightKnee.rotation.x += (0 - refs.rightKnee.rotation.x) * k;
                // Lerp elbows toward the casual baseline so even idle reads as humanoid
                if (refs.leftElbow)  refs.leftElbow.rotation.x  += (ELBOW_BASELINE - refs.leftElbow.rotation.x)  * k;
                if (refs.rightElbow && !walkAnim._holdsAxe) refs.rightElbow.rotation.x += (ELBOW_BASELINE - refs.rightElbow.rotation.x) * k;
                if (refs.torso) refs.torso.rotation.x += (0 - refs.torso.rotation.x) * k;

                if (refs.body) {
                    const t = performance.now() * 0.002;
                    refs.body.position.y = walkAnim._bodyRestY + Math.sin(t) * 0.015;
                }
            }

            // ── Squash/stretch on the root scale ──
            const squash = ecs.getComponent(id, 'SquashStretch');
            if (squash) {
                if (moving) {
                    const sy = 1 + Math.sin(walkAnim.phase * 2) * squash.intensity * 0.5 * speed01;
                    const sxz = 1 - (sy - 1) * 0.5;
                    root.scale.set(sxz, sy, sxz);
                } else {
                    // Lerp scale back to neutral
                    const k = Math.min(1, deltaTime * 8);
                    root.scale.x += (1 - root.scale.x) * k;
                    root.scale.y += (1 - root.scale.y) * k;
                    root.scale.z += (1 - root.scale.z) * k;
                }
            }
        }
    }
}
