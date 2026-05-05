import EventBus from './EventBus.js';

/**
 * AudioManager — minimal Web Audio synth singleton. Zero external assets.
 *
 * Lazy AudioContext creation on first user gesture (mobile autoplay rules).
 * Synth-only: OscillatorNode + GainNode envelopes for tones; BufferSourceNode
 * with a white-noise buffer for thumps/grunts.
 *
 * Cue palette (per PROTOTYPE_PLAN L5.3 two-tier alert system):
 *   grunt          — player/ally hit                  (warning tier)
 *   chime_kill     — zombie kill                      (info tier)
 *   chime_build    — zone:built / zone:spawned        (info tier)
 *   chime_info     — state transition / soft ping     (info tier, quiet)
 *   alert_high     — Act 4 rival reveal sting         (critical tier)
 *   essence_fading — disk decay <3s warning           (warning tier)
 *   victory_chord  — Rival King death                 (victory)
 *   defeat_thud    — player death                     (defeat)
 *
 * Wiring is done in the constructor — listeners fire when their event
 * arrives. Pass `ecs` so we can filter `entity:damaged`/`entity:died`
 * by faction/tag (e.g., grunt only for player + allies, not zombies).
 */
export class AudioManager {
    constructor(ecs = null) {
        this.ecs = ecs;
        this._ctx = null;
        this._noiseBuffer = null;
        this._resumeBound = false;

        this._wireEvents();
    }

    /** Inject ECS later if it wasn't ready at construction. */
    setECS(ecs) { this.ecs = ecs; }

    // ─── Public ──────────────────────────────────────────────────

    /** Play a named cue. No-op on unknown name or before AudioContext is ready. */
    play(cueName) {
        const ctx = this._ensureContext();
        if (!ctx) return;
        const fn = this._cues[cueName];
        if (typeof fn !== 'function') return;
        try { fn.call(this, ctx); } catch (e) { /* swallow */ }
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

        // 1-second white-noise buffer reused by all noise-based cues.
        const sr = this._ctx.sampleRate;
        const buf = this._ctx.createBuffer(1, sr, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this._noiseBuffer = buf;

        // Mobile autoplay: context is born suspended on iOS / many Chromes.
        // Resume on the next user gesture. Once is enough.
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

    // ─── Cue palette ─────────────────────────────────────────────

    _cues = {
        grunt(ctx) {
            this._noiseBurst(ctx, { dur: 0.12, filterFreq: 400, gain: 0.4 });
        },
        chime_kill(ctx) {
            this._tone(ctx, { freq: 880, dur: 0.06, gain: 0.18, type: 'square' });
        },
        chime_info(ctx) {
            this._tone(ctx, { freq: 660, dur: 0.08, gain: 0.12, type: 'sine' });
        },
        chime_build(ctx) {
            const t0 = ctx.currentTime;
            this._tone(ctx, { freq: 523, dur: 0.15, gain: 0.2, type: 'sine' }, t0);          // C5
            this._tone(ctx, { freq: 784, dur: 0.18, gain: 0.2, type: 'sine' }, t0 + 0.10);   // G5
        },
        alert_high(ctx) {
            const t0 = ctx.currentTime;
            // Three-note descending stab
            this._tone(ctx, { freq: 1175, dur: 0.18, gain: 0.25, type: 'sawtooth' }, t0);
            this._tone(ctx, { freq: 880,  dur: 0.20, gain: 0.25, type: 'sawtooth' }, t0 + 0.12);
            this._tone(ctx, { freq: 587,  dur: 0.30, gain: 0.30, type: 'sawtooth' }, t0 + 0.24);
        },
        essence_fading(ctx) {
            this._noiseBurst(ctx, { dur: 0.4, filterFreq: 1200, filterSweepTo: 200, gain: 0.15 });
        },
        victory_chord(ctx) {
            const t0 = ctx.currentTime;
            // Major triad C-E-G stretched over 1.2s
            this._tone(ctx, { freq: 523, dur: 1.2, gain: 0.18, type: 'sine' }, t0);          // C5
            this._tone(ctx, { freq: 659, dur: 1.2, gain: 0.18, type: 'sine' }, t0 + 0.08);   // E5
            this._tone(ctx, { freq: 784, dur: 1.2, gain: 0.18, type: 'sine' }, t0 + 0.16);   // G5
        },
        defeat_thud(ctx) {
            this._noiseBurst(ctx, { dur: 0.8, filterFreq: 200, gain: 0.4 });
            this._tone(ctx, { freq: 80, dur: 0.8, gain: 0.3, type: 'sine' });
        },
        snarl(ctx) {
            // Guttural zombie growl — low sawtooth + filtered noise
            const t0 = ctx.currentTime;
            this._tone(ctx, { freq: 130, dur: 0.28, gain: 0.22, type: 'sawtooth' }, t0);
            this._tone(ctx, { freq: 95,  dur: 0.30, gain: 0.18, type: 'sawtooth' }, t0 + 0.05);
            this._noiseBurst(ctx, { dur: 0.32, filterFreq: 600, filterSweepTo: 200, gain: 0.28 });
        },
        spit_hiss(ctx) {
            // Wet hiss/intake during the spit windup
            this._noiseBurst(ctx, { dur: 0.28, filterFreq: 2400, filterSweepTo: 800, gain: 0.18 });
        },
        spit_splat(ctx) {
            // Wet splat when the spit lands
            const t0 = ctx.currentTime;
            this._noiseBurst(ctx, { dur: 0.18, filterFreq: 1200, filterSweepTo: 400, gain: 0.30 });
            this._tone(ctx, { freq: 180, dur: 0.10, gain: 0.18, type: 'square' }, t0);
        }
    };

    // ─── Synth primitives ────────────────────────────────────────

    _tone(ctx, opts, startAt = null) {
        const t0 = startAt ?? ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = opts.type || 'sine';
        osc.frequency.value = opts.freq;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(opts.gain, t0 + 0.005);       // 5ms attack
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);  // tail
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + opts.dur + 0.05);
    }

