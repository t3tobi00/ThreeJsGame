import EventBus from './EventBus.js';

/**
 * AudioManager — sample-based audio with optional positional 3D playback.
 *
 * Lazy AudioContext on first user gesture (mobile autoplay). Samples are
 * preloaded into a single master GainNode. Positional cues route through a
 * PannerNode (distance-attenuated) whose position is the world-space emit
 * point; the listener follows the player so "near = loud, far = quiet"
 * always reads relative to the player.
 *
 * Two playback shapes:
 *   one-shot: `play(name)` / `playAt(name, pos)` — fire-and-forget
 *   looped:   `startLoop(entityId, name, pos)` / `stopLoop(entityId)`
 *             — used by the zombie moan, position updated each frame.
 *
 * Multi-shot source clips: loadSample() scans the buffer for shot onsets and
 * stores per-shot {offset, duration} regions. _playSample() picks one at
 * random per call, so a 7-shot recording gives 7 natural variations for free.
 */

const SAMPLES = {
    gunshot:        'assets/audio/gunshot.wav',
    spear_thrust:   'assets/audio/spear_thrust.mp3',
    flame_thrower:  'assets/audio/flame_thrower.mp3',
    archer:         'assets/audio/archer.mp3',
    zombie_bite:    'assets/audio/zombie_bite.mp3',
    zombie_moaning: 'assets/audio/zombie_moaning.mp3',
    chopping_wood:  'assets/audio/chopping_wood.mp3',
};

// Per-cue defaults. `ref`/`max`/`rolloff` only apply to positional playback.
const CUES = {
    gunshot:        { gain: 0.9, pitchVar: 0.04, gainVar: 0.10 },
    spear_thrust:   { gain: 0.8, pitchVar: 0.05, ref: 5, max: 35 },
    flame_thrower:  { gain: 0.7, pitchVar: 0.03, ref: 5, max: 35 },
    archer:         { gain: 0.8, pitchVar: 0.06, ref: 5, max: 35 },
    zombie_bite:    { gain: 0.6, pitchVar: 0.08, ref: 4, max: 25 },
    chopping_wood:  { gain: 0.7, pitchVar: 0.05, ref: 5, max: 25 },
    zombie_moaning: { gain: 0.25, ref: 3, max: 18, rolloff: 1.5 },
};

export class AudioManager {
    constructor(ecs = null) {
        this.ecs = ecs;
        this.playerId = null;
        this._ctx = null;
        this._master = null;
        this._samples = Object.create(null);   // name → { buffer, shots }
        this._loops = new Map();               // entityId → { src, panner, gain }
        this._resumeBound = false;
        this._scannedExisting = false;

        for (const [name, url] of Object.entries(SAMPLES)) {
            this.loadSample(name, url);
        }

        this._bindEvents();
    }

    setECS(ecs)    { this.ecs = ecs; }
    setPlayer(id)  { this.playerId = id; }

    // ─── Public playback ─────────────────────────────────────────

    play(name, opts = {}) {
        const ctx = this._ensureContext();
        if (!ctx) return;
        const cue = CUES[name] || {};
        this._playSample(name, { ...cue, ...opts });
    }

    playAt(name, position, opts = {}) {
        if (!position) return this.play(name, opts);
        this.play(name, { ...opts, position });
    }

    startLoop(entityId, name, position) {
        if (this._loops.has(entityId)) return;
        const ctx = this._ensureContext();
        if (!ctx) return;
        const entry = this._samples[name];
        if (!entry || !this._master) return;
        const cue = CUES[name] || {};

        const src = ctx.createBufferSource();
        src.buffer = entry.buffer;
        src.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = cue.gain ?? 0.3;

        const panner = this._makePanner(cue);
        if (position) this._setPannerPos(panner, position);

        src.connect(gain).connect(panner).connect(this._master);
        // Random start offset so 20 zombies don't moan in unison.
        const offset = Math.random() * entry.buffer.duration;
        src.start(0, offset);
        this._loops.set(entityId, { src, panner, gain });
    }

    stopLoop(entityId) {
        const loop = this._loops.get(entityId);
        if (!loop) return;
        try { loop.src.stop(); } catch (e) { /* already stopped */ }
        this._loops.delete(entityId);
    }

