import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import { MARKET_CONFIG } from '../config/gameConfig.js';
import RoadPathRegistry from '../zones/market/RoadPath.js';

/**
 * CustomerAISystem — Walks customers along a road spline and steers them
 * off-spline to nearby stalls to buy. Owns spawn/despawn cadence too;
 * registerSpawner(cfg) is called by createMarket() once per road.
 *
 * Queries: ['Transform', 'Customer', 'RoadPath', 'Movement']
 *
 * State machine per customer (see Component_Customer.state):
 *   walking      → advance t along the spline
 *                  if a stocked stall is within MARKET_CONFIG.stallApproachRange
 *                     → set targetStallId, save reentryT, flip to 'approaching'
 *   approaching  → lerp toward stall's customer-side position (front of
 *                  counter); when within 0.6m, flip to 'buying'
 *   buying       → emit 'stall:purchase_request' on entry, hold pauseTimer,
 *                  wait for 'stall:purchased' to flip to 'leaving'
 *   leaving      → lerp back to spline at reentryT; when within 0.5m,
 *                  flip to 'walking'
 *
 * On spline exit (t outside [0,1]) the customer is destroyed and a respawn
 * is scheduled via the spawner cadence.
 */
export class CustomerAISystem {
    constructor(factory, scene) {
        this._factory  = factory;
        this._scene    = scene;
        this._ecs      = null;
        this._spawners = [];               // [{cfg, timer, liveIds:Set}]
        this._buyingEntered = new Set();   // customers that have already emitted purchase_request

        EventBus.on('stall:purchased', ({ customerId }) => {
            this._onPurchaseResolved(customerId);
        });
        EventBus.on('stall:empty', ({ stallId }) => {
            this._releaseCustomersTargeting(stallId);
        });
    }

    setECS(ecs) { this._ecs = ecs; }

    /** Register a customer spawner config — called once per market road. */
    registerSpawner(cfg) {
        this._spawners.push({
            cfg: {
                pathId:      cfg.pathId,
                intervalSec: cfg.intervalSec ?? MARKET_CONFIG.customerSpawnIntervalSec,
                maxLive:     cfg.maxLive     ?? MARKET_CONFIG.customerMaxLive,
                archetype:   cfg.archetype   ?? 'customer',
                startEdge:   cfg.startEdge   ?? 'alternate'   // 'left' | 'right' | 'alternate'
            },
            timer:    0,
            liveIds:  new Set(),
            sideFlag: false
        });
    }

    update(entities, deltaTime, ecs) {
        this._ecs = ecs;

        // 1) Advance state machines for every customer.
        for (const id of entities) {
            const transform = ecs.getComponent(id, 'Transform');
            const customer  = ecs.getComponent(id, 'Customer');
            const roadPath  = ecs.getComponent(id, 'RoadPath');
            const movement  = ecs.getComponent(id, 'Movement');
            if (!transform || !customer || !roadPath || !movement) continue;

            const path = RoadPathRegistry.get(roadPath.pathId);
            if (!path) continue;

            switch (customer.state) {
                case 'walking':
                    this._tickWalking(id, deltaTime, transform, customer, roadPath, movement, path, ecs);
                    break;
                case 'approaching':
                    this._tickApproaching(id, deltaTime, transform, customer, movement, ecs);
                    break;
                case 'buying':
                    this._tickBuying(id, deltaTime, customer);
                    break;
                case 'leaving':
                    this._tickLeaving(id, deltaTime, transform, customer, roadPath, movement, path);
                    break;
            }
        }

        // 2) Tick spawners.
        for (const spawner of this._spawners) {
            this._tickSpawner(spawner, deltaTime, ecs);
        }
    }

    // ── State handlers ──────────────────────────────────────────────────────

