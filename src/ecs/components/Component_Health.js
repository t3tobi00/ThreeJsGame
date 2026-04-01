/**
 * Health — Entity hit points and armor.
 * hp: current health points.
 * maxHp: maximum health points.
 * armor: damage reduction amount.
 */
export class Component_Health {
    constructor({ hp = 3, maxHp = 3, armor = 0 } = {}) {
        this.hp = hp;
        this.maxHp = maxHp;
        this.armor = armor;
    }
}
