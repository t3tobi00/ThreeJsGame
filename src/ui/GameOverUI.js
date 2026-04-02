import EventBus from '../core/EventBus.js';

/**
 * GameOverUI — Full-screen overlay shown when player dies.
 * Listens to 'player:died' event. Restart reloads the page.
 */
export class GameOverUI {
    constructor() {
        this._overlay = document.createElement('div');
        this._overlay.id = 'game-over';
        this._overlay.innerHTML = `
            <div style="
                position: fixed; inset: 0; z-index: 2000;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                background: rgba(0,0,0,0.8);
            ">
                <div style="
                    font: bold 64px Arial, sans-serif; color: #ff4444;
                    text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
                    margin-bottom: 24px;
                ">GAME OVER</div>
                <button id="restart-btn" style="
                    padding: 14px 40px; border: none; border-radius: 10px;
                    background: #ff4444; color: white;
                    font: bold 22px Arial, sans-serif; cursor: pointer;
                    touch-action: manipulation;
                ">Restart</button>
            </div>
        `;
        this._overlay.style.display = 'none';
        document.body.appendChild(this._overlay);

        this._overlay.querySelector('#restart-btn').addEventListener('click', () => {
            window.location.reload();
        });

        EventBus.on('player:died', () => {
            this._overlay.style.display = 'block';
        });
    }
}
