/**
 * Component_SkillLoadout — Which skill this entity is currently using.
 *
 * A skill is a JSON definition in src/config/skills/*.json, loaded at startup
 * into the SkillRegistry. This component just references it by id.
 *
 * One active skill per entity (swappable at runtime by mutating activeSkill).
 */
export class Component_SkillLoadout {
    /**
     * @param {Object} options
     * @param {string} options.activeSkill Skill id, e.g. 'pistol', 'bow', 'punch', 'pickaxe'
     */
    constructor({ activeSkill = null } = {}) {
        this.activeSkill = activeSkill;
    }
}
