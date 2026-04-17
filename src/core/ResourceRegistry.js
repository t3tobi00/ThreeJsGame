import MeshPresets from './MeshPresets.js';

let _resources = {};

const ResourceRegistry = {
    async load(path = './src/config/resources.json') {
        const response = await fetch(path);
        _resources = await response.json();
    },

    get(type) {
        const def = _resources[type];
        if (!def) {
            console.warn(`ResourceRegistry: unknown resource type '${type}'`);
            return null;
        }
        return def;
    },

    createMesh(type, state = 'ground') {
        const def = this.get(type);
        if (!def) {
            return MeshPresets.create('disk', { color: 0x999999 });
        }
        const spec = (state === 'stacked' ? def.meshStacked : def.meshGround) || def.mesh;
        if (!spec) {
            console.warn(`ResourceRegistry: no mesh spec for '${type}' (state='${state}')`);
            return MeshPresets.create('disk', { color: 0x999999 });
        }
        const opts = { ...spec };
        if (typeof opts.color === 'string') {
            opts.color = parseInt(opts.color, 16);
        }
        const mesh = MeshPresets.create(opts.preset, opts);
        mesh.userData.resourceType = type;
        return mesh;
    },

    types() {
        return Object.keys(_resources);
    }
};

export default ResourceRegistry;
