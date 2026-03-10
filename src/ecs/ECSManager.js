/**
 * ECSManager — Central hub for the Entity-Component-System framework.
 * 
 * Responsibilities:
 * - Manage Entity IDs (numeric).
 * - Store Component data mapped to Entities.
 * - Manage active Systems.
 * - Provide querying for entities that match specific component requirements.
 */
export class ECSManager {
    constructor() {
        this.nextEntityId = 1;
        this.entities = new Set();
        /** @type {Map<number, Map<string, any>>} */
        this.components = new Map(); // EntityID -> (ComponentName -> ComponentData)

        /** @type {Array<{system: any, components: string[]}>} */
        this.systems = [];
    }

    /** Create a new blank entity ID. */
    createEntity() {
        const id = this.nextEntityId++;
        this.entities.add(id);
        this.components.set(id, new Map());
        return id;
    }

    /** Remove an entity and all its components. */
    destroyEntity(id) {
        this.entities.delete(id);
        this.components.delete(id);
    }

    /** 
     * Add a component instance to an entity. 
     * @param {number} entityId
     * @param {string} componentName e.g., 'Position'
     * @param {any} componentData Instance of a Component class
     */
    addComponent(entityId, componentName, componentData) {
        if (!this.components.has(entityId)) return;
        this.components.get(entityId).set(componentName, componentData);
    }

    /** Get a specific component from an entity. */
    getComponent(entityId, componentName) {
        const entityCompMap = this.components.get(entityId);
        return entityCompMap ? entityCompMap.get(componentName) : null;
    }

    /** Remove a component from an entity. */
    removeComponent(entityId, componentName) {
        const entityCompMap = this.components.get(entityId);
        if (entityCompMap) entityCompMap.delete(componentName);
    }

    /** Check if an entity has a specific set of components. */
    hasComponents(entityId, componentNames) {
        const entityCompMap = this.components.get(entityId);
        if (!entityCompMap) return false;
        return componentNames.every(name => entityCompMap.has(name));
    }

    /** 
     * Get all entities that possess AT LEAST the required components. 
     * @param {string[]} requiredComponents
     * @returns {number[]}
     */
    queryEntities(requiredComponents) {
        const matched = [];
        for (const entityId of this.entities) {
            if (this.hasComponents(entityId, requiredComponents)) {
                matched.push(entityId);
            }
        }
        return matched;
    }

    /** Register a system to be processed. */
    registerSystem(system, requiredComponents) {
        this.systems.push({ system, components: requiredComponents });
    }

    /** Update all registered systems. */
    update(deltaTime, ...args) {
        for (const { system, components } of this.systems) {
            const entities = this.queryEntities(components);
            system.update(entities, deltaTime, this, ...args);
        }
    }
}