    /**
     * Per-frame: listener anchored to player; loop panners track their entities.
     * Called from main.js animate(). Safe to call before ctx resumes.
     */
    update(_dt) {
        if (!this._ctx || !this.ecs) return;

        if (this.playerId != null) {
            const tr = this.ecs.getComponent(this.playerId, 'Transform');
            if (tr?.mesh) this._setListenerPos(tr.mesh.position);
        }

        for (const [entityId, loop] of this._loops) {
            const tr = this.ecs.getComponent(entityId, 'Transform');
            if (!tr?.mesh) { this.stopLoop(entityId); continue; }
            this._setPannerPos(loop.panner, tr.mesh.position);
        }

        // Catch zombies that existed before AudioManager bound (level-load pre-spawns).
        if (!this._scannedExisting && this._master) {
            this._scannedExisting = true;
            this._scanZombiesForLoops();
        }
    }

    async loadSample(name, url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arrayBuffer = await res.arrayBuffer();
            const ctx = this._ensureContext();
            if (!ctx) return;
            const buffer = await ctx.decodeAudioData(arrayBuffer);
            this._samples[name] = {
                buffer,
                shots: this._detectShots(buffer)
            };
        } catch (e) {
            console.warn(`AudioManager: failed to load '${name}' from ${url}:`, e);
        }
    }

    // ─── Event wiring ────────────────────────────────────────────

    _bindEvents() {
        // Generic cue (player gunshot). Optional `pos` upgrades it to positional.
        EventBus.on('audio:cue', ({ name, pos }) => {
            if (pos) this.playAt(name, pos);
            else this.play(name);
        });

        // Hero melee + zombie bite — attacker class drives the sound.
        EventBus.on('entity:attacked', ({ attackerId }) => {
            this._playForAttacker(attackerId);
        });

        // Spitter — reuse zombie_bite per locked spec.
        EventBus.on('zombie:spit:windup', ({ attackerId }) => {
            const pos = this._posOf(attackerId);
            if (pos) this.playAt('zombie_bite', pos);
        });

        // Wood chop (player axe + worker).
        EventBus.on('worker:chop:swing', ({ hitPos }) => {
            if (hitPos) this.playAt('chopping_wood', hitPos);
        });

        // Cemetery emerge → start the moan loop.
        EventBus.on('spawn:emerged', ({ zombieId }) => {
            const pos = this._posOf(zombieId);
            if (pos) this.startLoop(zombieId, 'zombie_moaning', pos);
        });

        // Any death → drop the loop slot if we held one.
        EventBus.on('entity:died', ({ entityId }) => {
            if (this._loops.has(entityId)) this.stopLoop(entityId);
        });
    }

    _playForAttacker(attackerId) {
        if (!this.ecs) return;
        const tag      = this.ecs.getComponent(attackerId, 'Tag');
        const movement = this.ecs.getComponent(attackerId, 'Movement');
        const pos      = this._posOf(attackerId);
        if (!pos) return;

        if      (tag?.has?.('scout'))           this.playAt('spear_thrust',  pos);
        else if (tag?.has?.('bruiser'))         this.playAt('flame_thrower', pos);
        else if (tag?.has?.('sharpshooter'))    this.playAt('archer',        pos);
        else if (movement?.faction === 'enemy') this.playAt('zombie_bite',   pos);
    }

    _posOf(entityId) {
        const tr = this.ecs?.getComponent(entityId, 'Transform');
        return tr?.mesh?.position || null;
    }

    _scanZombiesForLoops() {
        if (!this.ecs) return;
        const ids = this.ecs.queryEntities(['Transform', 'EnemyAI']);
        for (const id of ids) {
            if (this._loops.has(id)) continue;
            const pos = this._posOf(id);
            if (pos) this.startLoop(id, 'zombie_moaning', pos);
        }
    }

    // ─── Audio context ───────────────────────────────────────────

    _ensureContext() {
        if (this._ctx) return this._ctx;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            console.warn('AudioManager: Web Audio API not available');
            return null;
        }
        this._ctx = new Ctx();

        this._master = this._ctx.createGain();
        this._master.gain.value = 0.8;
        this._master.connect(this._ctx.destination);

        if (this._ctx.state === 'suspended' && !this._resumeBound) {
            this._resumeBound = true;
            const resume = () => {
                this._ctx.resume().catch(() => {});
                window.removeEventListener('pointerdown', resume);
                window.removeEventListener('keydown', resume);
                window.removeEventListener('touchstart', resume);
            };
            window.addEventListener('pointerdown', resume, { once: true });
            window.addEventListener('keydown', resume, { once: true });
            window.addEventListener('touchstart', resume, { once: true });
        }
        return this._ctx;
    }

    // ─── Listener / Panner positioning ───────────────────────────

    _setListenerPos(p) {
        const L = this._ctx.listener;
        if (L.positionX) {
            L.positionX.value = p.x;
            L.positionY.value = p.y;
            L.positionZ.value = p.z;
        } else if (L.setPosition) {
            L.setPosition(p.x, p.y, p.z);
        }
    }

    _setPannerPos(panner, p) {
        if (panner.positionX) {
            panner.positionX.value = p.x;
            panner.positionY.value = p.y;
            panner.positionZ.value = p.z;
        } else if (panner.setPosition) {
            panner.setPosition(p.x, p.y, p.z);
        }
    }

    _makePanner(cue) {
        const panner = this._ctx.createPanner();
        panner.panningModel  = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance   = cue.ref     ?? 5;
        panner.maxDistance   = cue.max     ?? 30;
        panner.rolloffFactor = cue.rolloff ?? 1;
        return panner;
    }

    // ─── Onset detection (multi-shot source clips) ───────────────

    /**
     * Scan an AudioBuffer for amplitude bursts separated by silence; return
     * one {offset, duration} per detected shot. Falls back to the whole
     * buffer when nothing meaningful is detected.
     *
     * Algorithm: 10 ms peak envelope on channel 0, threshold = 5% of peak,
     * a shot ends after 80 ms of sub-threshold tail.
     */
    _detectShots(buffer) {
        const sr = buffer.sampleRate;
        const data = buffer.getChannelData(0);
        const hopSamples = Math.max(1, Math.floor(sr * 0.01));
        const envelope = new Float32Array(Math.ceil(data.length / hopSamples));
        let maxAmp = 0;
        for (let bin = 0; bin < envelope.length; bin++) {
            const i = bin * hopSamples;
            const end = Math.min(i + hopSamples, data.length);
            let peak = 0;
            for (let j = i; j < end; j++) {
                const a = Math.abs(data[j]);
                if (a > peak) peak = a;
            }
            envelope[bin] = peak;
            if (peak > maxAmp) maxAmp = peak;
        }
        if (maxAmp === 0) return [{ offset: 0, duration: buffer.duration }];

        const thresh = maxAmp * 0.05;
        const gapBins = 8;
        const shots = [];
        let inShot = false;
        let startBin = 0;
        for (let i = 0; i < envelope.length; i++) {
            const above = envelope[i] > thresh;
            if (above && !inShot) {
                inShot = true;
                startBin = i;
            } else if (!above && inShot) {
                let isGap = true;
                const limit = Math.min(i + gapBins, envelope.length);
                for (let k = i; k < limit; k++) {
                    if (envelope[k] > thresh) { isGap = false; break; }
                }
                if (isGap) {
                    shots.push({
                        offset:   (startBin * hopSamples) / sr,
                        duration: ((i - startBin) * hopSamples) / sr
                    });
                    inShot = false;
                }
            }
        }
        if (inShot) {
            shots.push({
                offset:   (startBin * hopSamples) / sr,
                duration: ((envelope.length - startBin) * hopSamples) / sr
            });
        }
        if (shots.length === 0) return [{ offset: 0, duration: buffer.duration }];
        return shots;
    }

    // ─── Playback primitives ─────────────────────────────────────

    /**
     * Play one shot region of a loaded sample. If multiple regions were
     * detected, picks one at random. Routes through a PannerNode when
     * `opts.position` is set; otherwise straight to master.
     */
    _playSample(name, opts = {}) {
        const ctx = this._ctx;
        const entry = this._samples[name];
        if (!ctx || !entry || !this._master) return;

        const src = ctx.createBufferSource();
        src.buffer = entry.buffer;

        const pitchVar = opts.pitchVar || 0;
        if (pitchVar) {
            src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchVar;
        }
        const gainVar = opts.gainVar || 0;
        const baseGain = opts.gain ?? 1;
        const g = ctx.createGain();
        g.gain.value = baseGain * (1 + (Math.random() * 2 - 1) * gainVar);

        src.connect(g);
        if (opts.position) {
            const panner = this._makePanner(opts);
            this._setPannerPos(panner, opts.position);
            g.connect(panner);
            panner.connect(this._master);
        } else {
            g.connect(this._master);
        }

        const shots = entry.shots;
        const shot = shots[Math.floor(Math.random() * shots.length)];
        src.start(0, shot.offset, shot.duration);
    }
}

export default AudioManager;
