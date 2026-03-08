import * as THREE from 'three';

export class ObjectPool {
    constructor(createFn, initialSize = 10, name = 'Pool') {
        this.createFn = createFn;
        this.pool = [];
        this.active = new Set();
        this.name = name;

        // Pre-warm the pool
        for (let i = 0; i < initialSize; i++) {
            const obj = this.createFn();
            obj.visible = false;
            this.pool.push(obj);
        }
    }

    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            console.warn(`[ObjectPool] ${this.name} exhausted, creating new object.`);
            obj = this.createFn();
        }

        obj.visible = true;
        this.active.add(obj);
        return obj;
    }

    release(obj) {
        if (this.active.has(obj)) {
            obj.visible = false;
            // Optionally reset physics/state here if needed, 
            // but individual systems usually handle that on 'get'
            this.active.delete(obj);
            this.pool.push(obj);
        }
    }

    clear() {
        this.pool = [];
        this.active.clear();
    }
}
