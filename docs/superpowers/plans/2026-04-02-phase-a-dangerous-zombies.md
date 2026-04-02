# Phase A: Dangerous Zombies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make zombies dangerous — they deal contact damage to player and attack walls. Player can die (game over screen). This creates real stakes in the game.

**Architecture:** New `ContactDamageSystem` checks proximity between entities with `ContactDamage` component and nearby damageable targets (player, walls). Emits `entity:damaged` events — existing `HealthSystem` handles HP reduction and death. New `GameOverUI` listens for player death. HUD gets an HP bar.

**Tech Stack:** Three.js, pure ECS (Entity-Component-System), EventBus pub/sub, ES modules, no bundler.

---

## File Structure

**New files:**
| File | Responsibility |
|------|---------------|
| `src/ecs/components/Component_ContactDamage.js` | Data: damage amount, cooldown, attack range, target factions |
| `src/systems/ContactDamageSystem.js` | Logic: proximity checks, cooldown timer, emits `entity:damaged` |
| `src/ui/GameOverUI.js` | HTML overlay: "GAME OVER" text + restart button |

**Modified files:**
| File | Change |
|------|--------|
| `src/config/archetypes/player.json` | Add `Health` component (hp: 10) |
| `src/config/archetypes/enemy.json` | Add `ContactDamage` component |
| `src/config/archetypes/speeder.json` | Add `ContactDamage` component |
| `src/config/archetypes/tank.json` | Add `ContactDamage` component |
| `src/entities/EntityFactory.js` | Register `ContactDamage` in COMPONENT_MAP |
| `src/core/ArchetypeLoader.js` | No change needed (enemy archetypes already registered) |
| `src/systems/HealthSystem.js` | Emit `player:died` event when player entity dies |
| `src/ui/HUD.js` | Add HP bar display |
| `src/main.js` | Register `ContactDamageSystem`, wire `GameOverUI` |
| `src/systems/EnemySystem.js` | Add wall-targeting: if blocked by wall, stop and attack it |

---

### Task 1: Player Health + HP Bar in HUD

**Files:**
- Modify: `src/config/archetypes/player.json`
- Modify: `src/ui/HUD.js`
- Modify: `src/systems/HealthSystem.js`

- [ ] **Step 1: Add Health component to player archetype**

In `src/config/archetypes/player.json`, add Health to components:

```json
"Health": { "hp": 10, "maxHp": 10, "armor": 0 }
```

Add it after the `"Collector"` line in the components object.

- [ ] **Step 2: Add HP bar to HUD**

In `src/ui/HUD.js`, add an HP bar element. After the constructor's `this._ensureItem('meat')` line, add:

```javascript
this._createHPBar();
```

Add this method to the HUD class:

```javascript
_createHPBar() {
    this._hpBar = document.createElement('div');
    this._hpBar.id = 'hp-bar';
    this._hpBar.innerHTML = `
        <div class="hp-label">\u2764\uFE0F</div>
        <div class="hp-track">
            <div class="hp-fill" style="width: 100%"></div>
        </div>
    `;
    this._hpBar.style.cssText = `
        display: flex; align-items: center; gap: 6px;
        margin-top: 8px; padding: 4px 10px;
        background: rgba(0,0,0,0.5); border-radius: 8px;
    `;
    const track = this._hpBar.querySelector('.hp-track');
    track.style.cssText = `
        width: 100px; height: 10px; background: rgba(255,255,255,0.2);
        border-radius: 5px; overflow: hidden;
    `;
    const fill = this._hpBar.querySelector('.hp-fill');
    fill.style.cssText = `
        height: 100%; background: #ff4444; border-radius: 5px;
        transition: width 0.3s ease;
    `;
    this.container.appendChild(this._hpBar);
    this._hpFill = fill;
}

updateHP(hp, maxHp) {
    if (!this._hpFill) return;
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this._hpFill.style.width = `${pct}%`;
    this._hpFill.style.background = pct > 50 ? '#44cc44' : pct > 25 ? '#ffaa00' : '#ff4444';
}
```

- [ ] **Step 3: HealthSystem emits player:died and entity:damaged with entityId for HUD**

In `src/systems/HealthSystem.js`, add after `health.hp -= actualDamage;` (before the death check):

