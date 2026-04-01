/**
 * Tag — String labels for an entity. Used by systems to filter targets.
 * tags: array of strings, e.g. ['player'], ['enemy'], ['table', 'storage'].
 */
export class Component_Tag {
    constructor({ tags = [] } = {}) {
        // Accept both object form {tags:[...]} and legacy string form ('player')
        if (typeof tags === 'string') {
            this.tags = [tags];
        } else {
            this.tags = [...tags];
        }
    }

    has(tag) {
        return this.tags.includes(tag);
    }
}
