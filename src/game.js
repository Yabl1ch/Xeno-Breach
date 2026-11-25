/**
 * Main XenoBreachGame Orchestrator.
 * Connects 3-floor MapBuilder, 120Hz PlayerController, ViewModelRig (11 weapons + attachments + glove),
 * Robot EnemySystem (Melee Tanks vs Ranged Specialists), CombatSystem (Polymer Gun, 8 Glove Abilities,
 * Shield-Break Polymer Wave), Intermission Wave-Button Trigger, and 4-Tab Armory Workshop.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class XenoBreachGame {
        constructor() {
            this.sound = new XB.SoundEngine();

            this.state = 'MENU';
            this.waveState = 'COMBAT'; // 'COMBAT' | 'INTERMISSION'
            this.score = 0;
            this.kills = 0;
            this.coins = 0;
            this.crystals = 0;
            this.wave = 1;
            this.waveSpawning = false;
            this.enemiesToSpawn = [];
            this.spawnTimer = 0;

            // Armor progression
            this.armorIndex = 0;
            this.unlockedArmors = new Set([0]);
            this.armorPlateLvl = 0;
            this.armorCapLvl = 0;
            this.armorServoLvl = 0;

            this.hp = 100;
            this.shield = 90;
            this.lastDamageTime = 0;

            this.boostCharges = 2;
            this.maxBoostCharges = 3;
            this.boostActiveTimer = 0;
            this.boostRechargeTimer = 0;
            this.medkitCount = 2;
            this.maxMedkits = 4;

            // 12 Weapons -> 6 Active Combat Slots [1..6] + Levels + Attachments
            this.unlockedWeapons = new Set([0, 1, 2, 3, 4, 5]);
            this.equippedWeaponSlots = [0, 1, 2, 3, 4, 5];
            this.activeWeaponSlot = 0;
            this.weaponLevels = XB.WEAPONS.map(() => 1);
            this.ownedAttachments = XB.WEAPONS.map(() => new Set());
            this.equippedAttachments = XB.WEAPONS.map(() => ({ barrel: null, mag: null, optic: null, core: null }));
            this.ammo = XB.WEAPONS.map(w => w.maxAmmo);

            this.fireCooldown = 0;
            this.reloading = false;
            this.reloadTimer = 0;
            this.currentReloadDur = 1.0;
            this.isCharging = false;
            this.chargeTime = 0;
            this.pumpedPolymer = 0;
            this.chargeTickAcc = 0;

            // Input state
            this.keys = {};
            this.mouseDown = false;
            this.isPointerLocked = false;
            this.dragLooking = false;
            this.lastMouse = { x: 0, y: 0 };
            this.qHoldTimer = null;
            this.qOpenedWheel = false;

            this.isTouchDevice = ('ontouchstart' in global) || navigator.maxTouchPoints > 0;
            this.joyInput = { x: 0, y: 0 };
            this.lookTouchId = null;
            this.lastTouchLook = { x: 0, y: 0 };

            this.activeDoorIndices = [1, 2];

            this.bannerTimer = 0;
            this.hitmarkerTimer = 0;
            this.fxTimer = 0;
            this.toastTimer = 0;

            this._initThree();
            const maxAniso = (this.renderer.capabilities && typeof this.renderer.capabilities.getMaxAnisotropy === 'function')
                ? Math.min(8, Math.max(1, this.renderer.capabilities.getMaxAnisotropy()))
                : 4;
            this.map = new XB.MapBuilder(this.scene, maxAniso);
            this.map.build();

            this.player = new XB.PlayerController(this.map, this.sound);
            this.vm = new XB.ViewModelRig(this.camera);
            this.enemies = new XB.EnemySystem(this.scene, this.map, this.sound);
            this.building = new XB.BuildingSystem(this.scene, this.camera, this.map, this.enemies, this.sound);
            this.combat = new XB.CombatSystem(this.scene, this.camera, this.map, this.enemies, this.vm, this.sound);
            this.ui = new XB.HudAndShopUI(this);

            this.clock = new THREE.Clock();

            this._bindEvents();
            this._subscribeBus();
            this.ui.syncHUD();

            global.__XB_GAME__ = this;
        }

        _initThree() {
            this.canvas = document.getElementById('three-canvas');
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x040b08);
            this.scene.fog = new THREE.FogExp2(0x06140f, 0.0046);

            this.camera = new THREE.PerspectiveCamera(78, global.innerWidth / global.innerHeight, 0.1, 440);
            this.camera.rotation.order = 'YXZ';
            this.scene.add(this.camera);

            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(global.innerWidth, global.innerHeight);
            this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            if (typeof THREE.sRGBEncoding !== 'undefined') {
                this.renderer.outputEncoding = THREE.sRGBEncoding;
            }
            if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 1.12;
            }
        }

        _subscribeBus() {
            XB.events.on('hud:sync', () => this.ui.syncHUD());
            XB.events.on('camera:shake', ({ intensity }) => {
                this.player.cameraShake = Math.max(this.player.cameraShake, intensity || 0);
            });
            XB.events.on('combat:hit', ({ kill }) => {
                this.ui.hitmarker.classList.add('show');
                this.ui.hitmarker.classList.toggle('kill', Boolean(kill));
                this.hitmarkerTimer = 0.14;
            });
            XB.events.on('player:hardLand', ({ pos }) => {
                const armor = this.getEffectiveArmor();
                if (armor.slamOnLand && this.state === 'PLAYING') {
                    this.combat.triggerKineticLandSlam(pos, this.getCombatContext());
                }
            });
        }

        getActiveWeaponIndex() {
            return this.equippedWeaponSlots[this.activeWeaponSlot] ?? 0;
        }

        getEffectiveArmor() {
            const base = XB.ARMORS[this.armorIndex] || XB.ARMORS[0];
            const servoMult = 1 + this.armorServoLvl * 0.04;
            return {
                ...base,
                maxHp: base.maxHp + this.armorPlateLvl * 25,
                maxShield: base.maxShield + this.armorCapLvl * 25,
                shieldRegenRate: base.shieldRegenRate * (1 + this.armorCapLvl * 0.1),
                speedMult: base.speedMult * servoMult,
                airAccelMult: base.airAccelMult * servoMult,
                bhopMaxSpeed: Math.round(base.bhopMaxSpeed * servoMult * 10) / 10
            };
        }

        getCombatContext() {
            const armor = this.getEffectiveArmor();
            const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
            return {
                playerPos: this.player.pos,
                playerVel: this.player.vel,
                playerEyeHeight: this.player.currentEyeHeight,
                cameraDir: camDir,
                armor,
                coins: this.coins,
                crystals: this.crystals,
                building: this.building,
                combat: this.combat,
                turrets: this.building.turrets,
                waveState: this.waveState,
                timeStopActive: this.combat.timeStopTimer > 0,
                timeSlowActive: this.combat.timeSlowTimer > 0,
                showToast: (msg, color) => this.showToast(msg, color),
                spendResources: (coinCost, polyCost) => {
                    this.coins = Math.max(0, this.coins - (coinCost || 0));
                    this.combat.polymerEnergy = Math.max(0, this.combat.polymerEnergy - (polyCost || 0));
                },
                restoreShield: (amt) => {
                    this.shield = Math.min(armor.maxShield, this.shield + amt);
                    this.triggerScreenFX('fx-shield');
                    this.ui.syncHUD();
                },
                restoreShieldSilent: (amt) => {
                    this.shield = Math.min(armor.maxShield, this.shield + amt);
                },
                restoreHpAndShield: (hpAmt, shAmt) => {
                    this.hp = Math.min(armor.maxHp, this.hp + hpAmt);
                    this.shield = Math.min(armor.maxShield, this.shield + shAmt);
                    this.triggerScreenFX('fx-heal');
                    this.ui.syncHUD();
                },
                damagePlayer: (amt, srcPos) => this.damagePlayer(amt, srcPos),
                onAlienKilled: (alien) => this.onAlienKilled(alien),
                onDamageAlien: (a, dmg, pt, col, isHead) => this.combat.damageAlien(a, dmg, pt, col, isHead, 1.75, this.getCombatContext()),
                onDamagePlayer: (amt, srcPos) => this.damagePlayer(amt, srcPos),
                onDamageStructure: (st, dmg, attacker) => this.building.damageStructure(st, dmg, attacker, this.getCombatContext()),
                spawnParticles: (p, c, n, s) => this.combat._spawnParticles(p, c, n, s),
                spawnShockwave: (p, r, c, l) => this.combat._spawnShockwave(p, r, c, l),
                onCollectPickup: (pk, silent) => this.onCollectPickup(pk, silent),
                onWaveButtonHit: () => this.onWaveButtonHit()
            };
        }

        // =====================================================================
        // INPUT BINDINGS
        // =====================================================================
        _bindEvents() {
            global.addEventListener('resize', () => {
                this.camera.aspect = global.innerWidth / global.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(global.innerWidth, global.innerHeight);
            });

            global.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && this.state === 'PLAYING') e.preventDefault();
                if (e.code === 'Tab' && (this.state === 'PLAYING' || this.state === 'SHOP')) e.preventDefault();

                const wasDown = Boolean(this.keys[e.code]);
                this.keys[e.code] = true;

                if (this.state === 'PLAYING') {
                    if (e.code === 'Space' && !wasDown) this.player.queueJump();

                    if (this.ui.wheelOpen) {
                        if (e.code === 'KeyQ' && !wasDown) { this.ui.setWheelHover(0); this.ui.closeWheel(true); return; }
                        if (e.code === 'KeyE' && !wasDown) { this.ui.setWheelHover(1); this.ui.closeWheel(true); return; }
                        if ((e.code === 'KeyR' || e.code === 'KeyF') && !wasDown) { this.ui.setWheelHover(2); this.ui.closeWheel(true); return; }
                        if (e.code === 'KeyT' && !wasDown) { this.ui.setWheelHover(3); this.ui.closeWheel(true); return; }
                        if (e.code === 'KeyV' && !wasDown) { this.ui.setWheelHover(4); this.ui.closeWheel(true); return; }
                        if (e.code === 'KeyY' && !wasDown) { this.ui.setWheelHover(5); this.ui.closeWheel(true); return; }
                        if (e.code === 'Escape') { this.ui.closeWheel(false); return; }
                    }

                    // Toggle Fortnite/Rust Tactical Building Mode [C]
                    if (e.code === 'KeyC' && !wasDown) {
                        const on = this.building.toggleBuildMode();
                        this.isCharging = false;
                        this.mouseDown = false;
                        this.ui.elChargeWrap.classList.remove('show');
                        this.ui.rebuildBuildBar();
                        this.showToast(on ? 'РЕЖИМ СТРОЙКИ [1-6] ЧЕРТЁЖ • [ЛКМ] ПОСТРОИТЬ • [R] ПОВОРОТ' : 'РЕЖИМ БОЯ', '#4ade80');
                        this.ui.syncHUD();
                        return;
                    }

                    // Apply Wall Attachment [U] to targeted player-built wall
                    if (e.code === 'KeyU' && !wasDown) {
                        this.building.tryAttachModToHoveredWall(this.getCombatContext());
                        this.ui.syncHUD();
                    }

                    if (this.building.buildMode) {
                        if (e.code === 'Digit1') { this.building.selectBlueprint(0); this.ui.rebuildBuildBar(); }
                        if (e.code === 'Digit2') { this.building.selectBlueprint(1); this.ui.rebuildBuildBar(); }
                        if (e.code === 'Digit3') { this.building.selectBlueprint(2); this.ui.rebuildBuildBar(); }
                        if (e.code === 'Digit4') { this.building.selectBlueprint(3); this.ui.rebuildBuildBar(); }
                        if (e.code === 'Digit5') { this.building.selectBlueprint(4); this.ui.rebuildBuildBar(); }
                        if (e.code === 'Digit6') { this.building.selectBlueprint(5); this.ui.rebuildBuildBar(); }
                        if (e.code === 'KeyR' && !wasDown) { this.building.rotateBlueprint(); }
                    } else {
                        // 6 Active Weapon Slots [1..6]
                        if (e.code === 'Digit1') this.selectWeaponSlot(0);
                        if (e.code === 'Digit2') this.selectWeaponSlot(1);
                        if (e.code === 'Digit3') this.selectWeaponSlot(2);
                        if (e.code === 'Digit4') this.selectWeaponSlot(3);
                        if (e.code === 'Digit5') this.selectWeaponSlot(4);
                        if (e.code === 'Digit6') this.selectWeaponSlot(5);
                        if (e.code === 'KeyR' && !wasDown) this.startReload();
                    }

                    if (e.code === 'KeyZ' && !wasDown) this.activateSpeedBoost();
                    if (e.code === 'KeyX' && !wasDown) this.useMedkit();
                    if (e.code === 'ControlLeft' && !wasDown) {
                        this.player.tryStartSlide(this.getEffectiveArmor(), this.boostActiveTimer > 0);
                    }
                    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !wasDown) {
                        this.player.tryDash(this.keys, this.joyInput, XB.WEAPONS[this.getActiveWeaponIndex()], this.getEffectiveArmor(), this.boostActiveTimer > 0);
                    }

                    // Hold Q -> 6-Sector Radial Wheel, Tap Q -> Active Slot 0
                    if (e.code === 'KeyQ' && !wasDown) {
                        this.qOpenedWheel = false;
                        if (this.qHoldTimer) clearTimeout(this.qHoldTimer);
                        this.qHoldTimer = setTimeout(() => {
                            if (this.state === 'PLAYING' && this.keys['KeyQ']) {
                                this.qOpenedWheel = true;
                                this.ui.openWheel();
                            }
                        }, 165);
                    }
                    if (e.code === 'KeyG' && !wasDown) {
                        if (this.ui.wheelOpen) this.ui.closeWheel(false);
                        else this.ui.openWheel();
                    }

                    if (e.code === 'KeyE' && !wasDown) this.combat.castGloveSlot(1, this.getCombatContext());
                    if (e.code === 'KeyF' && !wasDown) {
                        if (this._isNearArmoryTerminal()) this.openShop();
                        else this.combat.castGloveSlot(2, this.getCombatContext());
                    }
                    if (e.code === 'KeyT' && !wasDown) this.combat.castGloveSlot(3, this.getCombatContext());
                    if (e.code === 'KeyV' && !wasDown) this.combat.castGloveSlot(4, this.getCombatContext());
                    if (e.code === 'KeyY' && !wasDown) this.combat.castGloveSlot(5, this.getCombatContext());

                    if ((e.code === 'KeyB' || e.code === 'Tab') && !wasDown) this.openShop();
                    if (e.code === 'KeyP' && !wasDown) this.pauseGame();
                } else if (this.state === 'SHOP' && !wasDown) {
                    if (e.code === 'KeyB' || e.code === 'Tab' || e.code === 'Escape') this.closeShop();
                } else if (this.state === 'PAUSED' && !wasDown) {
                    if (e.code === 'KeyP' || e.code === 'Escape') this.resumeGame();
                }
            });

            global.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
                if (e.code === 'KeyQ') {
                    if (this.qHoldTimer) { clearTimeout(this.qHoldTimer); this.qHoldTimer = null; }
                    if (this.ui.wheelOpen) this.ui.closeWheel(true);
                    else if (!this.qOpenedWheel && this.state === 'PLAYING') {
                        this.combat.castGloveSlot(0, this.getCombatContext());
                    }
                    this.qOpenedWheel = false;
                }
            });

            global.addEventListener('wheel', (e) => {
                if (this.state !== 'PLAYING' || this.ui.wheelOpen) return;
                const dir = e.deltaY > 0 ? 1 : -1;
                if (this.building.buildMode) {
                    const count = XB.BUILD_BLUEPRINTS.length;
                    this.building.selectBlueprint((this.building.selectedBlueprintIdx + dir + count) % count);
                    this.ui.rebuildBuildBar();
                    return;
                }
                this.selectWeaponSlot((this.activeWeaponSlot + dir + 6) % 6);
            }, { passive: true });

            document.addEventListener('pointerlockchange', () => {
                this.isPointerLocked = (document.pointerLockElement === this.canvas);
                if (this.isPointerLocked) {
                    this.ui.elPointerHint.style.opacity = '0';
                } else if (this.state === 'PLAYING' && !this.isTouchDevice) {
                    this.ui.elPointerHint.style.opacity = '1';
                }
            });

            global.addEventListener('mousemove', (e) => {
                if (this.state !== 'PLAYING') return;
                if (this.ui.wheelOpen) {
                    if (this.isPointerLocked) {
                        this.ui.moveWheelCursor(e.movementX, e.movementY);
                    } else {
                        const rect = this.ui.elWheelContainer.getBoundingClientRect();
                        const dx = e.clientX - (rect.left + rect.width / 2);
                        const dy = e.clientY - (rect.top + rect.height / 2);
                        this.ui.wheelCursorX = 0;
                        this.ui.wheelCursorY = 0;
                        this.ui.moveWheelCursor(dx, dy);
                    }
                    return;
                }

                const sens = 0.0022;
                if (this.isPointerLocked) {
                    this.player.yaw -= e.movementX * sens;
                    this.player.pitch = Math.max(-1.3, Math.min(1.3, this.player.pitch - e.movementY * sens));
                } else if (this.dragLooking) {
                    const dx = e.clientX - this.lastMouse.x;
                    const dy = e.clientY - this.lastMouse.y;
                    this.lastMouse.x = e.clientX;
                    this.lastMouse.y = e.clientY;
                    this.player.yaw -= dx * 0.0045;
                    this.player.pitch = Math.max(-1.3, Math.min(1.3, this.player.pitch - dy * 0.0045));
                }
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (this.state !== 'PLAYING') return;
                this.sound.init();
                if (this.ui.wheelOpen) { this.ui.closeWheel(e.button === 0); return; }
                if (!this.isPointerLocked && !this.isTouchDevice) this._requestPointerLockSafe();

                if (e.button === 0) {
                    if (this.building.buildMode) {
                        this.building.tryPlaceCurrentBlueprint(this.player.pos, this.getCombatContext());
                        this.ui.syncHUD();
                        return;
                    }
                    this.mouseDown = true;
                    const w = XB.WEAPONS[this.getActiveWeaponIndex()];
                    if (w.kind === 'charge' || w.kind === 'polymer_sphere') this._beginCharge();
                    else this.tryFire();

                    if (!this.isPointerLocked) {
                        this.dragLooking = true;
                        this.lastMouse.x = e.clientX;
                        this.lastMouse.y = e.clientY;
                    }
                } else if (e.button === 2) {
                    if (this.building.buildMode) {
                        const nextAtt = this.building.cycleWallAttachment();
                        this.ui.rebuildBuildBar();
                        if (nextAtt) this.showToast(`ОБВЕС ДЛЯ [U]: ${nextAtt.name}`, nextAtt.color);
                        return;
                    }
                    this.dragLooking = true;
                    this.lastMouse.x = e.clientX;
                    this.lastMouse.y = e.clientY;
                }
            });

            global.addEventListener('mouseup', (e) => {
                if (e.button === 0 && this.isCharging) this._releaseChargeShot();
                this.mouseDown = false;
                this.dragLooking = false;
            });

            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

            document.getElementById('btn-start').addEventListener('click', () => this.startGame());
            document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
            document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
            document.getElementById('btn-restart-pause').addEventListener('click', () => this.startGame());
            document.getElementById('btn-pause').addEventListener('click', () => { if (this.state === 'PLAYING') this.pauseGame(); });
            document.getElementById('btn-shop').addEventListener('click', () => { if (this.state === 'PLAYING') this.openShop(); });
            document.getElementById('btn-sound').addEventListener('click', () => {
                const muted = this.sound.toggleMute();
                document.getElementById('icon-sound-on').style.display = muted ? 'none' : 'inline';
                document.getElementById('icon-sound-off').style.display = muted ? 'inline' : 'none';
            });

            this.ui.elBoostChip.addEventListener('click', () => { if (this.state === 'PLAYING') this.activateSpeedBoost(); });
            this.ui.elMedkitChip.addEventListener('click', () => { if (this.state === 'PLAYING') this.useMedkit(); });

            this._setupTouchControls();
        }

        _requestPointerLockSafe() {
            try {
                if (this.canvas.requestPointerLock) {
                    const res = this.canvas.requestPointerLock();
                    if (res && typeof res.catch === 'function') res.catch((err) => XB.log.info('Input', 'PointerLock declined', err));
                }
            } catch (err) {
                XB.log.warn('Input', 'PointerLock unavailable', err);
            }
        }

        _exitPointerLockSafe() {
            if (document.pointerLockElement) {
                try { document.exitPointerLock(); } catch (err) { XB.log.warn('Input', 'Exit pointerLock failed', err); }
            }
        }

        _setupTouchControls() {
            const joyZone = document.getElementById('joystick-zone');
            const joyKnob = document.getElementById('joystick-knob');
            let joyTouchId = null;
            const maxDist = 38;

            const updateJoy = (touch) => {
                const rect = joyZone.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                let dx = touch.clientX - cx;
                let dy = touch.clientY - cy;
                const dist = Math.hypot(dx, dy);
                if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
                joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                this.joyInput.x = dx / maxDist;
                this.joyInput.y = dy / maxDist;
            };

            joyZone.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; joyTouchId = t.identifier; updateJoy(t); }, { passive: false });
            joyZone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) { if (t.identifier === joyTouchId) updateJoy(t); } }, { passive: false });
            const resetJoy = (e) => { for (const t of e.changedTouches) { if (t.identifier === joyTouchId) { joyTouchId = null; this.joyInput.x = 0; this.joyInput.y = 0; joyKnob.style.transform = 'translate(0px, 0px)'; } } };
            joyZone.addEventListener('touchend', resetJoy);
            joyZone.addEventListener('touchcancel', resetJoy);

            this.canvas.addEventListener('touchstart', (e) => { if (this.state !== 'PLAYING') return; const t = e.changedTouches[0]; if (this.lookTouchId === null) { this.lookTouchId = t.identifier; this.lastTouchLook.x = t.clientX; this.lastTouchLook.y = t.clientY; } }, { passive: true });
            this.canvas.addEventListener('touchmove', (e) => { if (this.state !== 'PLAYING') return; for (const t of e.changedTouches) { if (t.identifier === this.lookTouchId) { const dx = t.clientX - this.lastTouchLook.x; const dy = t.clientY - this.lastTouchLook.y; this.lastTouchLook.x = t.clientX; this.lastTouchLook.y = t.clientY; this.player.yaw -= dx * 0.0052; this.player.pitch = Math.max(-1.28, Math.min(1.28, this.player.pitch - dy * 0.0045)); } } }, { passive: true });
            const endLook = (e) => { for (const t of e.changedTouches) { if (t.identifier === this.lookTouchId) this.lookTouchId = null; } };
            this.canvas.addEventListener('touchend', endLook);
            this.canvas.addEventListener('touchcancel', endLook);

            const fireBtn = document.getElementById('touch-fire-btn');
            fireBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.sound.init();
                this.mouseDown = true;
                const w = XB.WEAPONS[this.getActiveWeaponIndex()];
                if (w.kind === 'charge' || w.kind === 'polymer_sphere') this._beginCharge();
                else this.tryFire();
            }, { passive: false });
            fireBtn.addEventListener('touchend', () => { if (this.isCharging) this._releaseChargeShot(); this.mouseDown = false; });

            document.getElementById('touch-reload-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.startReload(); }, { passive: false });
            document.getElementById('touch-weapon-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.selectWeaponSlot((this.activeWeaponSlot + 1) % 6); }, { passive: false });
            document.getElementById('touch-jump-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.player.queueJump(); }, { passive: false });
            document.getElementById('touch-slide-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.player.tryStartSlide(this.getEffectiveArmor(), this.boostActiveTimer > 0); }, { passive: false });
            document.getElementById('touch-dash-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.player.tryDash(this.keys, this.joyInput, XB.WEAPONS[this.getActiveWeaponIndex()], this.getEffectiveArmor(), this.boostActiveTimer > 0); }, { passive: false });
            document.getElementById('touch-boost-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.activateSpeedBoost(); }, { passive: false });
            document.getElementById('touch-med-btn').addEventListener('touchstart', (e) => { e.preventDefault(); this.useMedkit(); }, { passive: false });
            document.getElementById('touch-glove-btn').addEventListener('touchstart', (e) => { e.preventDefault(); if (this.ui.wheelOpen) this.ui.closeWheel(false); else this.ui.openWheel(); }, { passive: false });
        }

        // =====================================================================
        // GAME LIFECYCLE & SHOP ACTIONS
        // =====================================================================
        startGame() {
            this.sound.init();
            this.enemies.clearAll();
            this.building.reset();
            this.combat.reset();
            this.player.reset();
            this.map.resetBarrels();
            this.map.setWaveButtonsVisible(false);

            this.score = 0;
            this.kills = 0;
            this.coins = 0;
            this.crystals = 0;
            this.wave = 1;
            this.waveState = 'COMBAT';

            this.armorIndex = 0;
            this.unlockedArmors = new Set([0]);
            this.armorPlateLvl = 0;
            this.armorCapLvl = 0;
            this.armorServoLvl = 0;
            const armor = this.getEffectiveArmor();
            this.hp = armor.maxHp;
            this.shield = armor.maxShield;

            this.boostCharges = 2;
            this.boostActiveTimer = 0;
            this.boostRechargeTimer = 0;
            this.medkitCount = 2;

            this.unlockedWeapons = new Set([0, 1, 2, 3, 4, 5]);
            this.equippedWeaponSlots = [0, 1, 2, 3, 4, 5];
            this.activeWeaponSlot = 0;
            this.weaponLevels = XB.WEAPONS.map(() => 1);
            this.ownedAttachments = XB.WEAPONS.map(() => new Set());
            this.equippedAttachments = XB.WEAPONS.map(() => ({ barrel: null, mag: null, optic: null, core: null }));
            this.ammo = XB.WEAPONS.map(w => w.maxAmmo);

            this.reloading = false;
            this.reloadTimer = 0;
            this.isCharging = false;
            this.chargeTime = 0;
            this.pumpedPolymer = 0;
            this.ui.elChargeWrap.classList.remove('show');
            this.ui.screenFx.className = '';

            this.ui.rebuildGloveUI();
            this.ui.rebuildWeaponBar();
            this.ui.rebuildBuildBar();
            this.selectWeaponSlot(0);

            this.map.staticPads.forEach(pad => {
                pad.respawnTimer = 0;
                pad.activePickup = this.combat.spawnPickup(pad.x, pad.z, pad.type, true, 1);
            });

            this.state = 'PLAYING';
            this.ui.startScreen.classList.add('hidden');
            this.ui.pauseScreen.classList.add('hidden');
            this.ui.shopScreen.classList.add('hidden');
            this.ui.gameoverScreen.classList.add('hidden');
            this.ui.hud.style.display = 'block';
            this.ui.crosshair.style.display = 'flex';
            if (this.isTouchDevice) {
                this.ui.touchControls.style.display = 'block';
                this.ui.elPointerHint.style.display = 'none';
            } else {
                this._requestPointerLockSafe();
            }

            this.ui.syncHUD();
            this._startWave(1);
        }

        pauseGame() {
            if (this.ui.wheelOpen) this.ui.closeWheel(false);
            this.state = 'PAUSED';
            this.mouseDown = false;
            this.isCharging = false;
            this.ui.elChargeWrap.classList.remove('show');
            this.ui.pauseScreen.classList.remove('hidden');
            this._exitPointerLockSafe();
        }

        resumeGame() {
            this.state = 'PLAYING';
            this.ui.pauseScreen.classList.add('hidden');
            this.clock.getDelta();
            if (!this.isTouchDevice) this._requestPointerLockSafe();
        }

        openShop() {
            if (this.ui.wheelOpen) this.ui.closeWheel(false);
            this.state = 'SHOP';
            this.mouseDown = false;
            this.isCharging = false;
            this.ui.elChargeWrap.classList.remove('show');
            this.ui.renderShop();
            this.ui.shopScreen.classList.remove('hidden');
            this._exitPointerLockSafe();
        }

        closeShop() {
            this.state = 'PLAYING';
            this.ui.shopScreen.classList.add('hidden');
            this.clock.getDelta();
            this.ui.syncHUD();
            if (!this.isTouchDevice) this._requestPointerLockSafe();
        }

        gameOver() {
            if (this.ui.wheelOpen) this.ui.closeWheel(false);
            this.state = 'GAMEOVER';
            this.mouseDown = false;
            this.isCharging = false;
            this.ui.elChargeWrap.classList.remove('show');
            this._exitPointerLockSafe();
            document.getElementById('go-score').textContent = this.score;
            document.getElementById('go-wave').textContent = this.wave;
            document.getElementById('go-kills').textContent = this.kills;
            this.ui.gameoverScreen.classList.remove('hidden');
            this.ui.crosshair.style.display = 'none';
        }

        // =====================================================================
        // SHOP: ARMOR, GLOVE (8 POWERS / 5 SLOTS), WEAPONS (11 / 5 SLOTS), ATTACHMENTS
        // =====================================================================
        buyOrEquipArmor(idx) {
            const target = XB.ARMORS[idx];
            if (!target) return;
            if (!this.unlockedArmors.has(idx)) {
                if (this.crystals < target.costCrystals) return;
                this.crystals -= target.costCrystals;
                this.unlockedArmors.add(idx);
                this.sound.playShopBuy();
                this.showToast(`ОТКРЫТА БРОНЯ: ${target.category.toUpperCase()}`, target.accentColor);
            } else {
                this.sound.playPickup();
            }
            this.armorIndex = idx;
            const eff = this.getEffectiveArmor();
            this.hp = eff.maxHp;
            this.shield = eff.maxShield;
            this.ui.syncHUD();
        }

        upgradeArmorCore(kind) {
            if (kind === 'plate') {
                const cost = 6 + this.armorPlateLvl * 5;
                if (this.crystals < cost) return;
                this.crystals -= cost; this.armorPlateLvl++;
                this.hp = Math.min(this.getEffectiveArmor().maxHp, this.hp + 25);
            } else if (kind === 'cap') {
                const cost = 6 + this.armorCapLvl * 5;
                if (this.crystals < cost) return;
                this.crystals -= cost; this.armorCapLvl++;
                this.shield = Math.min(this.getEffectiveArmor().maxShield, this.shield + 25);
            } else if (kind === 'servo') {
                const cost = 8 + this.armorServoLvl * 6;
                if (this.crystals < cost) return;
                this.crystals -= cost; this.armorServoLvl++;
            }
            this.sound.playShopBuy();
            this.ui.syncHUD();
        }

        unlockGlovePower(powerIdx) {
            const p = XB.GLOVE_POWERS[powerIdx];
            if (!p || this.combat.unlockedPowers.has(powerIdx)) return;
            if (this.crystals < p.costCrystals) return;
            this.crystals -= p.costCrystals;
            this.combat.unlockedPowers.add(powerIdx);
            this.sound.playShopBuy();
            this.showToast(`ОТКРЫТА СПОСОБНОСТЬ: ${p.shortName}`, p.color);
            this.ui.syncHUD();
        }

        assignGloveToSlot(powerIdx, targetSlot) {
            if (!this.combat.unlockedPowers.has(powerIdx) || targetSlot < 0 || targetSlot > 5) return;
            const curSlot = this.combat.equippedGloveSlots.indexOf(powerIdx);
            if (curSlot !== -1 && curSlot !== targetSlot) {
                const displaced = this.combat.equippedGloveSlots[targetSlot];
                this.combat.equippedGloveSlots[curSlot] = displaced;
            }
            this.combat.equippedGloveSlots[targetSlot] = powerIdx;
            this.sound.playPickup();
            this.ui.rebuildGloveUI();
            this.ui.syncHUD();
        }

        upgradeGloveTrack(powerIdx, track) {
            const upg = this.combat.gloveUpgrades[powerIdx];
            if (!upg || upg[track] >= 6) return;
            const cost = 5 + upg[track] * 4;
            if (this.crystals < cost) return;
            this.crystals -= cost;
            upg[track]++;
            this.sound.playShopBuy();
            this.ui.syncHUD();
        }

        upgradePolymerReserve(cost) {
            if (this.crystals < cost) return;
            this.crystals -= cost;
            this.combat.maxPolymerEnergy += 25;
            this.combat.polymerEnergy = this.combat.maxPolymerEnergy;
            this.sound.playShopBuy();
            this.ui.syncHUD();
        }

        buyWeapon(weaponIdx) {
            const w = XB.WEAPONS[weaponIdx];
            if (!w || this.unlockedWeapons.has(weaponIdx)) return;
            const needCrys = w.costCrystals || 0;
            if (this.coins < w.costCoins || this.crystals < needCrys) return;
            this.coins -= w.costCoins;
            this.crystals -= needCrys;
            this.unlockedWeapons.add(weaponIdx);
            this.sound.playShopBuy();
            this.showToast(`ПОЛУЧЕНО ОРУЖИЕ: ${w.shortName}`, '#4ade80');
            this.ui.syncHUD();
        }

        assignWeaponToSlot(weaponIdx, targetSlot) {
            if (!this.unlockedWeapons.has(weaponIdx) || targetSlot < 0 || targetSlot > 5) return;
            const curSlot = this.equippedWeaponSlots.indexOf(weaponIdx);
            if (curSlot !== -1 && curSlot !== targetSlot) {
                const displaced = this.equippedWeaponSlots[targetSlot];
                this.equippedWeaponSlots[curSlot] = displaced;
            }
            this.equippedWeaponSlots[targetSlot] = weaponIdx;
            this.sound.playPickup();
            this.ui.rebuildWeaponBar();
            this.selectWeaponSlot(targetSlot);
        }

        unlockOrSelectWallAttachment(attId) {
            const cfg = XB.WALL_ATTACHMENTS.find(a => a.id === attId);
            if (!cfg) return;
            if (!this.building.unlockedWallAttachments.has(attId)) {
                if (this.coins < cfg.unlockCoins) return;
                this.coins -= cfg.unlockCoins;
                this.building.unlockedWallAttachments.add(attId);
                this.sound.playShopBuy();
                this.showToast(`ОТКРЫТ ОБВЕС СТЕНЫ: ${cfg.shortName}`, cfg.color);
            } else {
                this.sound.playPickup();
            }
            this.building.selectedAttachmentId = attId;
            this.ui.rebuildBuildBar();
            this.ui.syncHUD();
        }

        upgradeBuildingTech(kind) {
            if (kind === 'wall') {
                const cost = 6 + this.building.wallHpLvl * 5;
                if (this.crystals < cost) return;
                this.crystals -= cost;
                this.building.wallHpLvl++;
                this.sound.playShopBuy();
                this.showToast(`ПРОЧНОСТЬ СТЕН УР.${this.building.wallHpLvl}`, '#4ade80');
            } else if (kind === 'turret') {
                const cost = 10 + (this.building.maxTurrets - 4) * 8;
                if (this.building.maxTurrets >= 8 || this.crystals < cost) return;
                this.crystals -= cost;
                this.building.maxTurrets++;
                this.sound.playShopBuy();
                this.showToast(`МАКС. ТУРЕЛЕЙ: ${this.building.maxTurrets}`, '#4ade80');
            }
            this.ui.syncHUD();
        }

        upgradeWeapon(weaponIdx) {
            const lvl = this.weaponLevels[weaponIdx];
            if (lvl >= 8) return;
            const cost = 35 + lvl * 35;
            if (this.coins < cost) return;
            this.coins -= cost;
            this.weaponLevels[weaponIdx]++;
            const stats = this.combat.getWeaponStats(weaponIdx, this.weaponLevels[weaponIdx], this.equippedAttachments[weaponIdx]);
            this.ammo[weaponIdx] = stats.maxAmmo;
            this.sound.playShopBuy();
            this.ui.syncHUD();
        }

        buyOrToggleAttachment(weaponIdx, slot, attId) {
            const list = XB.ATTACHMENTS[slot] || [];
            const att = list.find(x => x.id === attId);
            if (!att) return;
            const key = `${slot}:${attId}`;
            const ownedSet = this.ownedAttachments[weaponIdx];
            const eqMap = this.equippedAttachments[weaponIdx];

            if (!ownedSet.has(key)) {
                if (this.coins < att.costCoins) return;
                this.coins -= att.costCoins;
                ownedSet.add(key);
                eqMap[slot] = attId;
                this.sound.playShopBuy();
                this.showToast(`ОБВЕС: ${att.name}`, '#facc15');
            } else {
                eqMap[slot] = (eqMap[slot] === attId) ? null : attId;
                this.sound.playPickup();
            }

            const stats = this.combat.getWeaponStats(weaponIdx, this.weaponLevels[weaponIdx], eqMap);
            this.ammo[weaponIdx] = Math.min(stats.maxAmmo, Math.max(this.ammo[weaponIdx], stats.maxAmmo));
            if (weaponIdx === this.getActiveWeaponIndex()) {
                this.vm.syncWeaponAttachments(weaponIdx, eqMap);
            }
            this.ui.syncHUD();
        }

        buySupply(kind) {
            if (kind === 'medkit') {
                if (this.coins < 35 || this.medkitCount >= this.maxMedkits) return;
                this.coins -= 35; this.medkitCount++;
            } else if (kind === 'boost') {
                if (this.coins < 40 || this.boostCharges >= this.maxBoostCharges) return;
                this.coins -= 40; this.boostCharges++;
            } else if (kind === 'full') {
                if (this.coins < 50) return;
                this.coins -= 50;
                this.ammo = XB.WEAPONS.map((w, idx) => this.combat.getWeaponStats(idx, this.weaponLevels[idx], this.equippedAttachments[idx]).maxAmmo);
                const eff = this.getEffectiveArmor();
                this.hp = eff.maxHp;
                this.shield = eff.maxShield;
            }
            this.sound.playShopBuy();
            this.ui.syncHUD();
        }

        // =====================================================================
        // WEAPONS & CONSUMABLES
        // =====================================================================
        selectWeaponSlot(slotIdx) {
            if (slotIdx < 0 || slotIdx > 5) return;
            if (this.building && this.building.buildMode) {
                this.building.toggleBuildMode(false);
            }
            this.activeWeaponSlot = slotIdx;
            const wIdx = this.getActiveWeaponIndex();
            const w = XB.WEAPONS[wIdx];

            this.reloading = false;
            this.reloadTimer = 0;
            this.isCharging = false;
            this.chargeTime = 0;
            this.pumpedPolymer = 0;
            this.ui.elReload.classList.remove('show');
            this.ui.elChargeWrap.classList.remove('show');
            this.vm.onWeaponSwitch(wIdx, this.equippedAttachments[wIdx]);

            this.ui.weaponSlotBtns.forEach((b, i) => b.classList.toggle('active', i === slotIdx));
            this.ui.crosshair.classList.toggle('spread-wide', w.id === 'shotgun' || w.id === 'minigun' || w.id === 'flamer' || w.id === 'vulcan_gatling');
            this.ui.syncHUD();
        }

        startReload() {
            const wIdx = this.getActiveWeaponIndex();
            const w = XB.WEAPONS[wIdx];
            if (w.usesPolymer) return; // Polymer gun draws directly from Glove Reactor!
            const stats = this.combat.getWeaponStats(wIdx, this.weaponLevels[wIdx], this.equippedAttachments[wIdx]);
            if (this.reloading || this.ammo[wIdx] >= stats.maxAmmo) return;

            this.isCharging = false;
            this.chargeTime = 0;
            this.ui.elChargeWrap.classList.remove('show');
            this.reloading = true;
            this.currentReloadDur = stats.reloadTime * (this.boostActiveTimer > 0 ? 0.62 : 1.0);
            this.reloadTimer = this.currentReloadDur;
            this.ui.elReload.classList.add('show');
            this.sound.playReload();
        }

        _beginCharge() {
            if (this.state !== 'PLAYING' || this.reloading || this.fireCooldown > 0) return;
            const wIdx = this.getActiveWeaponIndex();
            const w = XB.WEAPONS[wIdx];

            if (w.kind === 'polymer_sphere') {
                if (this.combat.polymerEnergy < w.minPolymerToFire) {
                    this.showToast(`НУЖНО МИН. ${w.minPolymerToFire} ПОЛИМЕРА!`, '#34d399');
                    return;
                }
                this.isCharging = true;
                this.chargeTime = 0;
                this.pumpedPolymer = w.minPolymerToFire;
                this.combat.polymerEnergy -= w.minPolymerToFire;
                this.chargeTickAcc = 0;
                this.ui.elChargeWrap.classList.add('show');
                return;
            }

            if (this.ammo[wIdx] <= 0) {
                this.startReload();
                return;
            }
            this.isCharging = true;
            this.chargeTime = 0;
            this.chargeTickAcc = 0;
            this.ui.elChargeWrap.classList.add('show');
        }

        _releaseChargeShot() {
            if (!this.isCharging) return;
            this.isCharging = false;
            this.ui.elChargeWrap.classList.remove('show');

            const wIdx = this.getActiveWeaponIndex();
            const w = XB.WEAPONS[wIdx];
            const stats = this.combat.getWeaponStats(wIdx, this.weaponLevels[wIdx], this.equippedAttachments[wIdx]);

            if (w.kind === 'polymer_sphere') {
                const chargeSec = this.chargeTime;
                const pumped = this.pumpedPolymer;
                this.chargeTime = 0;
                this.pumpedPolymer = 0;
                this.ui.elChargeFill.style.width = '0%';
                this.fireCooldown = stats.fireRate;
                this.combat.launchPolymerSphere(wIdx, w, stats, chargeSec, pumped, this.getCombatContext());
                this.ui.syncHUD();
                return;
            }

            if (this.reloading || this.ammo[wIdx] <= 0) return;
            const ratio = Math.min(1, Math.max(0.25, this.chargeTime / w.maxChargeTime));
            this.chargeTime = 0;
            this.ui.elChargeFill.style.width = '0%';
            if (this.vm.chargeOrbMesh) this.vm.chargeOrbMesh.scale.setScalar(1);

            this.ammo[wIdx]--;
            this.fireCooldown = stats.fireRate;
            this.combat.launchNovaOrb(wIdx, w, stats, ratio, this.getCombatContext());
            this.ui.syncHUD();
            if (this.ammo[wIdx] <= 0) this.startReload();
        }

        tryFire() {
            if (this.state !== 'PLAYING' || this.reloading || this.fireCooldown > 0) return;
            const wIdx = this.getActiveWeaponIndex();
            const w = XB.WEAPONS[wIdx];
            if (w.kind === 'charge' || w.kind === 'polymer_sphere') {
                this._beginCharge();
                return;
            }
            const stats = this.combat.getWeaponStats(wIdx, this.weaponLevels[wIdx], this.equippedAttachments[wIdx]);
            if (this.ammo[wIdx] <= 0) {
                this.startReload();
                return;
            }
            this.ammo[wIdx]--;
            this.fireCooldown = stats.fireRate;

            this.ui.crosshair.classList.add('firing');
            setTimeout(() => this.ui.crosshair.classList.remove('firing'), 75);

            this.combat.fireWeapon(wIdx, w, stats, this.getCombatContext());
            this.ui.syncHUD();
            if (this.ammo[wIdx] <= 0) this.startReload();
        }

        activateSpeedBoost() {
            if (this.boostActiveTimer > 0) return;
            if (this.boostCharges <= 0) { this.showToast('НЕТ ЗАРЯДОВ БУСТЕРА', '#fb7185'); return; }
            this.boostCharges--;
            this.boostActiveTimer = 8.0;
            this.sound.playBoost();
            this.showToast('ОВЕРДРАЙВ СКОРОСТИ АКТИВИРОВАН', '#4ade80');
            this.ui.syncHUD();
        }

        useMedkit() {
            if (this.medkitCount <= 0) { this.showToast('АПТЕЧКИ ЗАКОНЧИЛИСЬ', '#fb7185'); return; }
            const armor = this.getEffectiveArmor();
            if (this.hp >= armor.maxHp && this.shield >= armor.maxShield) { this.showToast('БРОНЯ И ЗДОРОВЬЕ ПОЛНЫЕ', '#94a3b8'); return; }
            this.medkitCount--;
            this.hp = Math.min(armor.maxHp, this.hp + Math.round(armor.maxHp * 0.45));
            this.shield = Math.min(armor.maxShield, this.shield + Math.round(armor.maxShield * 0.35));
            this.sound.playPickup();
            this.triggerScreenFX('fx-heal');
            this.showToast('АПТЕЧКА ПРИМЕНЕНА', '#4ade80');
            this.ui.syncHUD();
        }

        // =====================================================================
        // WAVE DIRECTOR: LARGE HORDES, TANKS VS SPECIALISTS, SHOOT-BUTTON REST!
        // =====================================================================
        onWaveButtonHit() {
            if (this.waveState !== 'INTERMISSION') return;
            this.sound.playWaveButton();
            this.map.setWaveButtonsVisible(false);
            this._startWave(this.wave + 1);
        }

        _startWave(waveNum) {
            this.wave = waveNum;
            this.waveState = 'COMBAT';
            this.enemiesToSpawn = [];
            this.map.resetBarrels();
            this.map.setWaveButtonsVisible(false);

            if (waveNum === 1) this.activeDoorIndices = [1, 2];
            else if (waveNum === 2) this.activeDoorIndices = [0, 1, 2];
            else this.activeDoorIndices = [0, 1, 2, 3];

            this.map.breachDoors.forEach((d, idx) => {
                const active = this.activeDoorIndices.includes(idx);
                d.beaconMat.color.setHex(active ? 0xf43f5e : 0x1e293b);
                d.portalMat.color.setHex(active ? 0xef4444 : 0x1e293b);
                d.portalMat.opacity = active ? 0.52 : 0.16;
                if (active) d.openTimer = 3.2;
            });

            // Significantly increased horde counts + logical Melee Tanks vs Ranged Specialists!
            const total = 11 + waveNum * 5;
            for (let i = 0; i < total; i++) {
                const r = Math.random();
                if (waveNum % 5 === 0 && i === total - 1) {
                    this.enemiesToSpawn.push('overlord');
                } else if (waveNum >= 3 && i >= total - 2) {
                    this.enemiesToSpawn.push('brute');
                } else if (waveNum >= 4 && r < 0.14) {
                    this.enemiesToSpawn.push('brute');
                } else if (r < 0.28) {
                    this.enemiesToSpawn.push('shieldbearer');
                } else if (waveNum >= 2 && r < 0.42) {
                    this.enemiesToSpawn.push('sniper');
                } else if (waveNum >= 3 && r < 0.56) {
                    this.enemiesToSpawn.push('grenadier');
                } else if (waveNum >= 2 && r < 0.72) {
                    this.enemiesToSpawn.push('leaper');
                } else if (r < 0.86) {
                    this.enemiesToSpawn.push('spitter');
                } else {
                    this.enemiesToSpawn.push('scout');
                }
            }

            this.waveSpawning = true;
            this.spawnTimer = 1.1;
            this.sound.playWaveStart();
            this.sound.playAirlockAlarm();

            const isBossWave = (waveNum % 5 === 0);
            this.showBanner(
                isBossWave ? `ВОЛНА ${waveNum} • АЛЬФА-БОСС` : `ВОЛНА ${waveNum} (${total} ЕД.)`,
                isBossWave
                    ? 'ВНИМАНИЕ: АЛЬФА-ТИТАН «ГОЛИАФ» И ОРДА РОБОТОВ В ШЛЮЗАХ!'
                    : 'Шлюзовые ворота открыты! Танки прорывают строй — берегитесь снайперов и гренадёров!'
            );
            this.ui.syncHUD();
        }

        onAlienKilled(alien) {
            this.score += alien.score;
            this.kills++;
            this.ui.syncHUD();
        }

        onCollectPickup(pk, silent = false) {
            const armor = this.getEffectiveArmor();
            if (pk.type === 'coin') {
                this.coins += pk.value;
                this.score += pk.value;
                if (!silent) this.sound.playCoin();
            } else if (pk.type === 'crystal') {
                this.crystals += pk.value;
                this.score += pk.value * 40;
                if (!silent) {
                    this.sound.playCrystal();
                    this.showToast(`+${pk.value} КРИСТАЛЛ БРОНИ [B]`, '#67e8f9');
                }
            } else if (pk.type === 'hp') {
                this.sound.playPickup();
                this.hp = Math.min(armor.maxHp, this.hp + 45);
                this.showToast('+45 ЗДОРОВЬЕ', '#4ade80');
                this.triggerScreenFX('fx-heal');
            } else if (pk.type === 'medkit') {
                this.sound.playPickup();
                if (this.medkitCount < this.maxMedkits) {
                    this.medkitCount++;
                    this.showToast('+1 АПТЕЧКА В ЗАПАС [X]', '#4ade80');
                } else {
                    this.hp = Math.min(armor.maxHp, this.hp + 60);
                    this.showToast('+60 ЗДОРОВЬЕ', '#4ade80');
                }
                this.triggerScreenFX('fx-heal');
            } else if (pk.type === 'boost') {
                this.sound.playPickup();
                if (this.boostCharges < this.maxBoostCharges) {
                    this.boostCharges++;
                    this.showToast('+1 БУСТЕР СКОРОСТИ [Z]', '#4ade80');
                } else {
                    this.boostActiveTimer = Math.max(this.boostActiveTimer, 8.0);
                    this.showToast('МГНОВЕННЫЙ БУСТ!', '#4ade80');
                }
                this.triggerScreenFX('fx-shield');
            } else if (pk.type === 'shield') {
                this.sound.playPickup();
                this.shield = Math.min(armor.maxShield, this.shield + 60);
                this.showToast('+60 ЭНЕРГОЩИТ', '#34d399');
                this.triggerScreenFX('fx-shield');
            } else if (pk.type === 'ammo') {
                this.sound.playPickup();
                this.ammo = XB.WEAPONS.map((w, idx) => this.combat.getWeaponStats(idx, this.weaponLevels[idx], this.equippedAttachments[idx]).maxAmmo);
                this.reloading = false;
                this.ui.elReload.classList.remove('show');
                this.showToast('БОЕЗАПАС ПОПОЛНЕН', '#facc15');
            }
            this.ui.syncHUD();
        }

        damagePlayer(amount, attackerPos) {
            if (this.state !== 'PLAYING' || this.combat.emergencyInvulnTimer > 0) return;
            this.lastDamageTime = performance.now();

            const armor = this.getEffectiveArmor();
            let effective = amount * (1 - armor.damageReduction);
            if (this.combat.aegisShieldTimer > 0) effective *= 0.15;

            if (armor.thornsDmg > 0 && attackerPos) {
                for (const a of this.enemies.aliens) {
                    if (!a.dying && a.group.position.distanceTo(this.player.pos) < 4.5) {
                        this.combat.damageAlien(a, armor.thornsDmg, a.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xfb923c, false, 1.75, this.getCombatContext());
                    }
                }
            }

            const prevShield = this.shield;
            let absorbedByShield = false;
            if (this.shield > 0) {
                const take = Math.min(this.shield, effective);
                this.shield -= take;
                effective -= take;
                absorbedByShield = (effective <= 0.01);

                // Ultimate Apex Armor Passive: Shield Break -> Discharge ALL Polymer Wave!
                if (prevShield > 0 && this.shield <= 0 && armor.polymerNovaOnShieldBreak) {
                    if (this.combat.triggerShieldBreakPolymerNova(this.getCombatContext())) {
                        effective = 0; // Emergency Polymer Wave blocks leftover bleed!
                        absorbedByShield = true;
                    }
                }
            }

            if (effective > 0) {
                this.hp = Math.max(0, this.hp - effective);
            }

            this.sound.playPlayerHurt(absorbedByShield);
            this.triggerScreenFX(absorbedByShield ? 'fx-shield' : 'fx-damage');
            this.ui.syncHUD();

            if (this.hp <= 0) this.gameOver();
        }

        _isNearArmoryTerminal() {
            if (!this.map.armoryTerminal) return false;
            return Math.hypot(
                this.player.pos.x - this.map.armoryTerminal.x,
                this.player.pos.z - this.map.armoryTerminal.z
            ) <= this.map.armoryTerminal.radius;
        }

        // =====================================================================
        // UPDATE & RENDER LOOP
        // =====================================================================
        update(rawDt) {
            this.map.decorSpinners.forEach((obj, i) => {
                obj.rotation.y += rawDt * (i % 2 === 0 ? 0.95 : -1.25);
                obj.rotation.x += rawDt * (i % 2 === 0 ? 0.35 : 0.65);
            });

            if (this.waveState === 'INTERMISSION') {
                for (const wb of this.map.waveButtons) {
                    wb.orb.rotation.y += rawDt * 2.4;
                    wb.ring.rotation.x += rawDt * 1.8;
                    wb.ring.rotation.y += rawDt * 1.4;
                }
            }

            const doorsPaused = this.combat.timeStopTimer > 0;
            if (!doorsPaused) {
                const doorSpeedScale = this.combat.timeSlowTimer > 0 ? 0.25 : 1.0;
                for (const d of this.map.breachDoors) {
                    if (d.openTimer > 0) {
                        d.openTimer -= rawDt * doorSpeedScale;
                        d.openAmount = Math.min(1, d.openAmount + rawDt * 2.6);
                    } else {
                        d.openAmount = Math.max(0, d.openAmount - rawDt * 1.3);
                    }
                    d.leftLeaf.position.x = -2.25 - d.openAmount * 3.8;
                    d.rightLeaf.position.x = 2.25 + d.openAmount * 3.8;
                }
            }

            if (this.state === 'MENU') {
                const t = performance.now() * 0.00018;
                this.camera.position.set(Math.sin(t) * 62, 26, Math.cos(t) * 62 + 8);
                this.camera.lookAt(0, 5, -8);
                return;
            }

            if (this.state !== 'PLAYING') return;

            const timeScale = this.ui.wheelOpen ? 0.14 : 1.0;
            const dt = rawDt * timeScale;

            const armor = this.getEffectiveArmor();
            const wIdx = this.getActiveWeaponIndex();
            const curWeapon = XB.WEAPONS[wIdx];
            const wStats = this.combat.getWeaponStats(wIdx, this.weaponLevels[wIdx], this.equippedAttachments[wIdx]);

            // 1. Speed Booster
            if (this.boostActiveTimer > 0) {
                this.boostActiveTimer = Math.max(0, this.boostActiveTimer - dt);
                this.ui.screenFx.classList.add('fx-boost');
                if (this.boostActiveTimer === 0) {
                    this.ui.screenFx.classList.remove('fx-boost');
                    this.ui.syncHUD();
                } else {
                    this.ui.elBoostLabel.textContent = `${this.boostActiveTimer.toFixed(1)}с`;
                }
            } else {
                this.ui.elBoostLabel.textContent = 'БУСТ';
                if (this.boostCharges < this.maxBoostCharges) {
                    this.boostRechargeTimer += dt;
                    if (this.boostRechargeTimer >= 18) {
                        this.boostRechargeTimer = 0;
                        this.boostCharges++;
                        this.showToast('ЗАРЯД БУСТЕРА ВОССТАНОВЛЕН', '#4ade80');
                        this.ui.syncHUD();
                    }
                }
            }

            this.ui.screenFx.classList.toggle('fx-timestop', this.combat.timeStopTimer > 0);
            this.ui.screenFx.classList.toggle('fx-timeslow', this.combat.timeSlowTimer > 0 && this.combat.timeStopTimer <= 0);

            // 2. Weapon Fire / Infinite Polymer Sphere Charge! / Reload
            if (this.fireCooldown > 0) this.fireCooldown -= dt;
            if (this.isCharging && curWeapon.kind === 'polymer_sphere') {
                // UNBOUNDED / INFINITE HOLD CHARGING!
                this.chargeTime += rawDt;
                const wantDrain = curWeapon.polymerDrainPerSec * rawDt;
                const actualDrain = Math.min(this.combat.polymerEnergy, wantDrain);
                this.combat.polymerEnergy -= actualDrain;
                this.pumpedPolymer += actualDrain;

                const pct = Math.min(100, Math.round((this.chargeTime / 3.5) * 100));
                this.ui.elChargeFill.style.width = `${pct}%`;
                this.chargeTickAcc += rawDt;
                if (this.chargeTickAcc >= 0.14) {
                    this.chargeTickAcc = 0;
                    this.sound.playChargeTick(Math.min(1.8, this.chargeTime / 3.0));
                }
            } else if (this.isCharging && curWeapon.kind === 'charge') {
                this.chargeTime = Math.min(curWeapon.maxChargeTime, this.chargeTime + dt);
                const ratio = this.chargeTime / curWeapon.maxChargeTime;
                this.ui.elChargeFill.style.width = `${Math.round(ratio * 100)}%`;
                this.chargeTickAcc += dt;
                if (this.chargeTickAcc >= 0.14) {
                    this.chargeTickAcc = 0;
                    this.sound.playChargeTick(ratio);
                }
            } else if (this.mouseDown && curWeapon.auto && !this.ui.wheelOpen && !this.building.buildMode) {
                this.tryFire();
            }

            if (this.reloading) {
                this.reloadTimer -= dt;
                if (this.reloadTimer <= 0) {
                    this.reloading = false;
                    this.ammo[wIdx] = wStats.maxAmmo;
                    this.ui.elReload.classList.remove('show');
                    this.ui.syncHUD();
                }
            }

            // 3. Shield Regen
            const regenDelayMs = armor.shieldRegenDelay * 1000;
            const canRegen = armor.combatShieldRegen || (performance.now() - this.lastDamageTime > regenDelayMs);
            if (this.shield < armor.maxShield && canRegen) {
                const rate = armor.combatShieldRegen && (performance.now() - this.lastDamageTime < regenDelayMs)
                    ? armor.shieldRegenRate * 0.4
                    : armor.shieldRegenRate;
                this.shield = Math.min(armor.maxShield, this.shield + rate * dt);
            }

            // 4. Deterministic 120Hz Movement
            const inputState = {
                keys: this.keys,
                joyInput: this.joyInput,
                weapon: curWeapon,
                armor,
                boostActive: this.boostActiveTimer > 0,
                moveRight: 0
            };
            this.player.stepSimulation(dt, inputState);

            const horizSpeed = Math.hypot(this.player.vel.x, this.player.vel.z);
            const shakeX = (Math.random() - 0.5) * this.player.cameraShake;
            const shakeY = (Math.random() - 0.5) * this.player.cameraShake;
            const headBob = (this.player.onGround && this.player.slideTimer <= 0 && horizSpeed > 1.2)
                ? Math.sin(this.player.bobTime) * 0.065
                : 0;

            this.camera.position.set(
                this.player.renderPos.x + shakeX,
                this.player.renderPos.y + this.player.currentEyeHeight + headBob + shakeY,
                this.player.renderPos.z
            );
            this.camera.rotation.y = this.player.yaw;
            this.camera.rotation.x = this.player.pitch;
            this.camera.rotation.z = this.player.cameraRoll;

            const speedExtra = Math.max(0, (horizSpeed - 11) * 0.85) + (this.boostActiveTimer > 0 ? 7.5 : 0);
            const targetFov = Math.min(104, 78 + speedExtra);
            if (Math.abs(this.camera.fov - targetFov) > 0.05) {
                this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, rawDt * 9);
                this.camera.updateProjectionMatrix();
            }
            this.ui.speedlines.style.opacity = Math.max(0, Math.min(0.82, (horizSpeed - 17.0) / 16 + (this.boostActiveTimer > 0 ? 0.3 : 0))).toFixed(2);

            this.ui.elSpeedPill.textContent = `SPD ${horizSpeed.toFixed(1)} м/с`;
            this.ui.elSpeedPill.className = this.boostActiveTimer > 0 ? 'overdrive' : (horizSpeed > 16.5 ? 'fast' : '');
            if (this.isCharging && curWeapon.kind === 'polymer_sphere') {
                const m = 0.75 + this.chargeTime * 1.48 + (this.pumpedPolymer / 100) * 1.15;
                const bR = Math.round(6.2 + Math.min(34, this.chargeTime * 4.8 + this.pumpedPolymer * 0.045));
                this.ui.elMoveTag.textContent = `СФЕРА ${this.chargeTime.toFixed(1)}с • x${m.toFixed(1)} • ВЗРЫВ ${bR}М`;
            } else {
                this.ui.elMoveTag.textContent = this.player.moveTag || (this.boostActiveTimer > 0 ? 'ОВЕРДРАЙВ' : '');
            }

            if (this.player.dashCooldown <= 0) {
                this.ui.elDashPill.textContent = 'SHIFT РЫВОК: ГОТОВ';
                this.ui.elDashPill.classList.remove('cooling');
            } else {
                this.ui.elDashPill.textContent = `РЫВОК: ${this.player.dashCooldown.toFixed(1)}с`;
                this.ui.elDashPill.classList.add('cooling');
            }

            // 5. ViewModels
            const chargeRatio = curWeapon.kind === 'polymer_sphere'
                ? Math.min(3.5, this.chargeTime / 2.2)
                : (curWeapon.maxChargeTime ? this.chargeTime / curWeapon.maxChargeTime : 0);
            this.vm.update(rawDt, {
                weaponIndex: wIdx,
                curWeapon,
                reloading: this.reloading,
                reloadTimer: this.reloadTimer,
                reloadDur: this.currentReloadDur,
                boostActive: this.boostActiveTimer > 0,
                isCharging: this.isCharging,
                chargeRatio,
                chargeSeconds: this.chargeTime,
                bobTime: this.player.bobTime,
                slideTimer: this.player.slideTimer,
                wheelOpen: this.ui.wheelOpen,
                buildMode: this.building.buildMode,
                polymerFireBuffTimer: this.combat.polymerFireBuffTimer,
                timeStopTimer: this.combat.timeStopTimer,
                timeSlowTimer: this.combat.timeSlowTimer
            });

            // 6. Wave Combat vs Relaxed Intermission (Player Shoots 3D Button to Start Next Wave!)
            if (this.waveState === 'COMBAT' && this.combat.timeStopTimer <= 0) {
                if (this.waveSpawning) {
                    const spawnScale = this.combat.timeSlowTimer > 0 ? 0.25 : 1.0;
                    this.spawnTimer -= dt * spawnScale;
                    if (this.spawnTimer <= 0 && this.enemiesToSpawn.length > 0) {
                        const doorIdx = this.activeDoorIndices[Math.floor(Math.random() * this.activeDoorIndices.length)];
                        const door = this.map.breachDoors[doorIdx];
                        this.enemies.spawnAlien(this.enemiesToSpawn.pop(), this.wave, door);
                        this.spawnTimer = Math.max(0.32, 0.95 - this.wave * 0.05);
                        this.ui.syncHUD();
                    }
                    if (this.enemiesToSpawn.length === 0) this.waveSpawning = false;
                } else if (this.enemies.getAliveCount() === 0) {
                    // Enter Relaxed Intermission: Auto-vacuum all Coins & Crystals + Auto-repair permanent forts!
                    this.waveState = 'INTERMISSION';
                    this.map.setWaveButtonsVisible(true);
                    const swept = this.combat.collectRemainingWaveLoot(this.getCombatContext());
                    const repaired = this.building.repairAllPermanentStructures();

                    const waveCrystalBonus = 6 + Math.floor(this.wave * 2);
                    const waveCoinBonus = 65 + this.wave * 18;
                    this.crystals += waveCrystalBonus;
                    this.coins += waveCoinBonus;
                    this.shield = Math.min(armor.maxShield, this.shield + Math.round(armor.maxShield * 0.6));
                    this.hp = Math.min(armor.maxHp, this.hp + Math.round(armor.maxHp * 0.35));
                    this.boostCharges = Math.min(this.maxBoostCharges, this.boostCharges + 1);

                    const totalNewCoins = waveCoinBonus + swept.coins;
                    const totalNewCrystals = waveCrystalBonus + swept.crystals;
                    const lootTag = swept.count > 0 ? ` (в т.ч. автосбор ${swept.coins}М / ${swept.crystals}КР)` : '';
                    const repTag = repaired > 0 ? ` • Починено укреплений: ${repaired}` : '';
                    this.showBanner(
                        `ВОЛНА ${this.wave} ОТБИТА!`,
                        `+${totalNewCrystals} Кристаллов, +${totalNewCoins} Монет${lootTag}${repTag} • Выстрелите в маяк для Волны ${this.wave + 1}!`
                    );
                    this.ui.syncHUD();
                }
            }

            // 7. Static Supply Pads
            for (const pad of this.map.staticPads) {
                if (!pad.activePickup || !this.combat.pickups.includes(pad.activePickup)) {
                    pad.activePickup = null;
                    pad.respawnTimer += dt;
                    if (pad.respawnTimer >= 20) {
                        pad.respawnTimer = 0;
                        pad.activePickup = this.combat.spawnPickup(pad.x, pad.z, pad.type, true, 1);
                    }
                }
            }

            // 8. Enemies AI + Craft Preview & Allied Turrets + Combat Projectiles + Loot
            const ctx = this.getCombatContext();
            this.building.updatePreviewAndHovered(this.player.pos, this.player.currentEyeHeight, ctx);
            this.building.update(dt, this.combat, ctx);
            this.enemies.update(dt, this.player.pos, this.player.vel, ctx);
            this.combat.update(dt, ctx);

            this.ui.elTerminalPrompt.classList.toggle('show', this._isNearArmoryTerminal());

            // 9. HUD timers
            if (this.hitmarkerTimer > 0) { this.hitmarkerTimer -= rawDt; if (this.hitmarkerTimer <= 0) this.ui.hitmarker.classList.remove('show'); }
            if (this.bannerTimer > 0) { this.bannerTimer -= rawDt; if (this.bannerTimer <= 0) this.ui.elBanner.classList.remove('visible'); }
            if (this.fxTimer > 0) { this.fxTimer -= rawDt; if (this.fxTimer <= 0) this.ui.screenFx.classList.remove('fx-damage', 'fx-shield', 'fx-heal'); }
            if (this.toastTimer > 0) { this.toastTimer -= rawDt; if (this.toastTimer <= 0) this.ui.elToast.classList.remove('show'); }

            this.ui.syncHUD();
            this.ui.renderRadar();
        }

        showBanner(title, sub) {
            this.ui.elBannerTitle.textContent = title;
            this.ui.elBannerSub.textContent = sub;
            this.ui.elBanner.classList.add('visible');
            this.bannerTimer = 4.2;
        }

        showToast(msg, color) {
            this.ui.elToast.textContent = msg;
            this.ui.elToast.style.color = color || '#4ade80';
            this.ui.elToast.style.borderColor = color || '#4ade80';
            this.ui.elToast.classList.add('show');
            this.toastTimer = 2.0;
        }

        triggerScreenFX(cls) {
            this.ui.screenFx.classList.add(cls);
            this.fxTimer = 0.22;
        }

        renderLoop() {
            requestAnimationFrame(() => this.renderLoop());
            const dt = Math.min(this.clock.getDelta(), 0.05);
            this.update(dt);
            this.renderer.render(this.scene, this.camera);
        }
    }

    XB.XenoBreachGame = XenoBreachGame;

    global.addEventListener('DOMContentLoaded', () => {
        try {
            const game = new XenoBreachGame();
            game.renderLoop();
            XB.log.info('Boot', 'XENO-BREACH initialized successfully');
        } catch (err) {
            XB.log.error('Boot', 'Failed to initialize XENO-BREACH', err && err.stack ? err.stack : err);
        }
    });
})(window);