```javascript
// Notify HUD of HP change
EventBus.emit('entity:hp_changed', {
    entityId,
    hp: health.hp,
    maxHp: health.maxHp
});
```

Inside the death block (after `ecs.destroyEntity(entityId)`), add:

```javascript
if (tag && tag.has('player')) {
    EventBus.emit('player:died', { entityId, position: pos });
}
```

**Important:** The `player:died` emit must go BEFORE `ecs.destroyEntity(entityId)` but AFTER `scene.remove`. Move the destroyEntity call to be last.

- [ ] **Step 4: HUD listens for HP changes**

In `src/ui/HUD.js`, add in the constructor after the existing `stack:changed` listener:

```javascript
EventBus.on('entity:hp_changed', ({ entityId, hp, maxHp }) => {
    if (entityId === this._playerId) {
        this.updateHP(hp, maxHp);
    }
});
```

- [ ] **Step 5: Verify in browser**

Open game in browser. Player should now have an HP bar in the HUD showing full green health. Nothing damages the player yet.

- [ ] **Step 6: Commit**

```bash
git add src/config/archetypes/player.json src/ui/HUD.js src/systems/HealthSystem.js
git commit -m "feat(phase-a): add player Health component + HP bar in HUD"
```

---

### Task 2: ContactDamage Component + System

**Files:**
- Create: `src/ecs/components/Component_ContactDamage.js`
- Create: `src/systems/ContactDamageSystem.js`
- Modify: `src/entities/EntityFactory.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create Component_ContactDamage**

Create `src/ecs/components/Component_ContactDamage.js`:

```javascript
/**
 * ContactDamage — Entity deals damage on contact with nearby targets.
 * damage: HP removed per hit.
 * cooldown: seconds between hits.
 * range: proximity distance for contact.
 * targetFactions: which factions to damage (e.g. ["player", "structure"]).
 */
export class Component_ContactDamage {
    constructor({
        damage = 1,
        cooldown = 1.0,
        range = 1.2,
        targetFactions = ['player']
    } = {}) {
        this.damage = damage;
        this.cooldown = cooldown;
        this.range = range;
        this.targetFactions = targetFactions;
        // Runtime
        this.timeSinceLastHit = 999;
    }
}
```

- [ ] **Step 2: Create ContactDamageSystem**

Create `src/systems/ContactDamageSystem.js`:

```javascript
import EventBus from '../core/EventBus.js';

/**
 * ContactDamageSystem — Entities with ContactDamage hurt nearby targets.
 *
 * Queries: ['Transform', 'ContactDamage']
 * Checks all entities with Health + Tag for faction matching.
 * Emits: 'entity:damaged' { entityId, damage }
 */
