export class HUD {
    constructor() {
        this.container = document.getElementById('hud');
        this.createResourceCounter();
    }

    createResourceCounter() {
        this.meatCounter = document.createElement('div');
        this.meatCounter.className = 'hud-item';
        this.meatCounter.id = 'meat-counter';
        this.meatCounter.innerHTML = `
            <span class="icon">🥩</span>
            <span class="value">0</span>
        `;
        this.container.appendChild(this.meatCounter);
        this.valueText = this.meatCounter.querySelector('.value');
    }

    updateMeatCount(count) {
        if (this.valueText.textContent !== count.toString()) {
            this.valueText.textContent = count;
            this.animatePop();
        }
    }

    animatePop() {
        this.meatCounter.classList.remove('pop');
        // trigger reflow
        void this.meatCounter.offsetWidth;
        this.meatCounter.classList.add('pop');
    }
}
