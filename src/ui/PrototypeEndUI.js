import EventBus from '../core/EventBus.js';

/**
 * PrototypeEndUI — Stats screen + Play Again button shown at end of a
 * ?prototype run. Two variants:
 *   • Victory  — fired on state:entered { id: 'END' }
 *   • Defeat   — fired on player:died
 *
 * Reads counters from PrototypeStats.getSummary(). Restart calls
 * window.location.reload() — the ?prototype URL flag persists naturally.
 *
 * Mirrors src/ui/GameOverUI.js (HTML overlay, single button). HTML is the
 * accepted exception for one-shot end-of-run UI per the user's
 * "3D-parented over HTML" rule.
 */
export class PrototypeEndUI {
    /** @param {PrototypeStats} stats */
    constructor(stats) {
        this.stats = stats;
        this._shown = false;

        this._overlay = document.createElement('div');
        this._overlay.id = 'prototype-end-ui';
        this._overlay.style.display = 'none';
        document.body.appendChild(this._overlay);

        EventBus.on('state:entered', ({ id }) => {
            if (id === 'END') this._show('victory');
        });
        EventBus.on('player:died', () => this._show('defeat'));
    }

    _show(kind) {
        if (this._shown) return;
        this._shown = true;

        const summary = this.stats?.getSummary?.() || {};
        const isVictory = kind === 'victory';
        const title = isVictory ? 'YOU WIN' : 'DEFEATED';
        const titleColor = isVictory ? '#44dd66' : '#ff4444';

        const totalSec = summary.timeSec ?? 0;
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec % 60;
        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

        this._overlay.innerHTML = `
            <div style="
                position: fixed; inset: 0; z-index: 2000;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                background: rgba(0, 0, 0, 0.85);
                font-family: Arial, sans-serif;
                color: white;
            ">
                <div style="
                    font: bold 64px Arial, sans-serif;
                    color: ${titleColor};
                    text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
                    margin-bottom: 28px;
                    letter-spacing: 2px;
                ">${title}</div>
                <div style="
                    background: rgba(255, 255, 255, 0.08);
                    padding: 20px 36px;
                    border-radius: 12px;
                    margin-bottom: 28px;
                    min-width: 280px;
                    line-height: 1.6;
                    font-size: 18px;
                ">
                    <div>Zombies killed: <b>${summary.zombiesKilled ?? 0}</b></div>
                    <div>Time: <b>${timeStr}</b></div>
                    <div>Peak essence: <b>${summary.peakEssence ?? 0}</b></div>
                    <div>Peak wood: <b>${summary.peakWood ?? 0}</b></div>
                    <div>Survived: <b>${summary.survived ? 'YES' : 'NO'}</b></div>
                    <div>Killed Rival King: <b>${summary.killedRivalKing ? 'YES' : 'NO'}</b></div>
                </div>
                <button id="prototype-play-again" style="
                    padding: 14px 40px; border: none; border-radius: 10px;
                    background: ${titleColor};
                    color: white;
                    font: bold 22px Arial, sans-serif; cursor: pointer;
                    touch-action: manipulation;
                ">Play Again</button>
            </div>
        `;
        this._overlay.style.display = 'block';

        this._overlay.querySelector('#prototype-play-again').addEventListener('click', () => {
            window.location.reload();
        });
    }
}

export default PrototypeEndUI;