export class ContactDamageSystem {
    update(entities, deltaTime, ecs) {
        // Find all potential targets (entities with Health + Transform)
        const targets = ecs.queryEntities(['Transform', 'Health']);

        for (const attackerId of entities) {
            const attackerTransform = ecs.getComponent(attackerId, 'Transform');
            const contact = ecs.getComponent(attackerId, 'ContactDamage');
            if (!attackerTransform || !contact) continue;

            contact.timeSinceLastHit += deltaTime;
            if (contact.timeSinceLastHit < contact.cooldown) continue;

            const attackerPos = attackerTransform.mesh.position;

            for (const targetId of targets) {
                if (targetId === attackerId) continue;

                const targetTransform = ecs.getComponent(targetId, 'Transform');
                if (!targetTransform) continue;

                // Check faction match
                const targetTag = ecs.getComponent(targetId, 'Tag');
                const targetMovement = ecs.getComponent(targetId, 'Movement');
                const faction = targetMovement ? targetMovement.faction : null;
                const tags = targetTag ? targetTag.tags : [];

                const isTarget = contact.targetFactions.some(f =>
                    f === faction || tags.includes(f)
                );
                if (!isTarget) continue;

                const dist = attackerPos.distanceTo(targetTransform.mesh.position);
                if (dist > contact.range) continue;

                // Deal damage
                contact.timeSinceLastHit = 0;
                EventBus.emit('entity:damaged', {
                    entityId: targetId,
                    damage: contact.damage
                });
                break; // one target per cooldown cycle
            }
        }
    }
}
```

- [ ] **Step 3: Register in EntityFactory**

In `src/entities/EntityFactory.js`, add import:

```javascript
import { Component_ContactDamage } from '../ecs/components/Component_ContactDamage.js';
```

Add to COMPONENT_MAP:

```javascript
ContactDamage: (d) => new Component_ContactDamage(d),
```

- [ ] **Step 4: Register system in main.js**

In `src/main.js`, add import:

```javascript
import { ContactDamageSystem } from './systems/ContactDamageSystem.js';
```

In `init()`, after the `healthSystem` registration, add:

```javascript
this.contactDamageSystem = new ContactDamageSystem();
this.ecs.registerSystem(this.contactDamageSystem, ['Transform', 'ContactDamage']);
```

- [ ] **Step 5: Add ContactDamage to enemy archetypes**

In `src/config/archetypes/enemy.json`, add to components:

```json
"ContactDamage": { "damage": 1, "cooldown": 1.0, "range": 1.2, "targetFactions": ["player", "structure"] }
```

In `src/config/archetypes/speeder.json`, add to components:

```json
"ContactDamage": { "damage": 1, "cooldown": 0.8, "range": 1.0, "targetFactions": ["player", "structure"] }
```

In `src/config/archetypes/tank.json`, add to components:

```json
"ContactDamage": { "damage": 2, "cooldown": 1.5, "range": 1.5, "targetFactions": ["player", "structure"] }
```

- [ ] **Step 6: Verify in browser**

Open game. Let a zombie walk into the player. HP bar should decrease. Player flash animation should trigger. Multiple zombies should stack damage.

- [ ] **Step 7: Commit**

```bash
git add src/ecs/components/Component_ContactDamage.js src/systems/ContactDamageSystem.js src/entities/EntityFactory.js src/main.js src/config/archetypes/enemy.json src/config/archetypes/speeder.json src/config/archetypes/tank.json
git commit -m "feat(phase-a): ContactDamage component + system — zombies hurt player"
```

---

### Task 3: Game Over Screen

**Files:**
- Create: `src/ui/GameOverUI.js`
- Modify: `src/main.js`

- [ ] **Step 1: Create GameOverUI**

Create `src/ui/GameOverUI.js`:

```javascript
import EventBus from '../core/EventBus.js';

/**
 * GameOverUI — Full-screen overlay shown when player dies.
 * Listens to 'player:died' event. Restart reloads the page.
 */