    _noiseBurst(ctx, opts) {
        if (!this._noiseBuffer) return;
        const t0 = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const f0 = opts.filterFreq || 800;
        filter.frequency.setValueAtTime(f0, t0);
        if (opts.filterSweepTo != null) {
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(20, opts.filterSweepTo), t0 + opts.dur);
        }
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(opts.gain ?? 0.3, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + opts.dur + 0.05);
    }

    // ─── Event wiring ────────────────────────────────────────────

    _wireEvents() {
        EventBus.on('entity:damaged', ({ entityId, silent }) => {
            if (silent) return;
            if (!this.ecs) return;
            const movement = this.ecs.getComponent(entityId, 'Movement');
            if (!movement) return;
            if (movement.faction === 'player' || movement.faction === 'ally') {
                this.play('grunt');
            }
            if (movement.faction === 'player') {
                this.play('snarl');
                EventBus.emit('camera:shake', { amount: 0.18, duration: 0.2 });
            }
        });

        EventBus.on('entity:died', ({ entityId }) => {
            if (!this.ecs) return;
            const tag = this.ecs.getComponent(entityId, 'Tag');
            // Rival-king death plays victory_chord via boss:killed handler below.
            if (tag?.has?.('rival-king')) return;
            const movement = this.ecs.getComponent(entityId, 'Movement');
            if (movement?.faction === 'enemy') this.play('chime_kill');
        });

        EventBus.on('zone:built',     () => this.play('chime_build'));
        EventBus.on('zone:spawned',   () => this.play('chime_build'));
        EventBus.on('essence:fading', () => this.play('essence_fading'));
        EventBus.on('audio:cue',      ({ name }) => this.play(name));
        EventBus.on('boss:killed',    () => this.play('victory_chord'));
        EventBus.on('player:died',    () => this.play('defeat_thud'));
    }
}

export default AudioManager;
