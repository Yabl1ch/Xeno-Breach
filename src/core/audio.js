/**
 * Procedural Web Audio synthesizer for all 11 weapons, movement, airlock alarms,
 * wave button trigger, loot drops, and 8 Polymer Glove abilities.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.muted = false;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = global.AudioContext || global.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch((err) => {
                    XB.log.warn('Audio', 'AudioContext resume deferred', err);
                });
            }
        }

        toggleMute() {
            this.muted = !this.muted;
            return this.muted;
        }

        _tone(type, freqStart, freqEnd, duration, volume, delay = 0) {
            if (this.muted || !this.ctx) return;
            const now = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(Math.max(20, freqStart), now);
            if (freqEnd !== freqStart) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
            }
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + duration + 0.01);
        }

        _noiseBurst(duration, filterFreq, volume, filterType = 'lowpass', delay = 0) {
            if (this.muted || !this.ctx) return;
            const sampleRate = this.ctx.sampleRate;
            const frameCount = Math.max(1, Math.floor(sampleRate * duration));
            const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < frameCount; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = filterType;
            filter.frequency.value = filterFreq;

            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime + delay;
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(now);
        }

        playShoot(weaponId) {
            if (this.muted || !this.ctx) return;
            switch (weaponId) {
                case 'rifle':
                    this._tone('sawtooth', 760, 145, 0.11, 0.14);
                    break;
                case 'shotgun':
                    this._noiseBurst(0.18, 920, 0.24);
                    this._tone('triangle', 235, 45, 0.21, 0.26);
                    break;
                case 'minigun':
                case 'vulcan_gatling':
                    this._noiseBurst(0.052, weaponId === 'vulcan_gatling' ? 1480 : 1220, 0.17);
                    this._tone('square', (weaponId === 'vulcan_gatling' ? 235 : 190) + Math.random() * 28, 52, 0.065, 0.17);
                    break;
                case 'smg':
                    this._tone('square', 880, 260, 0.065, 0.11);
                    break;
                case 'flamer':
                    this._noiseBurst(0.14, 650 + Math.random() * 240, 0.14);
                    break;
                case 'nova':
                    this._noiseBurst(0.28, 720, 0.25);
                    this._tone('sawtooth', 580, 38, 0.42, 0.28);
                    break;
                case 'polymer_beam':
                    this._tone('sawtooth', 1200, 160, 0.45, 0.24);
                    this._tone('sine', 420, 65, 0.48, 0.26);
                    this._noiseBurst(0.26, 2200, 0.18, 'bandpass');
                    break;
                case 'railgun':
                    this._tone('sawtooth', 1480, 92, 0.34, 0.22);
                    this._tone('sine', 340, 48, 0.35, 0.22);
                    break;
                case 'cryo_launcher':
                    this._tone('triangle', 540, 180, 0.18, 0.18);
                    this._noiseBurst(0.15, 2400, 0.14, 'highpass');
                    break;
                case 'hydra':
                    this._noiseBurst(0.2, 1400, 0.18);
                    this._tone('sawtooth', 420, 160, 0.18, 0.15);
                    break;
                case 'scar_h':
                    this._noiseBurst(0.11, 1650, 0.22);
                    this._tone('sawtooth', 520, 110, 0.14, 0.18);
                    break;
                case 'vss_vintorez':
                    this._noiseBurst(0.06, 980, 0.08, 'bandpass');
                    this._tone('sine', 340, 95, 0.08, 0.1);
                    break;
                case 'awp_arctic':
                    this._noiseBurst(0.22, 2600, 0.28);
                    this._tone('sawtooth', 980, 68, 0.28, 0.28);
                    break;
                case 'barrett_m82':
                    this._noiseBurst(0.32, 950, 0.34);
                    this._tone('sawtooth', 320, 32, 0.38, 0.34);
                    break;
                default:
                    this._noiseBurst(0.14, 2400, 0.15, 'bandpass');
                    this._tone('sawtooth', 980, 310, 0.16, 0.14);
            }
        }

        playChargeTick(ratio) {
            this._tone('sine', 240 + ratio * 780, 260 + ratio * 820, 0.08, 0.065);
        }

        playExplosion() {
            this._noiseBurst(0.55, 420, 0.35);
            this._tone('sine', 150, 24, 0.54, 0.36);
        }

        playJump(isPerfectBhop) {
            this._tone('sine', isPerfectBhop ? 310 : 180, isPerfectBhop ? 680 : 360, 0.095, isPerfectBhop ? 0.11 : 0.08);
        }

        playDash() {
            this._noiseBurst(0.18, 1650, 0.14);
            this._tone('triangle', 500, 160, 0.16, 0.13);
        }

        playSlide() {
            this._noiseBurst(0.24, 960, 0.12);
        }

        playBoost() {
            [330, 495, 660, 990].forEach((freq, i) => {
                this._tone('triangle', freq, freq * 1.12, 0.16, 0.12, i * 0.04);
            });
        }

        playGiantStomp(volumeScale) {
            const vol = Math.min(0.26, Math.max(0.02, volumeScale * 0.26));
            this._tone('sine', 78, 24, 0.26, vol);
        }

        playHit(isCrit) {
            this._tone('sine', isCrit ? 1320 : 880, isCrit ? 660 : 420, 0.065, 0.13);
        }

        playShieldBlock() {
            this._tone('triangle', 980, 1420, 0.09, 0.12);
        }

        playAlienDeath() {
            this._noiseBurst(0.22, 520, 0.18);
            this._tone('square', 350, 55, 0.26, 0.13);
        }

        playPlayerHurt(shieldAbsorbed) {
            this._tone(shieldAbsorbed ? 'sine' : 'sawtooth', shieldAbsorbed ? 460 : 165, shieldAbsorbed ? 180 : 50, 0.18, 0.2);
        }

        playReload() {
            this._tone('triangle', 420, 280, 0.08, 0.11, 0);
            this._tone('triangle', 680, 940, 0.08, 0.11, 0.18);
        }

        playPickup() {
            [523, 659, 880].forEach((freq, i) => {
                this._tone('sine', freq, freq, 0.13, 0.12, i * 0.05);
            });
        }

        playCoin() {
            this._tone('sine', 1180, 1580, 0.09, 0.1, 0);
            this._tone('sine', 1580, 1980, 0.11, 0.08, 0.045);
        }

        playCrystal() {
            [740, 1110, 1480].forEach((f, i) => {
                this._tone('triangle', f, f * 1.08, 0.18, 0.11, i * 0.045);
            });
        }

        playShopBuy() {
            [392, 523, 659, 784].forEach((f, i) => {
                this._tone('triangle', f, f, 0.16, 0.12, i * 0.04);
            });
        }

        playWaveButton() {
            [440, 660, 880, 1320].forEach((f, i) => {
                this._tone('sine', f, f * 1.05, 0.18, 0.14, i * 0.045);
            });
        }

        playWaveStart() {
            [220, 330, 440].forEach((freq, i) => {
                this._tone('sawtooth', freq, freq, 0.34, 0.08, i * 0.11);
            });
        }

        playAirlockAlarm() {
            this._tone('sawtooth', 520, 680, 0.16, 0.07, 0);
            this._tone('sawtooth', 680, 520, 0.18, 0.07, 0.17);
        }

        playWheelOpen() {
            this._tone('sine', 280, 560, 0.14, 0.09);
        }

        playWheelTick() {
            this._tone('sine', 920, 1080, 0.04, 0.06);
        }

        playGloveCast(powerId) {
            if (powerId === 'shield') {
                this._tone('sine', 240, 720, 0.3, 0.18);
                this._tone('triangle', 480, 960, 0.28, 0.12, 0.04);
            } else if (powerId === 'freeze') {
                this._noiseBurst(0.4, 3400, 0.18, 'highpass');
                this._tone('sine', 1420, 520, 0.38, 0.15);
            } else if (powerId === 'fire') {
                this._noiseBurst(0.45, 780, 0.24, 'lowpass');
                this._tone('sawtooth', 320, 95, 0.36, 0.18);
            } else if (powerId === 'timeslow') {
                this._tone('sine', 640, 160, 0.55, 0.22);
                this._tone('triangle', 920, 260, 0.45, 0.14);
            } else if (powerId === 'knockback') {
                this._noiseBurst(0.32, 950, 0.28);
                this._tone('sawtooth', 260, 48, 0.38, 0.28);
            } else if (powerId === 'timestop') {
                this._tone('sine', 420, 38, 0.72, 0.3);
                this._tone('triangle', 1200, 180, 0.52, 0.15);
                this._noiseBurst(0.3, 1800, 0.12, 'bandpass');
            } else if (powerId === 'telekinesis') {
                this._tone('sine', 180, 640, 0.28, 0.18);
                this._tone('sawtooth', 140, 65, 0.32, 0.16, 0.28);
            } else if (powerId === 'polymer_turret') {
                this._tone('triangle', 260, 620, 0.22, 0.16);
                this._tone('sine', 520, 880, 0.18, 0.14, 0.08);
            } else if (powerId === 'shock_siphon') {
                this._noiseBurst(0.24, 2400, 0.18, 'bandpass');
                this._tone('sawtooth', 840, 320, 0.3, 0.18);
            }
        }

        playBuildPlace() {
            this._tone('triangle', 210, 480, 0.11, 0.14, 0);
            this._tone('sine', 420, 680, 0.12, 0.12, 0.05);
        }

        playBuildUpgrade() {
            [330, 520, 790].forEach((f, i) => {
                this._tone('triangle', f, f * 1.15, 0.12, 0.12, i * 0.035);
            });
        }

        playTurretShot(isGatling) {
            if (isGatling) {
                this._noiseBurst(0.038, 1550, 0.075);
                this._tone('square', 220 + Math.random() * 30, 85, 0.04, 0.07);
            } else {
                this._tone('sine', 780, 290, 0.08, 0.085);
            }
        }

        playPolySphereLaunch(chargeSec) {
            const pScale = Math.min(2.0, 1 + chargeSec * 0.18);
            this._noiseBurst(0.32, 1800, 0.22);
            this._tone('sawtooth', 320 * pScale, 55, 0.55, 0.26);
            this._tone('sine', 640 * pScale, 90, 0.6, 0.22, 0.04);
        }
    }

    XB.SoundEngine = SoundEngine;
})(window);
