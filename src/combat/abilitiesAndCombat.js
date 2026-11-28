/**
 * Combat, 11 Weapons Execution (including Polymer Beam "ГЕЛИОС-П", Cryo-Launcher, Hydra Homing Rockets),
 * Weapon Attachments Stat Engine, 8 Polymer Glove Abilities (with 3 sub-upgrade tracks),
 * Shield-Break Polymer Wave Nova on Apex Armor, Shootable 3D Wave Trigger Buttons, and Magnetic Loot.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class CombatSystem {
        constructor(scene, camera, mapBuilder, enemySystem, viewModel, soundEngine) {
            this.scene = scene;
            this.camera = camera;
            this.map = mapBuilder;
            this.enemies = enemySystem;
            this.vm = viewModel;
            this.sound = soundEngine;

            this.raycaster = new THREE.Raycaster();

            // Dynamic projectiles & FX
            this.playerOrbs = [];
            this.flamePuffs = [];
            this.firePools = [];
            this.shockwaves = [];
            this.tracers = [];
            this.particles = [];
            this.pickups = [];

            // Polymer Glove Loadout (6 Active Slots out of 9 total abilities!)
            this.unlockedPowers = new Set([0, 1, 2, 3, 4, 5]);
            this.equippedGloveSlots = [0, 1, 2, 3, 4, 5]; // [Q, E, F/R, T, V, Y]
            this.activeSlotIndex = 0;

            this.polymerEnergy = 100;
            this.maxPolymerEnergy = 100;
            this.gloveCooldowns = XB.GLOVE_POWERS.map(() => 0);
            this.gloveUpgrades = XB.GLOVE_POWERS.map(() => ({ power: 1, area: 1, efficiency: 1 }));

            // Active Buffs & Protection
            this.aegisShieldTimer = 0;
            this.polymerFireBuffTimer = 0;
            this.timeSlowTimer = 0;
            this.timeStopTimer = 0;
            this.shieldBreakNovaCooldown = 0;
            this.emergencyInvulnTimer = 0;

            this.shotCounter = 0;

            this.shieldDomeMesh = null;
            this._buildShieldDome();

            this._particleGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
            this._coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 14);
            this._coinGeo.rotateX(Math.PI / 2);
            this._crystalGeo = new THREE.OctahedronGeometry(0.42, 0);
        }

        _buildShieldDome() {
            const dome = new THREE.Mesh(
                new THREE.IcosahedronGeometry(2.15, 1),
                new THREE.MeshBasicMaterial({
                    color: 0x34d399,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.38
                })
            );
            dome.visible = false;
            this.scene.add(dome);
            this.shieldDomeMesh = dome;
        }

        reset() {
            this.playerOrbs.forEach(o => this.scene.remove(o.mesh));
            this.playerOrbs = [];
            this.flamePuffs.forEach(f => this.scene.remove(f.mesh));
            this.flamePuffs = [];
            this.firePools.forEach(p => this.scene.remove(p.mesh));
            this.firePools = [];
            this.shockwaves.forEach(s => this.scene.remove(s.mesh));
            this.shockwaves = [];
            this.tracers.forEach(t => this.scene.remove(t.mesh));
            this.tracers = [];
            this.particles.forEach(p => this.scene.remove(p.mesh));
            this.particles = [];
            this.pickups.forEach(pk => this.scene.remove(pk.mesh));
            this.pickups = [];

            this.unlockedPowers = new Set([0, 1, 2, 3, 4, 5]);
            this.equippedGloveSlots = [0, 1, 2, 3, 4, 5];
            this.activeSlotIndex = 0;

            this.maxPolymerEnergy = 100;
            this.polymerEnergy = 100;
            this.gloveCooldowns = XB.GLOVE_POWERS.map(() => 0);
            this.gloveUpgrades = XB.GLOVE_POWERS.map(() => ({ power: 1, area: 1, efficiency: 1 }));

            this.aegisShieldTimer = 0;
            this.polymerFireBuffTimer = 0;
            this.timeSlowTimer = 0;
            this.timeStopTimer = 0;
            this.shieldBreakNovaCooldown = 0;
            this.emergencyInvulnTimer = 0;
            this.shotCounter = 0;
            if (this.shieldDomeMesh) this.shieldDomeMesh.visible = false;
        }

        /**
         * Computes effective weapon stats factoring Level (including +15% mag size/level!) and Attachments.
         */
        getWeaponStats(weaponIdx, weaponLvl, equippedAttMap) {
            const base = XB.WEAPONS[weaponIdx];
            let dmgMult = 1 + (weaponLvl - 1) * 0.14;
            let ammoMult = 1 + (weaponLvl - 1) * 0.15; // Upgrading weapon increases Magazine capacity!
            let spreadMult = 1.0;
            let recoilMult = 1.0;
            let reloadMult = 1.0;
            let rateMult = 1.0;
            let critMult = 1.75 + (base.critBonus || 0);
            let polyBurst = false;

            if (equippedAttMap) {
                for (const slot of ['barrel', 'mag', 'optic', 'core']) {
                    const attId = equippedAttMap[slot];
                    if (!attId) continue;
                    const list = XB.ATTACHMENTS[slot] || [];
                    const att = list.find(x => x.id === attId);
                    if (!att) continue;
                    if (att.dmgMult) dmgMult *= att.dmgMult;
                    if (att.ammoMult) ammoMult *= att.ammoMult;
                    if (att.spreadMult) spreadMult *= att.spreadMult;
                    if (att.recoilMult) recoilMult *= att.recoilMult;
                    if (att.reloadMult) reloadMult *= att.reloadMult;
                    if (att.rateMult) rateMult *= att.rateMult;
                    if (att.critBonus) critMult += att.critBonus;
                    if (att.polyBurst) polyBurst = true;
                }
            }

            return {
                damage: Math.round(base.damage * dmgMult),
                maxAmmo: base.usesPolymer ? Math.round(this.maxPolymerEnergy) : Math.max(1, Math.round(base.maxAmmo * ammoMult)),
                spread: base.spread * spreadMult,
                recoilMult,
                reloadTime: base.reloadTime * reloadMult,
                fireRate: base.fireRate * rateMult,
                critMult,
                polyBurst
            };
        }

        // =====================================================================
        // ATOMIC HEART POLYMER GLOVE: 5 ACTIVE SLOTS / 8 TOTAL ABILITIES
        // =====================================================================
        castGloveSlot(slotIdx, gameCtx) {
            const powerIdx = this.equippedGloveSlots[slotIdx];
            if (powerIdx === undefined) return false;
            return this.castGlovePower(powerIdx, slotIdx, gameCtx);
        }

        castGlovePower(powerIdx, slotIdx, gameCtx) {
            const power = XB.GLOVE_POWERS[powerIdx];
            if (!power) return false;

            const upg = this.gloveUpgrades[powerIdx];
            const effMult = Math.max(0.58, 1 - (upg.efficiency - 1) * 0.08);
            const areaMult = 1 + (upg.area - 1) * 0.14;
            const powMult = 1 + (upg.power - 1) * 0.22;

            const cdLeft = this.gloveCooldowns[powerIdx];
            if (cdLeft > 0) {
                gameCtx.showToast(`${power.shortName}: КД ${cdLeft.toFixed(1)}с`, '#94a3b8');
                return false;
            }
            const energyCost = Math.max(8, Math.round(power.energyCost * effMult));
            if (this.polymerEnergy < energyCost) {
                gameCtx.showToast(`НУЖНО ${energyCost} ПОЛИМЕРА!`, '#f59e0b');
                return false;
            }

            if (slotIdx >= 0) this.activeSlotIndex = slotIdx;
            this.polymerEnergy -= energyCost;

            const armorCdMult = gameCtx.armor ? gameCtx.armor.gloveCdMult : 1.0;
            this.gloveCooldowns[powerIdx] = power.cooldown * armorCdMult * effMult;

            this.vm.triggerGloveCast(power.id, power.hex);
            this.sound.playGloveCast(power.id);

            const origin = this.vm.getGloveWorldPos();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
            const pPos = gameCtx.playerPos;

            if (power.id === 'shield') {
                const dur = power.duration * areaMult;
                this.aegisShieldTimer = dur;
                const shieldRestore = Math.round(power.power * powMult);
                gameCtx.restoreShield(shieldRestore);

                for (const a of this.enemies.aliens) {
                    if (a.dying) continue;
                    const d = a.group.position.distanceTo(pPos);
                    if (d < power.radius * areaMult) {
                        const push = a.group.position.clone().sub(pPos).setY(0).normalize();
                        a.knockVel.addScaledVector(push, 16);
                        a.shockTimer = Math.max(a.shockTimer, 1.8);
                    }
                }
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.4, 0)), power.radius * areaMult, power.hex, 0.36);
                gameCtx.showToast(`ЭНЕРГОЩИТ «ЭГИДА» (${dur.toFixed(1)}с)`, power.color);
            } else if (power.id === 'freeze') {
                const freezeDur = power.duration * areaMult;
                const range = power.radius * areaMult;
                let frozenCount = 0;

                this._spawnTracer(origin, origin.clone().addScaledVector(forward, range * 0.72), power.hex, 0.36);
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 10.5 * areaMult, power.hex, 0.38);

                for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                    const a = this.enemies.aliens[i];
                    if (a.dying) continue;
                    const toA = a.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(pPos.clone().add(new THREE.Vector3(0, 1.4, 0)));
                    const dist = toA.length();
                    const dir = toA.clone().normalize();
                    if ((dist < range && dir.dot(forward) > 0.6) || dist < 10.5 * areaMult) {
                        a.freezeTimer = Math.max(a.freezeTimer, a.cfg.isBoss ? freezeDur * 0.5 : freezeDur);
                        a.burnTimer = 0;
                        frozenCount++;
                        this._spawnParticles(a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), power.hex, 10, 6);
                        this.damageAlien(a, power.power * powMult, a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), power.hex, false, 1.75, gameCtx);
                    }
                }
                gameCtx.showToast(`КРИО-ПОТОК: ЗАМОРОЖЕНО ${frozenCount}`, power.color);
            } else if (power.id === 'fire') {
                const buffDur = power.duration * areaMult;
                this.polymerFireBuffTimer = buffDur;
                const blastRange = power.radius * areaMult;

                this._spawnTracer(origin, origin.clone().addScaledVector(forward, 18), power.hex, 0.42);
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 10.5 * areaMult, power.hex, 0.35);

                for (let k = 1; k <= 3; k++) {
                    const poolPos = pPos.clone().addScaledVector(new THREE.Vector3(forward.x, 0, forward.z).normalize(), k * 5.2);
                    poolPos.x = Math.max(-this.map.ARENA_LIMIT_X + 2, Math.min(this.map.ARENA_LIMIT_X - 2, poolPos.x));
                    poolPos.z = Math.max(-this.map.ARENA_LIMIT_Z + 2, Math.min(this.map.ARENA_LIMIT_Z - 2, poolPos.z));
                    const floorY = this.map.getFloorHeightAt(poolPos.x, poolPos.z, pPos.y + 1.0);
                    const poolMesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(3.4 * areaMult, 3.6 * areaMult, 0.14, 16),
                        new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.62 })
                    );
                    poolMesh.position.set(poolPos.x, floorY + 0.08, poolPos.z);
                    this.scene.add(poolMesh);
                    this.firePools.push({ mesh: poolMesh, radius: 3.6 * areaMult, life: 6.5 * areaMult, maxLife: 6.5 * areaMult, tick: 0, dmg: 20 * powMult });
                }

                for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                    const a = this.enemies.aliens[i];
                    if (a.dying) continue;
                    const toA = a.group.position.clone().sub(pPos);
                    const dist = toA.length();
                    if ((dist < blastRange && toA.normalize().dot(forward) > 0.56) || dist < 10.0) {
                        a.polymerCoatTimer = 6.5 * areaMult;
                        a.burnTimer = Math.max(a.burnTimer, 5.2 * areaMult);
                        a.freezeTimer = 0;
                        this.damageAlien(a, power.power * powMult, a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), power.hex, false, 1.75, gameCtx);
                    }
                }
                gameCtx.showToast(`ПОЛИМЕРНЫЙ ОГОНЬ (${buffDur.toFixed(1)}с) • +40% УРОН`, power.color);
            } else if (power.id === 'timeslow') {
                const dur = power.duration * areaMult;
                this.timeSlowTimer = Math.max(this.timeSlowTimer, dur);
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 38, power.hex, 0.45);
                gameCtx.showToast(`ХРОНО-СДВИГ: ЗАМЕДЛЕНИЕ 0.22x (${dur.toFixed(1)}с)`, power.color);
            } else if (power.id === 'knockback') {
                const range = power.radius * areaMult;
                const force = 28 * powMult;
                let hitCount = 0;

                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.4, 0)), range * 0.75, power.hex, 0.34);
                this._spawnTracer(origin, origin.clone().addScaledVector(forward, range * 0.8), power.hex, 0.45);

                for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                    const a = this.enemies.aliens[i];
                    if (a.dying) continue;
                    const toA = a.group.position.clone().sub(pPos);
                    const dist = toA.length();
                    const dir = dist > 0.01 ? toA.clone().setY(0).normalize() : forward.clone().setY(0).normalize();
                    const inCone = dist < range && dir.dot(new THREE.Vector3(forward.x, 0, forward.z).normalize()) > 0.35;
                    if (inCone || dist < 11.5 * areaMult) {
                        a.knockVel.addScaledVector(dir, a.cfg.isBoss ? force * 0.45 : force);
                        a.shockTimer = Math.max(a.shockTimer, 2.2);
                        hitCount++;
                        this.damageAlien(a, power.power * powMult, a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), power.hex, false, 1.75, gameCtx);
                    }
                }
                // Also blow away incoming enemy projectiles!
                for (let b = this.enemies.enemyBullets.length - 1; b >= 0; b--) {
                    const bul = this.enemies.enemyBullets[b];
                    if (bul.mesh.position.distanceTo(pPos) < range) {
                        bul.vel.negate().multiplyScalar(1.8);
                        bul.reflected = true;
                    }
                }
                gameCtx.showToast(`УДАРНЫЙ ИМПУЛЬС: ОТКИНУТО ${hitCount}`, power.color);
            } else if (power.id === 'timestop') {
                const dur = power.duration * areaMult;
                this.timeStopTimer = Math.max(this.timeStopTimer, dur);
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 44, power.hex, 0.55);
                gameCtx.showToast(`ХРОНО-СТАЗИС: ПОЛНЫЙ СТОП (${dur.toFixed(1)}с)`, power.color);
            } else if (power.id === 'telekinesis') {
                let lifted = 0;
                const radius = power.radius * areaMult;
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.4, 0)), radius, power.hex, 0.42);
                for (const a of this.enemies.aliens) {
                    if (a.dying) continue;
                    if (a.group.position.distanceTo(pPos) <= radius && lifted < 14) {
                        a.telekinesisTimer = power.duration;
                        a.telekinesisSlammed = false;
                        lifted++;
                        this._spawnTracer(origin, a.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)), power.hex, 0.055);
                    }
                }
                gameCtx.showToast(`МАСС-ТЕЛЕКИНЕЗ: ПОДНЯТО ${lifted}`, power.color);
            } else if (power.id === 'shock_siphon') {
                const radius = power.radius * areaMult;
                let drained = 0;
                this._spawnShockwave(pPos.clone().add(new THREE.Vector3(0, 1.4, 0)), radius, power.hex, 0.36);
                for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                    const a = this.enemies.aliens[i];
                    if (a.dying) continue;
                    if (a.group.position.distanceTo(pPos) <= radius) {
                        a.shockTimer = Math.max(a.shockTimer, power.duration * areaMult);
                        const aCenter = a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                        this._spawnTracer(origin, aCenter, power.hex, 0.065);
                        this.damageAlien(a, power.power * powMult, aCenter, power.hex, false, 1.75, gameCtx);
                        drained++;
                    }
                }
                if (drained > 0) {
                    const healAmt = Math.min(140, drained * Math.round(14 * powMult));
                    gameCtx.restoreHpAndShield(healAmt, Math.round(healAmt * 0.7));
                }
                gameCtx.showToast(`ЭМИ-СИФОН: ЦЕЛЕЙ ${drained}`, power.color);
            } else if (power.id === 'polymer_turret') {
                const flatFwd = new THREE.Vector3(forward.x, 0, forward.z).normalize();
                const tx = Math.max(-this.map.ARENA_LIMIT_X + 3, Math.min(this.map.ARENA_LIMIT_X - 3, pPos.x + flatFwd.x * 3.8));
                const tz = Math.max(-this.map.ARENA_LIMIT_Z + 3, Math.min(this.map.ARENA_LIMIT_Z - 3, pPos.z + flatFwd.z * 3.8));
                const ty = this.map.getFloorHeightAt(tx, tz, pPos.y + 1.5);
                this._spawnShockwave(new THREE.Vector3(tx, ty + 0.8, tz), 3.2, power.hex, 0.28);
                this._spawnTracer(origin, new THREE.Vector3(tx, ty + 1.1, tz), power.hex, 0.08);
                if (gameCtx.building) {
                    gameCtx.building.spawnTurret('polymer', tx, ty, tz, power.duration * areaMult, gameCtx, {
                        damage: Math.round(power.power * powMult),
                        fireRate: Math.max(0.13, 0.26 / Math.sqrt(powMult)),
                        range: power.radius * areaMult
                    });
                }
                gameCtx.showToast(`ПОЛИМЕР-ТУРЕЛЬ РАЗВЁРНУТА (${Math.round(power.duration * areaMult)}с)`, power.color);
            }

            XB.events.emit('hud:sync');
            return true;
        }

        /**
         * Apex Armor Ultimate Passive: when shield hits 0, explodes ALL current Polymer into a 360° protective wave!
         */
        triggerShieldBreakPolymerNova(gameCtx) {
            if (this.shieldBreakNovaCooldown > 0 || this.polymerEnergy < 12) return false;
            const consumed = this.polymerEnergy;
            this.polymerEnergy = 0;
            this.shieldBreakNovaCooldown = 8.0;
            this.emergencyInvulnTimer = 1.6;

            const pPos = gameCtx.playerPos;
            const radius = 12 + consumed * 0.16; // Up to 28m+ wave!
            const dmg = Math.round(95 + consumed * 3.8);

            this.sound.playExplosion();
            this.sound.playGloveCast('knockback');
            XB.events.emit('camera:shake', { intensity: 0.36 });

            const center = pPos.clone().add(new THREE.Vector3(0, 1.4, 0));
            this._spawnShockwave(center, radius, 0x4ade80, 0.52);
            this._spawnShockwave(center, radius * 0.75, 0x67e8f9, 0.42);
            this._spawnParticles(center, 0x4ade80, 32, 16);

            // Launch 18 radial visible polymer energy bolts outward!
            for (let k = 0; k < 18; k++) {
                const ang = (k / 18) * Math.PI * 2;
                const dir = new THREE.Vector3(Math.cos(ang), 0.06, Math.sin(ang)).normalize();
                const boltMesh = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.32, 0),
                    new THREE.MeshBasicMaterial({ color: 0x4ade80 })
                );
                boltMesh.position.copy(center);
                this.scene.add(boltMesh);
                this.playerOrbs.push({
                    mesh: boltMesh,
                    vel: dir.multiplyScalar(36),
                    damage: Math.round(dmg * 0.45),
                    blastRadius: 4.5,
                    life: 0.9,
                    ratio: 0.8,
                    kind: 'polymer_wave'
                });
            }

            // Violent 360° knockback, shock, and damage on all nearby enemies
            for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                const a = this.enemies.aliens[i];
                if (a.dying) continue;
                const d = a.group.position.distanceTo(pPos);
                if (d <= radius + a.radius) {
                    const pushDir = a.group.position.clone().sub(pPos).setY(0).normalize();
                    a.knockVel.addScaledVector(pushDir, 28);
                    a.shockTimer = Math.max(a.shockTimer, 3.8);
                    this.damageAlien(a, dmg, a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0x4ade80, false, 1.75, gameCtx);
                }
            }

            // Vaporize nearby enemy projectiles
            for (let b = this.enemies.enemyBullets.length - 1; b >= 0; b--) {
                const bul = this.enemies.enemyBullets[b];
                if (bul.mesh.position.distanceTo(pPos) <= 18) {
                    if (bul.ringMesh) this.scene.remove(bul.ringMesh);
                    this.scene.remove(bul.mesh);
                    this.enemies.enemyBullets.splice(b, 1);
                }
            }

            gameCtx.restoreShield(38); // Emergency flicker shield
            this.polymerEnergy = 0; // Ensure all polymer is fully discharged by the emergency wave
            gameCtx.showToast(`АВАРИЙНЫЙ ВЫБРОС ПОЛИМЕРА (${Math.round(consumed)} ЭН)!`, '#4ade80');
            return true;
        }

        // =====================================================================
        // WEAPON FIRING: 12 WEAPONS + INFINITE-CHARGE POLYMER SPHERE "ГЕЛИОС-П"
        // =====================================================================
        launchPolymerBeam(weaponIdx, weaponCfg, stats, chargeSeconds, pumpedPolymer, gameCtx) {
            return this.launchPolymerSphere(weaponIdx, weaponCfg, stats, chargeSeconds, pumpedPolymer, gameCtx);
        }

        launchPolymerSphere(weaponIdx, weaponCfg, stats, chargeSeconds, pumpedPolymer, gameCtx) {
            const muzzleWorld = this.vm.getMuzzleWorldPos();
            this.vm.onWeaponFire(weaponIdx, weaponCfg, stats.recoilMult);
            this.sound.playPolySphereLaunch(chargeSeconds);

            const dmgMult = (gameCtx.armor ? gameCtx.armor.weaponDmgMult : 1.0)
                * (this.polymerFireBuffTimer > 0 ? 1.4 : 1.0);
            const effCharge = Math.max(0.08, chargeSeconds);
            const chargeScale = 0.75 + effCharge * 1.48 + (pumpedPolymer / 100) * 1.15;
            const sphereDamage = Math.round(stats.damage * dmgMult * chargeScale);
            const blastRadius = 6.2 + Math.min(34.0, effCharge * 4.8 + pumpedPolymer * 0.045);
            const orbRadius = Math.min(2.6, 0.44 + Math.sqrt(effCharge) * 0.66);

            XB.events.emit('camera:shake', { intensity: Math.min(0.65, 0.16 + effCharge * 0.09) });

            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
            const sphereGroup = new THREE.Group();
            const coreColor = effCharge > 3.0 ? 0xfacc15 : (effCharge > 1.2 ? 0x67e8f9 : 0x4ade80);

            const core = new THREE.Mesh(
                new THREE.SphereGeometry(orbRadius, 16, 16),
                new THREE.MeshBasicMaterial({ color: coreColor })
            );
            const cage = new THREE.Mesh(
                new THREE.IcosahedronGeometry(orbRadius * 1.38, 1),
                new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true, transparent: true, opacity: 0.72 })
            );
            const halo = new THREE.Mesh(
                new THREE.TorusGeometry(orbRadius * 1.62, Math.max(0.05, orbRadius * 0.12), 8, 24),
                new THREE.MeshBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.78 })
            );
            sphereGroup.add(core, cage, halo);
            sphereGroup.position.copy(muzzleWorld);
            this.scene.add(sphereGroup);

            const speed = 36 + Math.min(18, effCharge * 2.5);
            this.playerOrbs.push({
                mesh: sphereGroup,
                vel: dir.multiplyScalar(speed),
                gravity: 0,
                damage: sphereDamage,
                blastRadius,
                life: 4.5,
                ratio: Math.min(3.5, 0.45 + effCharge * 0.55),
                kind: 'polymer_sphere',
                zapTick: 0,
                orbRadius
            });
        }

        _collectTargetMeshes(includeWaveButtons) {
            const targetMeshes = [];
            if (includeWaveButtons) {
                for (const wm of this.map.waveButtonMeshes) targetMeshes.push(wm);
            }
            for (const a of this.enemies.aliens) {
                if (!a.dying) targetMeshes.push(a.group);
            }
            for (const b of this.map.barrels) {
                if (b.alive) targetMeshes.push(b.group);
            }
            for (const cm of this.map.coverMeshes) {
                targetMeshes.push(cm);
            }
            if (this.map.dynamicCoverMeshes && this.map.dynamicCoverMeshes.length > 0) {
                for (const dcm of this.map.dynamicCoverMeshes) targetMeshes.push(dcm);
            }
            return targetMeshes;
        }

        fireWeapon(weaponIdx, weaponCfg, stats, gameCtx) {
            const muzzleWorld = this.vm.getMuzzleWorldPos();
            this.vm.onWeaponFire(weaponIdx, weaponCfg, stats.recoilMult);
            this.sound.playShoot(weaponCfg.id);
            this.shotCounter++;

            const dmgMult = (gameCtx.armor ? gameCtx.armor.weaponDmgMult : 1.0)
                * (this.polymerFireBuffTimer > 0 ? 1.4 : 1.0);
            const triggerPolyBurst = stats.polyBurst && (this.shotCounter % 4 === 0);

            // 1. FLAMETHROWER
            if (weaponCfg.kind === 'flame') {
                const dir = new THREE.Vector3(
                    (Math.random() - 0.5) * stats.spread,
                    (Math.random() - 0.5) * stats.spread,
                    -1
                ).normalize().applyQuaternion(this.camera.quaternion);

                const puff = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(0.25, 0),
                    new THREE.MeshBasicMaterial({ color: Math.random() > 0.35 ? 0xff6b2b : 0xfacc15, transparent: true, opacity: 0.9 })
                );
                puff.position.copy(muzzleWorld);
                this.scene.add(puff);

                this.flamePuffs.push({
                    mesh: puff,
                    vel: dir.multiplyScalar(27 + Math.random() * 4),
                    damage: stats.damage * dmgMult,
                    life: 0.58,
                    maxLife: 0.58,
                    hitSet: new Set()
                });
                return;
            }

            // 2. CRYO GRENADE LAUNCHER ("МЕТЕЛЬ")
            if (weaponCfg.kind === 'cryo_grenade') {
                const dir = new THREE.Vector3(0, 0.14, -1).applyQuaternion(this.camera.quaternion).normalize();
                const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
                orb.position.copy(muzzleWorld);
                this.scene.add(orb);
                this.playerOrbs.push({
                    mesh: orb,
                    vel: dir.multiplyScalar(32),
                    gravity: 16,
                    damage: Math.round(stats.damage * dmgMult),
                    blastRadius: 8.2,
                    life: 3.2,
                    ratio: 0.8,
                    kind: 'cryo'
                });
                return;
            }

            // 3. HYDRA TRIPLE HOMING MICRO-MISSILES ("ГИДРА-3")
            if (weaponCfg.kind === 'micro_missile') {
                for (let m = 0; m < 3; m++) {
                    const spreadDir = new THREE.Vector3((m - 1) * 0.09, 0.04, -1).applyQuaternion(this.camera.quaternion).normalize();
                    const rocket = new THREE.Mesh(
                        new THREE.ConeGeometry(0.14, 0.45, 6),
                        new THREE.MeshBasicMaterial({ color: 0xf43f5e })
                    );
                    rocket.rotation.x = Math.PI / 2;
                    rocket.position.copy(muzzleWorld);
                    this.scene.add(rocket);
                    this.playerOrbs.push({
                        mesh: rocket,
                        vel: spreadDir.multiplyScalar(29),
                        gravity: 0,
                        damage: Math.round(stats.damage * dmgMult),
                        blastRadius: 4.8,
                        life: 3.4,
                        ratio: 0.55,
                        kind: 'homing'
                    });
                }
                return;
            }

            const targetMeshes = this._collectTargetMeshes(gameCtx.waveState === 'INTERMISSION');

            // 4. TESLA ARC «ЗЕВС»
            if (weaponCfg.kind === 'tesla') {
                this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
                const hits = this.raycaster.intersectObjects(targetMeshes, true);
                let firstAlien = null;
                let endPoint = new THREE.Vector3();
                this.raycaster.ray.at(58, endPoint);

                for (const h of hits) {
                    if (h.object.userData.isWaveButton && gameCtx.waveState === 'INTERMISSION') {
                        gameCtx.onWaveButtonHit();
                        endPoint.copy(h.point);
                        break;
                    }
                    if (h.object.userData.barrel && h.object.userData.barrel.alive) {
                        this._detonateBarrel(h.object.userData.barrel, gameCtx);
                        endPoint.copy(h.point);
                        break;
                    }
                    if (h.object.userData.isCover) {
                        endPoint.copy(h.point);
                        this._spawnParticles(h.point, weaponCfg.color, 6, 5);
                        break;
                    }
                    const alien = h.object.userData.alien;
                    if (alien && !alien.dying && alien.hp > 0) {
                        firstAlien = alien;
                        endPoint.copy(h.point);
                        break;
                    }
                }

                this._spawnTracer(muzzleWorld, endPoint, weaponCfg.color, weaponCfg.beamThickness);

                if (firstAlien) {
                    let anyKill = false;
                    const hitChain = new Set([firstAlien]);
                    let currPos = endPoint.clone();
                    firstAlien.shockTimer = 1.8;
                    if (this.damageAlien(firstAlien, stats.damage * dmgMult, endPoint, weaponCfg.color, false, stats.critMult, gameCtx)) {
                        anyKill = true;
                    }

                    for (let bounce = 0; bounce < 4; bounce++) {
                        let nextAlien = null;
                        let bestDist = 15.5;
                        for (const cand of this.enemies.aliens) {
                            if (hitChain.has(cand) || cand.dying || cand.hp <= 0) continue;
                            const cPos = cand.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                            const d = cPos.distanceTo(currPos);
                            if (d < bestDist) {
                                bestDist = d;
                                nextAlien = cand;
                            }
                        }
                        if (!nextAlien) break;
                        hitChain.add(nextAlien);
                        const nextPos = nextAlien.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                        this._spawnTracer(currPos, nextPos, 0x34d399, 0.065);
                        nextAlien.shockTimer = 1.6;
                        if (this.damageAlien(nextAlien, stats.damage * dmgMult * 0.8, nextPos, 0x6ee7b7, false, stats.critMult, gameCtx)) {
                            anyKill = true;
                        }
                        currPos = nextPos;
                    }
                    this.sound.playHit(anyKill);
                    XB.events.emit('combat:hit', { kill: anyKill });
                }
                return;
            }

            // 5. HITSCAN (Rifle, Shotgun, Minigun, SMG, Railgun, SCAR-H, Snipers)
            let anyHit = false;
            let anyKill = false;
            const aimSpreadMult = gameCtx.isAiming ? 0.3 : 1.0;

            for (let p = 0; p < weaponCfg.pellets; p++) {
                const sx = (Math.random() - 0.5) * 2 * stats.spread * aimSpreadMult;
                const sy = (Math.random() - 0.5) * 2 * stats.spread * aimSpreadMult;

                this.raycaster.setFromCamera(new THREE.Vector2(sx, sy), this.camera);
                const hits = this.raycaster.intersectObjects(targetMeshes, true);

                let endPoint = new THREE.Vector3();
                this.raycaster.ray.at(135, endPoint);

                const hitAliensThisRay = new Set();

                for (const h of hits) {
                    if (h.object.userData.isWaveButton && gameCtx.waveState === 'INTERMISSION') {
                        gameCtx.onWaveButtonHit();
                        endPoint.copy(h.point);
                        break;
                    }
                    if (h.object.userData.barrel && h.object.userData.barrel.alive) {
                        this._detonateBarrel(h.object.userData.barrel, gameCtx);
                        endPoint.copy(h.point);
                        if (!weaponCfg.piercing) break;
                    }
                    if (h.object.userData.isCover) {
                        endPoint.copy(h.point);
                        this._spawnParticles(h.point, weaponCfg.color, 4, 4);
                        break;
                    }
                    const alien = h.object.userData.alien;
                    if (alien && !alien.dying && alien.hp > 0 && !hitAliensThisRay.has(alien)) {
                        if (h.object.userData.isEnemyShield && !weaponCfg.piercing) {
                            this.sound.playShieldBlock();
                            this._spawnParticles(h.point, 0x34d399, 6, 6);
                            this.damageAlien(alien, stats.damage * dmgMult * 0.2, h.point, 0x34d399, false, stats.critMult, gameCtx);
                            hitAliensThisRay.add(alien);
                            anyHit = true;
                            endPoint.copy(h.point);
                            break;
                        }

                        hitAliensThisRay.add(alien);
                        const isHead = (h.object.userData.hitPart === 'head');
                        const dmg = stats.damage * dmgMult * (isHead ? stats.critMult : 1.0);
                        const killed = this.damageAlien(alien, dmg, h.point, weaponCfg.color, isHead, stats.critMult, gameCtx);
                        anyHit = true;
                        if (killed) anyKill = true;

                        // Attachment Core Perk: every 4th shot triggers small plasma splash!
                        if (triggerPolyBurst && p === 0) {
                            this._spawnShockwave(h.point, 4.2, 0xf97316, 0.24);
                            for (const nearby of this.enemies.aliens) {
                                if (!nearby.dying && nearby !== alien && nearby.group.position.distanceTo(h.point) < 4.5) {
                                    this.damageAlien(nearby, dmg * 0.55, nearby.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xf97316, false, stats.critMult, gameCtx);
                                }
                            }
                        }

                        if (!weaponCfg.piercing) {
                            endPoint.copy(h.point);
                            break;
                        }
                    }
                }

                this._spawnTracer(muzzleWorld, endPoint, weaponCfg.color, weaponCfg.beamThickness);
            }

            if (anyHit) {
                this.sound.playHit(anyKill);
                XB.events.emit('combat:hit', { kill: anyKill });
            }
        }

        launchNovaOrb(weaponIdx, weaponCfg, stats, ratio, gameCtx) {
            const muzzleWorld = this.vm.getMuzzleWorldPos();
            this.vm.onWeaponFire(weaponIdx, weaponCfg, stats.recoilMult);
            this.sound.playShoot(weaponCfg.id);
            XB.events.emit('camera:shake', { intensity: 0.18 * ratio });

            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
            const dmgMult = (gameCtx.armor ? gameCtx.armor.weaponDmgMult : 1.0)
                * (this.polymerFireBuffTimer > 0 ? 1.4 : 1.0);

            const orbRadius = 0.25 + ratio * 0.38;
            const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(orbRadius, 14, 14), new THREE.MeshBasicMaterial({ color: 0xa7f3d0 }));
            const halo = new THREE.Mesh(new THREE.SphereGeometry(orbRadius * 1.55, 12, 12), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45 }));
            orbMesh.add(halo);
            orbMesh.position.copy(muzzleWorld);
            this.scene.add(orbMesh);

            this.playerOrbs.push({
                mesh: orbMesh,
                vel: dir.multiplyScalar(34 + ratio * 16),
                gravity: 0,
                damage: Math.round(stats.damage * dmgMult * (0.38 + ratio * 0.96)),
                blastRadius: 6.2 + ratio * 8.5,
                life: 3.8,
                ratio,
                kind: 'nova'
            });
        }

        _detonatePlayerOrb(o, gameCtx) {
            const pos = o.mesh.position.clone();
            if (o.kind === 'cryo') {
                this.sound.playGloveCast('freeze');
                this._spawnParticles(pos, 0x67e8f9, 22, 12);
                this._spawnShockwave(pos, o.blastRadius, 0x67e8f9, 0.36);
            } else if (o.kind === 'polymer_sphere') {
                this.sound.playExplosion();
                this.sound.playGloveCast('knockback');
                XB.events.emit('camera:shake', { intensity: Math.min(0.55, 0.25 * o.ratio) });
                this._spawnParticles(pos, 0x4ade80, Math.min(48, Math.round(22 + o.ratio * 10)), 16);
                this._spawnShockwave(pos, o.blastRadius, 0x4ade80, 0.48);
                this._spawnShockwave(pos, o.blastRadius * 0.68, 0x67e8f9, 0.36);
                if (o.ratio > 1.6) {
                    this._spawnShockwave(pos, o.blastRadius * 0.4, 0xfacc15, 0.28);
                }
            } else {
                this.sound.playExplosion();
                XB.events.emit('camera:shake', { intensity: 0.28 * o.ratio });
                this._spawnParticles(pos, o.kind === 'homing' ? 0xf43f5e : 0x4ade80, 20, 12);
                this._spawnShockwave(pos, o.blastRadius, o.kind === 'homing' ? 0xf43f5e : 0x4ade80, 0.35);
            }

            if (gameCtx.waveState === 'INTERMISSION') {
                for (const wb of this.map.waveButtons) {
                    if (pos.distanceTo(new THREE.Vector3(wb.x, wb.y + 2.4, wb.z)) <= o.blastRadius + 2.0) {
                        gameCtx.onWaveButtonHit();
                        break;
                    }
                }
            }

            for (const b of this.map.barrels) {
                if (b.alive && Math.hypot(b.x - pos.x, b.z - pos.z) <= o.blastRadius) {
                    this._detonateBarrel(b, gameCtx);
                }
            }

            let anyHit = false;
            let anyKill = false;
            for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                const a = this.enemies.aliens[i];
                if (a.dying) continue;
                const center = a.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                const d = center.distanceTo(pos);
                if (d <= o.blastRadius + a.radius) {
                    const minFalloff = o.kind === 'polymer_sphere' ? 0.55 : 0.35;
                    const innerFull = d <= o.blastRadius * 0.48;
                    const falloff = innerFull ? 1.0 : Math.max(minFalloff, 1 - d / (o.blastRadius + a.radius + 1));
                    if (o.kind === 'cryo') {
                        a.freezeTimer = Math.max(a.freezeTimer, a.cfg.isBoss ? 2.0 : 3.8);
                    } else if (o.kind === 'polymer_sphere') {
                        const pushDir = center.clone().sub(pos).setY(0).normalize();
                        a.knockVel.addScaledVector(pushDir, 18 * Math.min(2.0, o.ratio));
                        a.shockTimer = Math.max(a.shockTimer, 2.5);
                        a.polymerCoatTimer = Math.max(a.polymerCoatTimer, 5.0);
                    } else {
                        const pushDir = center.clone().sub(pos).setY(0).normalize();
                        a.knockVel.addScaledVector(pushDir, 9 * falloff);
                    }
                    const killed = this.damageAlien(a, o.damage * falloff, center, o.kind === 'cryo' ? 0x67e8f9 : 0x4ade80, false, 1.75, gameCtx);
                    anyHit = true;
                    if (killed) anyKill = true;
                }
            }
            if (anyHit) {
                this.sound.playHit(anyKill);
                XB.events.emit('combat:hit', { kill: anyKill });
            }
        }

        _detonateBarrel(barrel, gameCtx) {
            if (!barrel.alive) return;
            barrel.alive = false;
            barrel.group.visible = false;

            const pos = new THREE.Vector3(barrel.x, 1.0, barrel.z);
            const isCryo = barrel.kind === 'cryo';
            const color = isCryo ? 0x67e8f9 : 0xf97316;
            const radius = 10.5;

            this.sound.playExplosion();
            XB.events.emit('camera:shake', { intensity: 0.25 });
            this._spawnParticles(pos, color, 24, 13);
            this._spawnShockwave(pos, radius, color, 0.38);

            for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                const a = this.enemies.aliens[i];
                if (a.dying) continue;
                const center = a.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                const d = center.distanceTo(pos);
                if (d <= radius) {
                    if (isCryo) a.freezeTimer = Math.max(a.freezeTimer, a.cfg.isBoss ? 2.5 : 5.0);
                    else a.burnTimer = Math.max(a.burnTimer, 4.5);
                    this.damageAlien(a, isCryo ? 85 : 155, center, color, false, 1.75, gameCtx);
                }
            }
        }

        triggerKineticLandSlam(pos, gameCtx) {
            this.sound.playExplosion();
            XB.events.emit('camera:shake', { intensity: 0.24 });
            this._spawnShockwave(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 10.0, 0xfb923c, 0.34);
            this._spawnParticles(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xfb923c, 16, 10);

            for (let i = this.enemies.aliens.length - 1; i >= 0; i--) {
                const a = this.enemies.aliens[i];
                if (a.dying) continue;
                const d = a.group.position.distanceTo(pos);
                if (d < 10.0) {
                    const push = a.group.position.clone().sub(pos).setY(0).normalize();
                    a.knockVel.addScaledVector(push, 14);
                    this.damageAlien(a, 115, a.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xfb923c, false, 1.75, gameCtx);
                }
            }
            gameCtx.showToast('УДАР ТИТАНА!', '#fb923c');
        }

        damageAlien(alien, damage, hitPoint, fxColor, isHeadshot, critMult, gameCtx) {
            if (alien.dying || alien.hp <= 0) return false;

            let finalDmg = damage;
            if (alien.freezeTimer > 0) finalDmg *= 1.65;
            if (this.polymerFireBuffTimer > 0) {
                alien.burnTimer = Math.max(alien.burnTimer, 3.0);
                alien.polymerCoatTimer = Math.max(alien.polymerCoatTimer, 3.0);
            } else if (alien.polymerCoatTimer > 0) {
                finalDmg *= 1.28;
            }

            alien.hp -= finalDmg;
            alien.hitFlash = 0.12;
            alien.flinchTimer = 0.16;
            this._spawnParticles(hitPoint, fxColor, isHeadshot ? 9 : 5, 6);

            if (alien.hp <= 0) {
                alien.dying = true;
                alien.deathTimer = 0.65;
                this.sound.playAlienDeath();

                this.polymerEnergy = Math.min(this.maxPolymerEnergy, this.polymerEnergy + (alien.cfg.isBoss ? 36 : 10));

                if (alien.freezeTimer > 0) {
                    this._spawnParticles(alien.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0x67e8f9, 18, 11);
                    this._spawnShockwave(alien.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 5.5, 0x67e8f9, 0.26);
                }

                gameCtx.onAlienKilled(alien);
                this.spawnLootBurst(alien);
                return true;
            }
            return false;
        }

        // =====================================================================
        // LOOT DROPS: COINS & CRYSTALS
        // =====================================================================
        spawnLootBurst(alien) {
            const basePos = alien.group.position;
            const cfg = alien.cfg;

            const coinCount = cfg.coinsMin + Math.floor(Math.random() * (cfg.coinsMax - cfg.coinsMin + 1));
            for (let c = 0; c < coinCount; c++) {
                this._spawnDynamicPickup(basePos.x, basePos.z, 'coin', 15);
            }

            if (Math.random() < cfg.crystalChance) {
                const crystalCount = cfg.isBoss ? 4 : (cfg.crystalValue >= 4 ? 2 : 1);
                const valPerCrystal = Math.max(1, Math.round(cfg.crystalValue / crystalCount));
                for (let k = 0; k < crystalCount; k++) {
                    this._spawnDynamicPickup(basePos.x, basePos.z, 'crystal', valPerCrystal);
                }
            }

            const supplyChance = cfg.isBoss ? 1.0 : (alien.type === 'brute' ? 0.65 : 0.2);
            if (Math.random() < supplyChance) {
                const r = Math.random();
                const sType = r < 0.28 ? 'hp' : (r < 0.54 ? 'shield' : (r < 0.74 ? 'ammo' : (r < 0.88 ? 'boost' : 'medkit')));
                this._spawnDynamicPickup(basePos.x, basePos.z, sType, 1);
            }
        }

        _spawnDynamicPickup(x, z, type, value) {
            const pk = this.spawnPickup(x, z, type, false, value);
            const ang = Math.random() * Math.PI * 2;
            const horiz = 2.5 + Math.random() * 4.5;
            pk.vel = new THREE.Vector3(Math.cos(ang) * horiz, 6.2 + Math.random() * 4.0, Math.sin(ang) * horiz);
            pk.mesh.position.y = 1.25;
            return pk;
        }

        spawnPickup(x, z, forcedType = null, isStatic = false, value = 1) {
            const type = forcedType || 'hp';
            const group = new THREE.Group();

            if (type === 'coin') {
                const coinMat = new THREE.MeshStandardMaterial({
                    color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.45, metalness: 0.85, roughness: 0.2
                });
                const disk = new THREE.Mesh(this._coinGeo, coinMat);
                const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.11, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
                inner.rotation.x = Math.PI / 2;
                group.add(disk, inner);
            } else if (type === 'crystal') {
                const cColor = value >= 4 ? 0xf59e0b : (value >= 2 ? 0x38bdf8 : 0x4ade80);
                const shard = new THREE.Mesh(this._crystalGeo, new THREE.MeshBasicMaterial({ color: cColor }));
                shard.scale.set(0.72, 1.35, 0.72);
                const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 6, 16), new THREE.MeshBasicMaterial({ color: 0xecfdf5, transparent: true, opacity: 0.75 }));
                halo.rotation.x = Math.PI / 2;
                group.add(shard, halo);
            } else if (type === 'medkit' || type === 'hp') {
                const box = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.52, 0.46), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
                const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
                const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.5), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
                group.add(box, c1, c2);
            } else if (type === 'boost') {
                const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 16), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
                group.add(core, ring);
            } else {
                const gemColor = type === 'shield' ? 0x34d399 : 0xfacc15;
                group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: gemColor })));
            }

            group.position.set(x, 1.0, z);
            this.scene.add(group);
            const pkObj = { mesh: group, type, value, life: isStatic ? 99999 : 34, isStatic, vel: null, baseY: 0.85 };
            this.pickups.push(pkObj);
            return pkObj;
        }

        /**
         * Automatically vacuums all remaining dropped Coins & Crystals across the entire arena when a wave ends!
         */
        collectRemainingWaveLoot(gameCtx) {
            let coinsCollected = 0;
            let crystalsCollected = 0;
            let count = 0;
            const target = gameCtx.playerPos.clone().add(new THREE.Vector3(0, 1.4, 0));

            for (let i = this.pickups.length - 1; i >= 0; i--) {
                const pk = this.pickups[i];
                if (pk.isStatic) continue;
                if (pk.type === 'coin' || pk.type === 'crystal') {
                    const pColor = pk.type === 'crystal' ? 0x67e8f9 : 0xfacc15;
                    this._spawnTracer(pk.mesh.position.clone(), target, pColor, 0.08);
                    this._spawnParticles(pk.mesh.position.clone(), pColor, 5, 7);
                    if (pk.type === 'coin') coinsCollected += pk.value;
                    else crystalsCollected += pk.value;
                    count++;

                    gameCtx.onCollectPickup(pk, true);
                    this.scene.remove(pk.mesh);
                    this.pickups.splice(i, 1);
                }
            }
            if (count > 0) {
                this.sound.playCrystal();
            }
            return { coins: coinsCollected, crystals: crystalsCollected, count };
        }

        // =====================================================================
        // UPDATE LOOP
        // =====================================================================
        update(dt, gameCtx) {
            const { playerPos, playerEyeHeight, armor } = gameCtx;

            this.polymerEnergy = Math.min(this.maxPolymerEnergy, this.polymerEnergy + 6.2 * dt);

            for (let i = 0; i < this.gloveCooldowns.length; i++) {
                if (this.gloveCooldowns[i] > 0) this.gloveCooldowns[i] = Math.max(0, this.gloveCooldowns[i] - dt);
            }
            if (this.shieldBreakNovaCooldown > 0) this.shieldBreakNovaCooldown = Math.max(0, this.shieldBreakNovaCooldown - dt);
            if (this.emergencyInvulnTimer > 0) this.emergencyInvulnTimer = Math.max(0, this.emergencyInvulnTimer - dt);

            if (this.aegisShieldTimer > 0) {
                this.aegisShieldTimer = Math.max(0, this.aegisShieldTimer - dt);
                this.shieldDomeMesh.visible = true;
                this.shieldDomeMesh.position.set(playerPos.x, playerPos.y + 1.35, playerPos.z);
                this.shieldDomeMesh.rotation.y += dt * 1.4;
                this.shieldDomeMesh.rotation.x += dt * 0.6;
                this.shieldDomeMesh.scale.setScalar(1.0 + Math.sin(performance.now() * 0.008) * 0.045);
            } else {
                this.shieldDomeMesh.visible = false;
            }

            if (this.polymerFireBuffTimer > 0) this.polymerFireBuffTimer = Math.max(0, this.polymerFireBuffTimer - dt);
            if (this.timeSlowTimer > 0) this.timeSlowTimer = Math.max(0, this.timeSlowTimer - dt);
            if (this.timeStopTimer > 0) this.timeStopTimer = Math.max(0, this.timeStopTimer - dt);

            // 1. Enemy Bullets & Grenades (CCD Anti-Tunneling, Stopped by Walls/Crafted Walls/Holo-Shields!)
            const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + playerEyeHeight * 0.62, playerPos.z);
            const bulletScale = this.timeStopTimer > 0 ? 0.0 : (this.timeSlowTimer > 0 ? 0.22 : 1.0);
            const prevBulletPos = new THREE.Vector3();

            const dmgTurretFn = gameCtx.onDamageTurret || (gameCtx.building ? (tr, d, att) => gameCtx.building.damageTurret(tr, d, att, gameCtx) : null);

            for (let i = this.enemies.enemyBullets.length - 1; i >= 0; i--) {
                const b = this.enemies.enemyBullets[i];
                const effDt = b.reflected ? dt : dt * bulletScale;
                if (effDt <= 0) continue;

                prevBulletPos.copy(b.mesh.position);
                b.life -= effDt;
                if (b.gravity > 0) b.vel.y -= b.gravity * effDt;
                b.mesh.position.addScaledVector(b.vel, effDt);

                const wallSweep = !b.reflected
                    ? this.map.segmentHitsObstacle(
                        prevBulletPos.x, prevBulletPos.y, prevBulletPos.z,
                        b.mesh.position.x, b.mesh.position.y, b.mesh.position.z,
                        { isEnemyProjectile: true, expand: 0.14 }
                    )
                    : this.map.segmentHitsObstacle(
                        prevBulletPos.x, prevBulletPos.y, prevBulletPos.z,
                        b.mesh.position.x, b.mesh.position.y, b.mesh.position.z,
                        { isEnemyProjectile: false, expand: 0.14 }
                    );

                if (b.isGrenade) {
                    if (b.ringMesh) {
                        const pulse = 1 + Math.sin(performance.now() * 0.015) * 0.14;
                        b.ringMesh.scale.set(pulse, pulse, 1);
                    }
                    const hitGround = b.mesh.position.y <= 0.25 || wallSweep.hit;
                    if (hitGround || b.life <= 0) {
                        const boomPos = wallSweep.hit && wallSweep.point ? wallSweep.point : b.mesh.position.clone();
                        this.sound.playExplosion();
                        this._spawnShockwave(boomPos, b.blastRadius, 0xf97316, 0.3);
                        this._spawnParticles(boomPos, 0xf97316, 14, 9);
                        if (boomPos.distanceTo(playerCenter) <= b.blastRadius &&
                            this.map.hasLineOfSight(boomPos.x, boomPos.y + 0.35, boomPos.z, playerCenter.x, playerCenter.y, playerCenter.z, true)) {
                            gameCtx.damagePlayer(b.damage, boomPos);
                        }
                        if (gameCtx.turrets && gameCtx.turrets.length > 0 && dmgTurretFn) {
                            for (let ti = gameCtx.turrets.length - 1; ti >= 0; ti--) {
                                const tr = gameCtx.turrets[ti];
                                if (!tr || tr.hp <= 0) continue;
                                const tx = tr.pos ? tr.pos.x : tr.x;
                                const ty = tr.pos ? tr.pos.y : tr.y;
                                const tz = tr.pos ? tr.pos.z : tr.z;
                                if (Math.hypot(tx - boomPos.x, tz - boomPos.z) <= b.blastRadius + 0.8 &&
                                    Math.abs(ty + 1.0 - boomPos.y) <= b.blastRadius + 1.0) {
                                    dmgTurretFn(tr, b.damage * 1.3, null);
                                }
                            }
                        }
                        if (b.ringMesh) this.scene.remove(b.ringMesh);
                        this.scene.remove(b.mesh);
                        this.enemies.enemyBullets.splice(i, 1);
                    }
                    continue;
                }

                if (wallSweep.hit) {
                    const hitPt = wallSweep.point || b.mesh.position;
                    const isHolo = wallSweep.box && wallSweep.box.isShieldScreen;
                    this._spawnParticles(hitPt, isHolo ? 0x34d399 : b.color, isHolo ? 8 : 5, 4);
                    if (isHolo) this.sound.playShieldBlock();
                    this.scene.remove(b.mesh);
                    this.enemies.enemyBullets.splice(i, 1);
                    continue;
                }

                if (!b.reflected && this.aegisShieldTimer > 0 && b.mesh.position.distanceTo(playerCenter) < 2.45) {
                    b.reflected = true;
                    b.vel.negate().multiplyScalar(2.1);
                    b.damage *= 2.5;
                    b.mesh.material.color.setHex(0x34d399);
                    this.sound.playShieldBlock();
                    this._spawnParticles(b.mesh.position, 0x34d399, 7, 6);
                    continue;
                }

                if (b.reflected) {
                    let hitAlien = false;
                    for (const a of this.enemies.aliens) {
                        if (a.dying) continue;
                        const aCenter = a.group.position.clone().add(new THREE.Vector3(0, 1.45 * a.baseScale, 0));
                        if (b.mesh.position.distanceTo(aCenter) < a.radius + 0.6) {
                            this.damageAlien(a, b.damage, b.mesh.position, 0x34d399, false, 1.75, gameCtx);
                            hitAlien = true;
                            break;
                        }
                    }
                    if (hitAlien) {
                        this.scene.remove(b.mesh);
                        this.enemies.enemyBullets.splice(i, 1);
                        continue;
                    }
                } else {
                    let hitTurret = false;
                    if (gameCtx.turrets && gameCtx.turrets.length > 0 && dmgTurretFn) {
                        for (let ti = gameCtx.turrets.length - 1; ti >= 0; ti--) {
                            const tr = gameCtx.turrets[ti];
                            if (!tr || tr.hp <= 0) continue;
                            const tx = tr.pos ? tr.pos.x : tr.x;
                            const ty = tr.pos ? tr.pos.y : tr.y;
                            const tz = tr.pos ? tr.pos.z : tr.z;
                            const dSqT = Math.pow(b.mesh.position.x - tx, 2) +
                                         Math.pow(b.mesh.position.y - (ty + 1.0), 2) +
                                         Math.pow(b.mesh.position.z - tz, 2);
                            if (dSqT < 1.55 * 1.55) {
                                dmgTurretFn(tr, b.damage * 1.25, null);
                                this._spawnParticles(b.mesh.position, b.color, 7, 4);
                                this.scene.remove(b.mesh);
                                this.enemies.enemyBullets.splice(i, 1);
                                hitTurret = true;
                                break;
                            }
                        }
                    }
                    if (hitTurret) continue;
                    if (b.mesh.position.distanceTo(playerCenter) < 1.35) {
                        gameCtx.damagePlayer(b.damage, b.mesh.position);
                        this._spawnParticles(b.mesh.position, b.color, 7, 4);
                        this.scene.remove(b.mesh);
                        this.enemies.enemyBullets.splice(i, 1);
                        continue;
                    }
                }

                const outBounds = Math.abs(b.mesh.position.x) > this.map.ARENA_LIMIT_X + 1 ||
                                  Math.abs(b.mesh.position.z) > this.map.ARENA_LIMIT_Z + 1;
                if (outBounds || b.life <= 0) {
                    this.scene.remove(b.mesh);
                    this.enemies.enemyBullets.splice(i, 1);
                }
            }

            // 2. Player Orbs (Nova, Cryo Grenade, Homing Micro-Missiles, Infinite-Charge Polymer Sphere)
            const prevOrbPos = new THREE.Vector3();
            for (let i = this.playerOrbs.length - 1; i >= 0; i--) {
                const o = this.playerOrbs[i];
                prevOrbPos.copy(o.mesh.position);
                o.life -= dt;
                if (o.gravity > 0) o.vel.y -= o.gravity * dt;

                if (o.kind === 'homing') {
                    let bestAlien = null;
                    let bestDist = 42;
                    for (const a of this.enemies.aliens) {
                        if (a.dying) continue;
                        const d = o.mesh.position.distanceTo(a.group.position);
                        if (d < bestDist) { bestDist = d; bestAlien = a; }
                    }
                    if (bestAlien) {
                        const targetPt = bestAlien.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                        const desiredDir = targetPt.sub(o.mesh.position).normalize().multiplyScalar(32);
                        o.vel.lerp(desiredDir, Math.min(1, dt * 6.5));
                    }
                }

                o.mesh.position.addScaledVector(o.vel, dt);
                if (o.kind === 'homing') {
                    o.mesh.lookAt(o.mesh.position.clone().add(o.vel));
                    o.trailAcc = (o.trailAcc || 0) + dt;
                    if (o.trailAcc >= 0.07) {
                        o.trailAcc = 0;
                        this._spawnParticles(o.mesh.position, 0xf43f5e, 1, 2.5);
                    }
                } else {
                    o.mesh.rotation.y += dt * 7;
                }
                if (o.kind === 'polymer_sphere') {
                    o.mesh.rotation.x += dt * 5;
                    // Radiation arcs while flying!
                    o.zapTick += dt;
                    if (o.zapTick >= 0.09) {
                        o.zapTick = 0;
                        const zapR = (o.orbRadius || 0.6) + 3.8;
                        for (const a of this.enemies.aliens) {
                            if (a.dying) continue;
                            const aCenter = a.group.position.clone().add(new THREE.Vector3(0, 1.4 * a.baseScale, 0));
                            if (o.mesh.position.distanceTo(aCenter) <= zapR + a.radius) {
                                this._spawnTracer(o.mesh.position, aCenter, 0x67e8f9, 0.055);
                                a.shockTimer = Math.max(a.shockTimer, 0.6);
                                this.damageAlien(a, Math.round(o.damage * 0.14), aCenter, 0x67e8f9, false, 1.75, gameCtx);
                            }
                        }
                    }
                }

                const orbWallHit = this.map.segmentHitsObstacle(
                    prevOrbPos.x, prevOrbPos.y, prevOrbPos.z,
                    o.mesh.position.x, o.mesh.position.y, o.mesh.position.z,
                    { isEnemyProjectile: false, expand: 0.16 }
                );

                let detonate = false;
                if (orbWallHit.hit && orbWallHit.point) {
                    o.mesh.position.copy(orbWallHit.point);
                    detonate = true;
                } else if (o.life <= 0 || o.mesh.position.y <= 0.25 ||
                    Math.abs(o.mesh.position.x) > this.map.ARENA_LIMIT_X + 1 ||
                    Math.abs(o.mesh.position.z) > this.map.ARENA_LIMIT_Z + 1) {
                    detonate = true;
                } else if (gameCtx.waveState === 'INTERMISSION') {
                    for (const wb of this.map.waveButtons) {
                        if (o.mesh.position.distanceTo(new THREE.Vector3(wb.x, wb.y + 2.4, wb.z)) < 2.2) {
                            detonate = true;
                            break;
                        }
                    }
                }
                if (!detonate) {
                    const orbHitR = o.orbRadius ? o.orbRadius + 0.7 : 1.0;
                    for (const a of this.enemies.aliens) {
                        if (a.dying) continue;
                        const aCenter = a.group.position.clone().add(new THREE.Vector3(0, 1.45 * a.baseScale, 0));
                        if (o.mesh.position.distanceTo(aCenter) < a.radius + orbHitR) {
                            detonate = true;
                            break;
                        }
                    }
                }
                if (detonate) {
                    this._detonatePlayerOrb(o, gameCtx);
                    this.scene.remove(o.mesh);
                    this.playerOrbs.splice(i, 1);
                }
            }

            // 3. Flame Puffs
            for (let i = this.flamePuffs.length - 1; i >= 0; i--) {
                const f = this.flamePuffs[i];
                f.life -= dt;
                f.mesh.position.addScaledVector(f.vel, dt);
                f.vel.multiplyScalar(Math.exp(-1.8 * dt));
                f.mesh.position.y += dt * 1.1;

                const progress = 1 - f.life / f.maxLife;
                f.mesh.scale.setScalar(1 + progress * 3.8);
                f.mesh.material.opacity = Math.max(0, (1 - progress) * 0.85);

                const hitWall = this.map.pointInsideObstacle(f.mesh.position);
                if (!hitWall) {
                    if (gameCtx.waveState === 'INTERMISSION') {
                        for (const wb of this.map.waveButtons) {
                            if (f.mesh.position.distanceTo(new THREE.Vector3(wb.x, wb.y + 2.4, wb.z)) < 2.4) {
                                gameCtx.onWaveButtonHit();
                            }
                        }
                    }
                    const puffRadius = 0.72 + progress * 1.5;
                    for (let j = this.enemies.aliens.length - 1; j >= 0; j--) {
                        const a = this.enemies.aliens[j];
                        if (a.dying || f.hitSet.has(a)) continue;
                        const aCenter = a.group.position.clone().add(new THREE.Vector3(0, 1.35 * a.baseScale, 0));
                        if (f.mesh.position.distanceTo(aCenter) < a.radius + puffRadius) {
                            f.hitSet.add(a);
                            a.burnTimer = 3.5;
                            const killed = this.damageAlien(a, f.damage, f.mesh.position, 0xff6b2b, false, 1.75, gameCtx);
                            XB.events.emit('combat:hit', { kill: killed });
                        }
                    }
                }
                if (f.life <= 0 || hitWall) {
                    this.scene.remove(f.mesh);
                    f.mesh.geometry.dispose();
                    f.mesh.material.dispose();
                    this.flamePuffs.splice(i, 1);
                }
            }

            // 4. Fire Pools
            for (let i = this.firePools.length - 1; i >= 0; i--) {
                const fp = this.firePools[i];
                fp.life -= dt;
                fp.tick += dt;
                fp.mesh.material.opacity = Math.max(0, (fp.life / fp.maxLife) * 0.65);
                if (fp.tick >= 0.35) {
                    fp.tick = 0;
                    for (let j = this.enemies.aliens.length - 1; j >= 0; j--) {
                        const a = this.enemies.aliens[j];
                        if (a.dying) continue;
                        const d = Math.hypot(a.group.position.x - fp.mesh.position.x, a.group.position.z - fp.mesh.position.z);
                        if (d <= fp.radius + a.radius) {
                            a.burnTimer = Math.max(a.burnTimer, 3.0);
                            a.polymerCoatTimer = Math.max(a.polymerCoatTimer, 3.0);
                            this.damageAlien(a, fp.dmg, a.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xf97316, false, 1.75, gameCtx);
                        }
                    }
                }
                if (fp.life <= 0) {
                    this.scene.remove(fp.mesh);
                    fp.mesh.geometry.dispose();
                    fp.mesh.material.dispose();
                    this.firePools.splice(i, 1);
                }
            }

            // 5. Shockwaves, Tracers, Particles
            for (let i = this.shockwaves.length - 1; i >= 0; i--) {
                const s = this.shockwaves[i];
                s.life -= dt;
                const p = 1 - s.life / s.maxLife;
                s.mesh.scale.setScalar(0.5 + p * s.maxR);
                s.mesh.material.opacity = Math.max(0, (1 - p) * 0.55);
                if (s.life <= 0) {
                    this.scene.remove(s.mesh);
                    s.mesh.geometry.dispose();
                    s.mesh.material.dispose();
                    this.shockwaves.splice(i, 1);
                }
            }

            for (let i = this.tracers.length - 1; i >= 0; i--) {
                const t = this.tracers[i];
                t.life -= dt;
                t.mesh.material.opacity = Math.max(0, t.life / t.maxLife);
                if (t.life <= 0) {
                    this.scene.remove(t.mesh);
                    t.mesh.geometry.dispose();
                    t.mesh.material.dispose();
                    this.tracers.splice(i, 1);
                }
            }

            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= dt;
                p.vel.y -= 14 * dt;
                p.mesh.position.addScaledVector(p.vel, dt);
                if (p.mesh.position.y < 0.1) {
                    p.mesh.position.y = 0.1;
                    p.vel.y *= -0.35;
                }
                p.mesh.rotation.x += dt * 6;
                p.mesh.rotation.y += dt * 6;
                p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    p.mesh.material.dispose();
                    this.particles.splice(i, 1);
                }
            }

            // 6. Magnetic Loot Pickups
            const now = performance.now() * 0.004;
            const magnetR = armor ? armor.lootMagnetRadius : 3.6;

            for (let i = this.pickups.length - 1; i >= 0; i--) {
                const pk = this.pickups[i];
                if (!pk.isStatic && gameCtx.waveState !== 'INTERMISSION') pk.life -= dt;
                pk.mesh.rotation.y += dt * (pk.type === 'coin' ? 4.2 : 2.6);

                if (pk.vel) {
                    pk.vel.y -= 18 * dt;
                    pk.mesh.position.addScaledVector(pk.vel, dt);
                    const floorY = this.map.getFloorHeightAt(pk.mesh.position.x, pk.mesh.position.z, pk.mesh.position.y) + 0.65;
                    if (pk.mesh.position.y <= floorY) {
                        pk.mesh.position.y = floorY;
                        pk.vel.y *= -0.45;
                        pk.vel.x *= 0.68;
                        pk.vel.z *= 0.68;
                        if (Math.abs(pk.vel.y) < 0.8) {
                            pk.baseY = floorY;
                            pk.vel = null;
                        }
                    }
                } else {
                    pk.mesh.position.y = pk.baseY + Math.sin(now + i) * 0.2;
                }

                const dx = playerPos.x - pk.mesh.position.x;
                const dz = playerPos.z - pk.mesh.position.z;
                const dist = Math.hypot(dx, dz);

                const effMagR = pk.type === 'crystal' ? Math.max(8.5, magnetR + 2.8) : magnetR;
                if (!pk.isStatic && (pk.type === 'coin' || pk.type === 'crystal') && dist < effMagR && dist > 0.1) {
                    const pullSpd = 21.0 * (1 - dist / (effMagR + 1.5)) + 8.0;
                    pk.mesh.position.x += (dx / dist) * pullSpd * dt;
                    pk.mesh.position.z += (dz / dist) * pullSpd * dt;
                }

                if (dist < 2.35 && Math.abs(playerPos.y - pk.mesh.position.y) < 3.5) {
                    gameCtx.onCollectPickup(pk);
                    this.scene.remove(pk.mesh);
                    this.pickups.splice(i, 1);
                } else if (pk.life <= 0) {
                    this.scene.remove(pk.mesh);
                    this.pickups.splice(i, 1);
                }
            }
        }

        _spawnShockwave(pos, maxR, color, life = 0.36) {
            const waveMesh = new THREE.Mesh(
                new THREE.SphereGeometry(1, 18, 18),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
            );
            waveMesh.position.copy(pos);
            this.scene.add(waveMesh);
            this.shockwaves.push({ mesh: waveMesh, maxR, life, maxLife: life });
        }

        _spawnTracer(start, end, color, thickness) {
            const dist = start.distanceTo(end);
            if (dist < 0.05) return;
            const geo = new THREE.CylinderGeometry(thickness * 0.5, thickness * 0.5, dist, 6);
            geo.rotateX(Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(start).lerp(end, 0.5);
            mesh.lookAt(end);
            this.scene.add(mesh);
            this.tracers.push({ mesh, life: 0.085, maxLife: 0.085 });
        }

        _spawnParticles(pos, color, count, speed) {
            for (let i = 0; i < count; i++) {
                const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
                const mesh = new THREE.Mesh(this._particleGeo, mat);
                mesh.position.copy(pos);
                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 1.4,
                    (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
                this.scene.add(mesh);
                this.particles.push({ mesh, vel, life: 0.34 + Math.random() * 0.28, maxLife: 0.62 });
            }
        }
    }

    XB.CombatSystem = CombatSystem;
})(window);
