// MarketZone — orchestrator for the market selling-loop.
//
// Importing this file registers all market mesh presets via the side-effect
// import below. The exported createMarket() is invoked once during level
// load to spawn stalls + coin trays + the customer spawner from a level
// JSON `market` block.

import * as THREE from 'three';
import './presets.js';

import RoadPathRegistry, { RoadPath } from './RoadPath.js';
import PriceSignUI from '../../ui/PriceSignUI.js';
import { StallCounterUI } from '../../ui/StallCounterUI.js';
import { MARKET_CONFIG } from '../../config/gameConfig.js';
import { yawToCamera } from '../../utils/FaceCamera.js';

/**
 * Build the full market zone from a level JSON config block. Returns a
 * { update() } handle the main animate loop calls each frame to refresh
 * the floating count bubbles.
 *
 * @param {object} deps
 * @param {EntityFactory} deps.factory
 * @param {ECSManager}    deps.ecs
 * @param {THREE.Scene}   deps.scene
 * @param {THREE.Camera}  deps.camera
 * @param {CustomerAISystem} deps.customerAISystem
 * @param {object} marketCfg JSON: { road, stalls[], customerSpawn }
 */
export function createMarket(deps, marketCfg) {
    const { factory, ecs, scene, camera, customerAISystem } = deps;
    const counterUIs = [];
    const stallIds   = [];
    const trayIds    = [];

    if (!marketCfg) return { update() {}, stallIds, trayIds };

    // ── 1. Build road spline(s) ─────────────────────────────────────────
    if (marketCfg.road && Array.isArray(marketCfg.road.waypoints)) {
        const path = new RoadPath(
            marketCfg.road.waypoints.map(w => new THREE.Vector3(w.x ?? 0, w.y ?? 0, w.z ?? 0))
        );
        RoadPathRegistry.register(marketCfg.road.pathId || 'market-road-1', path);
    }

    // ── 2. Spawn stalls + their attached coin trays ─────────────────────
    if (Array.isArray(marketCfg.stalls)) {
        for (const stallDef of marketCfg.stalls) {
            const stallPos = new THREE.Vector3(
                stallDef.position?.x || 0,
                stallDef.position?.y || 0,
                stallDef.position?.z || 0
            );

            // Per-stall product/price overrides (from level JSON) take priority
            // over archetype defaults — keeps the archetype generic and the
            // level-specific values declarative.
            const stallOverrides = {};
            if (stallDef.stall) stallOverrides.Stall = { ...stallDef.stall };

            const stallId = factory.create(
                stallDef.archetype || 'market-stall',
                stallPos,
                stallOverrides
            );
            stallIds.push(stallId);

            const stallTransform = ecs.getComponent(stallId, 'Transform');
            const stallComp      = ecs.getComponent(stallId, 'Stall');
            const stallMesh      = stallTransform?.mesh;

            // Apply rotation. Default: yaw the stall so its front face points
            // at the orthographic camera (same direction the billboard sign
            // is tilted toward). A level-JSON `rotationY` override replaces
            // the auto-facing for level designers who need a specific angle.
            // Note: axis-aligned colliders stay unrotated — fine for the
            // MVP since stalls are static props approached head-on.
            if (stallMesh) {
                if (typeof stallDef.rotationY === 'number') {
                    stallMesh.rotation.y = stallDef.rotationY;
                } else {
                    yawToCamera(stallMesh);
                }
            }

            // Paint the price sign canvas with the configured product+price.
            if (stallMesh && stallComp) {
                PriceSignUI.bind(stallMesh, stallComp.productLabel, stallComp.price);
            }

            // ── 2b. Coin tray attached to this stall ────────────────────
            let trayId = null;
            if (stallDef.tray) {
                const trayLocalOffset = new THREE.Vector3(
                    stallDef.tray.offset?.x ?? 0,
                    stallDef.tray.offset?.y ?? 0,
                    stallDef.tray.offset?.z ?? 0
                );

                // If the stall mesh has a trayAnchor we use its local offset
                // (so the tray sits at the same spot the mesh was modeled to
                // expect) but still allow level JSON override.
                let trayWorldPos;
                if (stallMesh && stallMesh.userData?.trayAnchor && !stallDef.tray.offset) {
                    stallMesh.userData.trayAnchor.updateWorldMatrix(true, false);
                    trayWorldPos = new THREE.Vector3()
                        .setFromMatrixPosition(stallMesh.userData.trayAnchor.matrixWorld);
                } else {
                    trayWorldPos = stallPos.clone().add(trayLocalOffset);
                }

                trayId = factory.create(
                    stallDef.tray.archetype || 'market-coin-tray',
                    trayWorldPos
                );
                trayIds.push(trayId);

                // Tray shares the stall's facing — match yaw so the tray
                // sits visually parallel to the counter edge. Respects an
                // explicit level-JSON override if the designer wants a
                // different angle.
                const trayTransform = ecs.getComponent(trayId, 'Transform');
                if (trayTransform?.mesh) {
                    if (typeof stallDef.tray.rotationY === 'number') {
                        trayTransform.mesh.rotation.y = stallDef.tray.rotationY;
                    } else if (stallMesh) {
                        trayTransform.mesh.rotation.y = stallMesh.rotation.y;
                    } else {
                        yawToCamera(trayTransform.mesh);
                    }
                }
            }

            // Wire stall → tray reference (used by StallSystem to drop coins).
            if (stallComp && trayId !== null) {
                stallComp.trayId = trayId;
            }

            // ── 2c. Counter bubbles (stall stack + tray) ────────────────
            if (stallMesh && stallMesh.userData?.counterAnchor && stallComp) {
                counterUIs.push(new StallCounterUI(camera, ecs, stallMesh.userData.counterAnchor, {
                    entityId:     stallId,
                    resourceType: stallComp.productType,
                    icon:         '🍬',
                    threshold:    MARKET_CONFIG.counterBubbleThreshold
                }));
            }
            if (trayId !== null) {
                const trayTransform = ecs.getComponent(trayId, 'Transform');
                const trayMesh      = trayTransform?.mesh;
                if (trayMesh && trayMesh.userData?.counterAnchor) {
                    counterUIs.push(new StallCounterUI(camera, ecs, trayMesh.userData.counterAnchor, {
                        entityId:     trayId,
                        resourceType: 'coin',
                        icon:         '🪙',
                        threshold:    MARKET_CONFIG.counterBubbleThreshold
                    }));
                }
            }
        }
    }

    // ── 3. Customer spawner ─────────────────────────────────────────────
    if (marketCfg.customerSpawn && customerAISystem) {
        customerAISystem.registerSpawner({
            pathId:      marketCfg.customerSpawn.pathId      || marketCfg.road?.pathId || 'market-road-1',
            intervalSec: marketCfg.customerSpawn.intervalSec || MARKET_CONFIG.customerSpawnIntervalSec,
            maxLive:     marketCfg.customerSpawn.maxLive     || MARKET_CONFIG.customerMaxLive,
            archetype:   marketCfg.customerSpawn.archetype   || 'customer',
            startEdge:   marketCfg.customerSpawn.startEdge   || 'alternate'
        });
    }

    // ── 4. Optional debug road visualization ────────────────────────────
    if (marketCfg.road && marketCfg.road.debug) {
        _drawRoadDebugLine(scene, marketCfg.road.waypoints);
    }

    return {
        stallIds,
        trayIds,
        update() {
            for (const ui of counterUIs) ui.update();
        }
    };
}

function _drawRoadDebugLine(scene, waypoints) {
    const pts = waypoints.map(w => new THREE.Vector3(w.x, (w.y ?? 0) + 0.05, w.z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const samples = curve.getPoints(64);
    const geo = new THREE.BufferGeometry().setFromPoints(samples);
    const mat = new THREE.LineBasicMaterial({ color: 0xff8844 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
}
