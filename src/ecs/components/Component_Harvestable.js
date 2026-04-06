/**
 * Component_Harvestable — Marks an entity as a resource node (tree, rock, etc.)
 * that can be damaged by harvest-type skills and respawns after death.
 *
 * The actual resource drops are handled by the existing Component_Drops +
 * HealthSystem + CollectorSystem pipeline. This component only carries the
 * info HarvestNodeSystem needs to respawn the node after it's destroyed.
 *
 * archetypeName + spawnPos are populated by EntityFactory after construction
 * so HarvestNodeSystem can recreate the entity from the same archetype at
 * the same world position.
 */
export class Component_Harvestable {
    constructor({ respawnTime = 15 } = {}) {
        this.respawnTime = respawnTime;

        // Populated by EntityFactory.create():
        this.archetypeName = null;
        this.spawnPos = null; // THREE.Vector3 clone
    }
}