    _tickWalking(id, dt, transform, customer, roadPath, movement, path, ecs) {
        // Advance along the spline by ds = speed * dt.
        const speed = MARKET_CONFIG.customerWalkSpeed ?? movement.speed;
        const ds = (speed * dt) / Math.max(0.0001, path.length);
        roadPath.t += roadPath.direction * ds;

        if (roadPath.t <= 0 || roadPath.t >= 1) {
            this._despawn(id);
            return;
        }

        const pos = path.pointAt(roadPath.t);
        const tan = path.tangentAt(roadPath.t).multiplyScalar(roadPath.direction);

        transform.mesh.position.set(pos.x, pos.y, pos.z);
        transform.mesh.rotation.y = Math.atan2(tan.x, tan.z);

        // Look for a stocked stall within approach range.
        const stallId = this._findNearbyStockedStall(transform.mesh.position, ecs);
        if (stallId !== null && Math.random() < MARKET_CONFIG.customerBuyProbability) {
            customer.targetStallId = stallId;
            customer.reentryT      = roadPath.t;
            customer.state         = 'approaching';
        }
    }

    _tickApproaching(id, dt, transform, customer, movement, ecs) {
        const stall = customer.targetStallId !== null
            ? ecs.getComponent(customer.targetStallId, 'Stall')
            : null;
        const stallTransform = customer.targetStallId !== null
            ? ecs.getComponent(customer.targetStallId, 'Transform')
            : null;
        const stallInventory = customer.targetStallId !== null
            ? ecs.getComponent(customer.targetStallId, 'InventoryStack')
            : null;

        // If the target became invalid (sold out, removed) → bail to leaving.
        if (!stall || !stallTransform || !stallInventory ||
            stallInventory.getCountByType(stall.productType) === 0) {
            customer.state = 'leaving';
            return;
        }

        // Approach point = 1.6m in front of the stall, measured in the
        // stall's LOCAL +Z direction. Using localToWorld keeps the customer
        // walking to the correct spot even when the stall has been yawed
        // to face the camera.
        const target = new THREE.Vector3(0, 0, 1.6);
        stallTransform.mesh.localToWorld(target);
        this._steerToward(transform, target, MARKET_CONFIG.customerLeaveLerpSpeed, dt);

        if (transform.mesh.position.distanceTo(target) < 0.5) {
            customer.state      = 'buying';
            customer.pauseTimer = MARKET_CONFIG.customerPauseSec;
            // Face the stall.
            const dir = stallTransform.mesh.position.clone().sub(transform.mesh.position);
            transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
    }

    _tickBuying(id, dt, customer) {
        customer.pauseTimer -= dt;
        // Emit the purchase request on the first frame we enter buying.
        if (!this._buyingEntered.has(id)) {
            this._buyingEntered.add(id);
            EventBus.emit('stall:purchase_request', {
                customerId: id,
                stallId:    customer.targetStallId,
                maxPrice:   customer.budget
            });
        }
        // Fallback safety: if no 'stall:purchased' has flipped state in 2s,
        // self-release so the customer doesn't get stuck.
        if (customer.pauseTimer < -2.0) {
            this._buyingEntered.delete(id);
            customer.state = 'leaving';
        }
    }

    _tickLeaving(id, dt, transform, customer, roadPath, movement, path) {
        const target = path.pointAt(customer.reentryT);
        this._steerToward(transform, target, MARKET_CONFIG.customerLeaveLerpSpeed, dt);

        if (transform.mesh.position.distanceTo(target) < 0.5) {
            // Snap to spline parameter and resume walking.
            roadPath.t       = customer.reentryT;
            customer.state   = 'walking';
            customer.targetStallId = null;
        }
    }

    // ── Spawning ────────────────────────────────────────────────────────────

    _tickSpawner(spawner, dt, ecs) {
        // Remove dead ids (entity was destroyed externally or via despawn).
        for (const id of [...spawner.liveIds]) {
            const exists = ecs.getComponent(id, 'Customer');
            if (!exists) spawner.liveIds.delete(id);
        }

        spawner.timer += dt;
        if (spawner.timer < spawner.cfg.intervalSec)        return;
        if (spawner.liveIds.size >= spawner.cfg.maxLive)    return;

        const path = RoadPathRegistry.get(spawner.cfg.pathId);
        if (!path) return;

        spawner.timer = 0;

        // Pick a side to spawn from so customers walk in alternating directions.
        let direction = 1;
        let startT    = MARKET_CONFIG.customerSpawnEdgeMargin;
        if (spawner.cfg.startEdge === 'left') {
            direction = 1;
            startT    = MARKET_CONFIG.customerSpawnEdgeMargin;
        } else if (spawner.cfg.startEdge === 'right') {
            direction = -1;
            startT    = 1 - MARKET_CONFIG.customerSpawnEdgeMargin;
        } else {
            // alternate
            spawner.sideFlag = !spawner.sideFlag;
            if (spawner.sideFlag) {
                direction = 1;
                startT    = MARKET_CONFIG.customerSpawnEdgeMargin;
            } else {
                direction = -1;
                startT    = 1 - MARKET_CONFIG.customerSpawnEdgeMargin;
            }
        }

        const pos = path.pointAt(startT);
        const id  = this._factory.create(spawner.cfg.archetype, pos);

        // Wire the spawn-time RoadPath state.
        const roadPath = ecs.getComponent(id, 'RoadPath');
        if (roadPath) {
            roadPath.pathId    = spawner.cfg.pathId;
            roadPath.t         = startT;
            roadPath.direction = direction;
        }
        spawner.liveIds.add(id);

        EventBus.emit('customer:spawn', { entityId: id, pathId: spawner.cfg.pathId });
    }

    _despawn(id) {
        if (!this._ecs) return;
        // Drop any items the customer was carrying (otherwise their stack
        // meshes are orphaned in the scene after the customer is destroyed).
        const inv = this._ecs.getComponent(id, 'InventoryStack');
        if (inv) {
            for (const slot of inv.slots) {
                while (slot.stack.getCount() > 0) {
                    const m = slot.stack.pop();
                    if (m && this._scene) this._scene.remove(m);
                    if (m?.geometry) m.geometry.dispose();
                    if (m?.material) m.material.dispose();
                }
            }
        }
        const transform = this._ecs.getComponent(id, 'Transform');
        if (transform && transform.mesh && this._scene) {
            this._scene.remove(transform.mesh);
        }
        this._ecs.destroyEntity(id);
        this._buyingEntered.delete(id);
        for (const sp of this._spawners) sp.liveIds.delete(id);
        EventBus.emit('customer:despawn', { entityId: id });
    }

    _onPurchaseResolved(customerId) {
        const customer = this._ecs?.getComponent(customerId, 'Customer');
        if (!customer) return;
        this._buyingEntered.delete(customerId);
        if (customer.state === 'buying') {
            customer.state = 'leaving';
        }
    }

    _releaseCustomersTargeting(stallId) {
        if (!this._ecs) return;
        const customerIds = this._ecs.queryEntities(['Customer']);
        for (const id of customerIds) {
            const c = this._ecs.getComponent(id, 'Customer');
            if (c && c.targetStallId === stallId &&
                (c.state === 'walking' || c.state === 'approaching')) {
                c.targetStallId = null;
                if (c.state === 'approaching') c.state = 'leaving';
            }
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    _findNearbyStockedStall(pos, ecs) {
        const stalls = ecs.queryEntities(['Transform', 'Stall', 'InventoryStack']);
        let bestId = null;
        let bestD  = MARKET_CONFIG.stallApproachRange;
        for (const stallId of stalls) {
            const stall = ecs.getComponent(stallId, 'Stall');
            const inv   = ecs.getComponent(stallId, 'InventoryStack');
            const t     = ecs.getComponent(stallId, 'Transform');
            if (!stall || !inv || !t) continue;
            if (inv.getCountByType(stall.productType) === 0) continue;
            const d = t.mesh.position.distanceTo(pos);
            if (d < bestD) { bestD = d; bestId = stallId; }
        }
        return bestId;
    }

    _steerToward(transform, target, speed, dt) {
        const pos = transform.mesh.position;
        const dir = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
        const len = dir.length();
        if (len < 0.0001) return;
        dir.multiplyScalar(1 / len);
        const step = Math.min(len, speed * dt);
        pos.x += dir.x * step;
        pos.z += dir.z * step;
        transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
}
