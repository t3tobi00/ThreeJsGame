import * as THREE from 'three';

export class FloatingUI {
    constructor(camera) {
        this.camera = camera;
        this.container = document.getElementById('ui-layer');
        this.elements = new Map(); // Map of object -> HTMLElement
    }

    add(targetObject, label = '0', icon = '🥩') {
        const el = document.createElement('div');
        el.className = 'floating-ui';
        el.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="value">${label}</span>
        `;
        this.container.appendChild(el);
        this.elements.set(targetObject, el);
        return el;
    }

    remove(targetObject) {
        const el = this.elements.get(targetObject);
        if (el) {
            el.remove();
            this.elements.delete(targetObject);
        }
    }

    updateLabel(targetObject, label) {
        const el = this.elements.get(targetObject);
        if (el) {
            const valueText = el.querySelector('.value');
            if (valueText.textContent !== label.toString()) {
                valueText.textContent = label;
                this.animatePop(el);
            }
        }
    }

    animatePop(el) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }

    update() {
        this.elements.forEach((el, target) => {
            const vector = new THREE.Vector3();
            target.updateWorldMatrix(true, false);
            vector.setFromMatrixPosition(target.matrixWorld);

            // Offset to be above the object
            vector.y += 2.0;

            vector.project(this.camera);

            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.transform = `translate(-50%, -100%)`;

            // Occlusion check (simplistic)
            if (vector.z > 1) {
                el.style.display = 'none';
            } else {
                el.style.display = 'flex';
            }
        });
    }
}
