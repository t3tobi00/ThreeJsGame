export class Joystick {
    constructor() {
        this.active = false;
        this.origin = { x: 0, y: 0 };
        this.current = { x: 0, y: 0 };
        this.vector = { x: 0, y: 0 }; // Normalized -1 to 1

        this.container = document.getElementById('joystick-container');
        this.createElements();
        this.setupListeners();
    }

    createElements() {
        this.base = document.createElement('div');
        this.base.className = 'joystick-base';

        this.stick = document.createElement('div');
        this.stick.className = 'joystick-stick';

        this.base.appendChild(this.stick);
        this.container.appendChild(this.base);
    }

    setupListeners() {
        this.container.addEventListener('pointerdown', (e) => this.onDown(e));
        window.addEventListener('pointermove', (e) => this.onMove(e));
        window.addEventListener('pointerup', () => this.onUp());
    }

    onDown(e) {
        if (e.cancelable) e.preventDefault();
        this.active = true;
        this.origin = { x: e.clientX, y: e.clientY };
        this.current = { x: e.clientX, y: e.clientY };

        this.base.style.display = 'block';
        this.base.style.left = `${this.origin.x}px`;
        this.base.style.top = `${this.origin.y}px`;

        this.updateStick();
    }

    onMove(e) {
        if (!this.active) return;
        if (e.cancelable) e.preventDefault();

        this.current = { x: e.clientX, y: e.clientY };

        const dx = this.current.x - this.origin.x;
        const dy = this.current.y - this.origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Input deadzone
        if (dist < 8) {
            this.vector = { x: 0, y: 0 };
            this.updateStick();
            return;
        }

        const maxDist = Math.min(60, Math.min(window.innerWidth, window.innerHeight) * 0.08);

        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            this.current.x = this.origin.x + Math.cos(angle) * maxDist;
            this.current.y = this.origin.y + Math.sin(angle) * maxDist;
        }

        this.vector.x = (this.current.x - this.origin.x) / maxDist;
        this.vector.y = (this.current.y - this.origin.y) / maxDist;

        this.updateStick();
    }

    onUp() {
        this.active = false;
        this.vector = { x: 0, y: 0 };
        this.base.style.display = 'none';
        this.updateStick();
    }

    updateStick() {
        const dx = this.current.x - this.origin.x;
        const dy = this.current.y - this.origin.y;
        this.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    getVector() {
        return this.vector;
    }
}