export class GameOverUI {
    constructor() {
        this._overlay = document.createElement('div');
        this._overlay.id = 'game-over';
        this._overlay.innerHTML = `
            <div style="
                position: fixed; inset: 0; z-index: 2000;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                background: rgba(0,0,0,0.8);
            ">
                <div style="
                    font: bold 64px Arial, sans-serif; color: #ff4444;
                    text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
                    margin-bottom: 24px;
                ">GAME OVER</div>
                <button id="restart-btn" style="
                    padding: 14px 40px; border: none; border-radius: 10px;
                    background: #ff4444; color: white;
                    font: bold 22px Arial, sans-serif; cursor: pointer;
                    touch-action: manipulation;
                ">Restart</button>
            </div>
        `;
        this._overlay.style.display = 'none';
        document.body.appendChild(this._overlay);

        this._overlay.querySelector('#restart-btn').addEventListener('click', () => {
            window.location.reload();
        });

        EventBus.on('player:died', () => {
            this._overlay.style.display = 'block';
        });
    }
}
```

- [ ] **Step 2: Wire in main.js**

In `src/main.js`, add import:

```javascript
import { GameOverUI } from './ui/GameOverUI.js';
```

In `loadLevel()`, after `this.hud = new HUD(this.ecs, this.playerId);`, add:

```javascript
this.gameOverUI = new GameOverUI();
```

- [ ] **Step 3: Verify in browser**

Let zombies kill the player. Game Over screen should appear with red text and a restart button. Clicking restart reloads the page.

- [ ] **Step 4: Commit**

```bash
git add src/ui/GameOverUI.js src/main.js
git commit -m "feat(phase-a): Game Over screen on player death"
```

---

### Task 4: Zombies Attack Walls

**Files:**
- Modify: `src/config/archetypes/wall.json`
- Modify: `src/systems/EnemySystem.js`

- [ ] **Step 1: Ensure wall archetype has structure tag**

Read `src/config/archetypes/wall.json`. Ensure it has:

```json
"Tag": { "tags": ["structure", "wall"] }
```

If the Tag component is missing, add it. The `"structure"` tag is what `ContactDamageSystem` targets via `targetFactions: ["player", "structure"]`.

- [ ] **Step 2: Update EnemySystem to stop at walls**

In `src/systems/EnemySystem.js`, update the steering loop. Replace the simple chase logic with wall-aware logic. The enemy should stop moving when touching a wall (within contact range) and let ContactDamageSystem handle the damage:

```javascript
update(entities, deltaTime, ecs) {
    this._ecs = ecs;
    this._spawnTimer += deltaTime;

    if (this._spawnTimer >= ENEMY_CONFIG.spawnInterval) {
        this._spawnTimer = 0;
        this._spawnEnemy();
    }

    const playerPos = this._playerTransform.mesh.position;
    const walls = ecs.queryEntities(['Transform', 'Health', 'Tag']);

    for (const entityId of entities) {
        const transform = ecs.getComponent(entityId, 'Transform');
        const movement = ecs.getComponent(entityId, 'Movement');
        const health = ecs.getComponent(entityId, 'Health');
        if (!transform || !movement || !health) continue;
        if (health.hp <= 0) continue;

        const pos = transform.mesh.position;

        // Check if blocked by a wall
        let blocked = false;
        for (const wallId of walls) {
            const wallTag = ecs.getComponent(wallId, 'Tag');
            if (!wallTag || !wallTag.has('structure')) continue;
            const wallTransform = ecs.getComponent(wallId, 'Transform');
            if (!wallTransform) continue;

            const distToWall = pos.distanceTo(wallTransform.mesh.position);
            if (distToWall < 1.5) {
                blocked = true;
                // Face the wall
                const wallDir = new THREE.Vector3().subVectors(wallTransform.mesh.position, pos);
                if (wallDir.length() > 0.1) {
                    transform.mesh.rotation.y = Math.atan2(wallDir.x, wallDir.z);
                }
                break;
            }
        }

        if (blocked) continue; // ContactDamageSystem handles the attack

        // Chase player
        const dir = new THREE.Vector3().subVectors(playerPos, pos);
        if (dir.length() > 0.5) {
            dir.normalize();
            pos.addScaledVector(dir, movement.speed * deltaTime);
            transform.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
    }
}
```

- [ ] **Step 3: Verify in browser**

Place a wall (via unlock zone or level JSON). Zombies should:
1. Walk toward player
2. If wall is in the way, stop and attack it (HP decreases)
3. Wall flashes red (FlashAnim already wired)
4. When wall is destroyed, zombie continues toward player

- [ ] **Step 4: Commit**

```bash
git add src/config/archetypes/wall.json src/systems/EnemySystem.js
git commit -m "feat(phase-a): zombies stop at walls and attack them"
```

---

### Task 5: Add FlashAnim to player for damage feedback

**Files:**
- Modify: `src/config/archetypes/player.json`

- [ ] **Step 1: Add FlashAnim to player archetype**

In `src/config/archetypes/player.json`, ensure the components include:

```json
"FlashAnim": { "color": "0xff0000", "duration": 0.15, "onEvent": "entity:damaged" }
```

This makes the player flash red when hit by a zombie, providing visual feedback.

- [ ] **Step 2: Verify in browser**

Let a zombie touch the player. Player should flash red. HP bar should decrease. Multiple zombies = faster damage.

- [ ] **Step 3: Commit**

```bash
git add src/config/archetypes/player.json
git commit -m "feat(phase-a): player flashes red when taking zombie damage"
```

---

## Verification Checklist

After all tasks:
1. [ ] Player has HP bar (green > yellow > red as HP drops)
2. [ ] Zombie touches player → player takes 1 damage, flashes red
3. [ ] Multiple zombies stack damage (each on its own cooldown)
4. [ ] Player HP reaches 0 → Game Over screen with restart button
5. [ ] Restart button reloads the game
6. [ ] Zombie reaches wall → stops, attacks wall, wall flashes
7. [ ] Wall HP reaches 0 → wall destroyed, zombie continues
8. [ ] Speeder deals 1 damage (fast cooldown), Tank deals 2 damage (slow cooldown)
