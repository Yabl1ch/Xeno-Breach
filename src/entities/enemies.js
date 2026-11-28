/**
 * Articulated Combat Robots & Bio-Mechs:
 *  - Melee Tanks (Scout, Leaper, Shieldbearer-Tank, Brute-Colossus) charge & fight in melee!
 *  - Ranged Specialists (Spitter, Sniper Drone "ОСА" with Laser Telegraph, Grenadier "МОРТИРА" with Mortar Arcs)
 *  - Visible metallic servo joints, attack windup animations, stun/knockback physics, Time-Slow & Time-Stop!
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class EnemySystem {
        constructor(scene, mapBuilder, soundEngine) {
            this.scene = scene;
            this.map = mapBuilder;
            this.sound = soundEngine;

            this.aliens = [];
            this.enemyBullets = [];
            this.flowUpdateTimer = 0;

            this._geoCache = new Map();
            this._matCache = new Map();
            this._vToP = new THREE.Vector3();
            this._vMove = new THREE.Vector3();
            this._vTmp = new THREE.Vector3();
            this._vOrigin = new THREE.Vector3();
            this._vTarget = new THREE.Vector3();
            this._vTurret = new THREE.Vector3();
            this._vFlow = new THREE.Vector3();
            this._yAxis = new THREE.Vector3(0, 1, 0);
            this._zeroVel = { x: 0, y: 0, z: 0 };

            this._iceGeo = this._getGeo('iceShell', () => new THREE.OctahedronGeometry(1.15, 0));
            this._jointGeo = this._getGeo('servoJoint', () => new THREE.SphereGeometry(0.115, 8, 8));
        }

        _getGeo(key, factory) {
            let g = this._geoCache.get(key);
            if (!g) {
                g = factory();
                this._geoCache.set(key, g);
            }
            return g;
        }

        _getMat(key, factory) {
            let m = this._matCache.get(key);
            if (!m) {
                m = factory();
                this._matCache.set(key, m);
            }
            return m;
        }

        clearAll() {
            for (const a of this.aliens) {
                if (a.laserLine) this.scene.remove(a.laserLine);
                this.scene.remove(a.group);
            }
            this.aliens = [];
            for (const b of this.enemyBullets) {
                if (b.ringMesh) this.scene.remove(b.ringMesh);
                this.scene.remove(b.mesh);
            }
            this.enemyBullets = [];
        }

        getAliveCount() {
            let count = 0;
            for (const a of this.aliens) {
                if (!a.dying) count++;
            }
            return count;
        }

        spawnAlien(type, waveNum, door) {
            const base = XB.ENEMY_TYPES[type] || XB.ENEMY_TYPES.scout;
            const hp = Math.round(base.hpBase + waveNum * base.hpPerWave);
            const speed = base.speed + Math.min(waveNum * 0.25, base.speedMaxBonus);
            const scaledDamage = Math.round(base.damage * (1 + Math.min(1.6, Math.max(0, waveNum - 1) * 0.085)));

            const group = new THREE.Group();
            const hipPivot = new THREE.Group();
            group.add(hipPivot);

            const skinMat = new THREE.MeshStandardMaterial({
                color: base.bodyColor,
                roughness: 0.34,
                metalness: 0.58,
                emissive: base.bodyColor,
                emissiveIntensity: 0.16
            });
            const armorMat = this._getMat('armor_' + base.armorColor, () => new THREE.MeshStandardMaterial({
                color: base.armorColor,
                roughness: 0.30,
                metalness: 0.86
            }));
            const armorTrimMat = this._getMat('armorTrim', () => new THREE.MeshStandardMaterial({
                color: 0x0f172a,
                roughness: 0.28,
                metalness: 0.90
            }));
            const servoMat = this._getMat('servo', () => new THREE.MeshStandardMaterial({
                color: 0x64748b,
                roughness: 0.24,
                metalness: 0.92
            }));
            const eyeMat = this._getMat('eye_' + base.eyeColor, () => new THREE.MeshBasicMaterial({ color: base.eyeColor }));

            // Layered Pelvis & Hip Piston Plates
            hipPivot.position.y = 1.1;
            const pelvis = new THREE.Mesh(this._getGeo('pelvis', () => new THREE.BoxGeometry(0.62, 0.24, 0.42)), armorMat);
            pelvis.userData.hitPart = 'body';
            const waistPistonGeo = this._getGeo('waistPiston', () => new THREE.CylinderGeometry(0.05, 0.05, 0.34, 6));
            const waistPistonL = new THREE.Mesh(waistPistonGeo, servoMat);
            waistPistonL.position.set(-0.22, 0.16, 0.14);
            const waistPistonR = new THREE.Mesh(waistPistonGeo, servoMat);
            waistPistonR.position.set(0.22, 0.16, 0.14);
            hipPivot.add(pelvis, waistPistonL, waistPistonR);

            // Multi-Segment Articulated Cyber-Tail for Agile Stalkers
            let tailPivot = null;
            if (type === 'scout' || type === 'leaper') {
                tailPivot = new THREE.Group();
                tailPivot.position.set(0, 0.06, -0.22);
                const t1 = new THREE.Mesh(this._getGeo('tail1', () => new THREE.CylinderGeometry(0.06, 0.08, 0.44, 6)), armorMat);
                t1.rotation.x = -Math.PI / 2.6;
                t1.position.set(0, 0.06, -0.22);
                const t2 = new THREE.Mesh(this._getGeo('tail2', () => new THREE.ConeGeometry(0.055, 0.45, 5)), eyeMat);
                t2.rotation.x = -Math.PI / 2.1;
                t2.position.set(0, 0.14, -0.56);
                t1.userData.hitPart = 'body';
                t2.userData.hitPart = 'body';
                tailPivot.add(t1, t2);
                hipPivot.add(tailPivot);
            }

            const torsoPivot = new THREE.Group();
            torsoPivot.position.y = 0.12;
            torsoPivot.rotation.x = base.torsoLean;
            hipPivot.add(torsoPivot);

            const abdomen = new THREE.Mesh(this._getGeo('abdomen', () => new THREE.CylinderGeometry(0.25, 0.2, 0.38, 10)), servoMat);
            abdomen.position.y = 0.18;
            abdomen.userData.hitPart = 'body';
            torsoPivot.add(abdomen);

            // Layered Industrial Carapace Chassis + Reactive Armor Plates
            const isHeavyFrame = (type === 'brute' || type === 'overlord');
            const isShieldFrame = (type === 'shieldbearer');
            const chestKey = isHeavyFrame ? 'heavy' : (isShieldFrame ? 'shield' : 'std');
            const chestW = isHeavyFrame ? 1.18 : (isShieldFrame ? 0.92 : 0.72);
            const chest = new THREE.Mesh(this._getGeo('chest_' + chestKey, () => new THREE.BoxGeometry(chestW, 0.62, 0.48)), armorMat);
            chest.position.y = 0.58;
            chest.castShadow = true;
            chest.userData.hitPart = 'body';
            torsoPivot.add(chest);

            const chestFront = new THREE.Mesh(this._getGeo('chestFront_' + chestKey, () => new THREE.BoxGeometry(chestW * 0.84, 0.44, 0.14)), skinMat);
            chestFront.position.set(0, 0.6, 0.24);
            chestFront.rotation.x = -0.14;
            chestFront.userData.hitPart = 'body';
            torsoPivot.add(chestFront);

            const chestPlateGeo = this._getGeo('chestPlate_' + chestKey, () => new THREE.BoxGeometry(chestW * 0.28, 0.38, 0.08));
            const chestPlateL = new THREE.Mesh(chestPlateGeo, armorTrimMat);
            chestPlateL.position.set(-chestW * 0.26, 0.59, 0.31);
            chestPlateL.rotation.set(-0.14, 0.18, 0);
            const chestPlateR = new THREE.Mesh(chestPlateGeo, armorTrimMat);
            chestPlateR.position.set(chestW * 0.26, 0.59, 0.31);
            chestPlateR.rotation.set(-0.14, -0.18, 0);
            torsoPivot.add(chestPlateL, chestPlateR);

            // Collar Armor Guards & Exhaust Vents
            const collarGeo = this._getGeo('collar', () => new THREE.BoxGeometry(0.2, 0.16, 0.36));
            const ventGeo = this._getGeo('vent', () => new THREE.BoxGeometry(0.1, 0.22, 0.08));
            [-chestW * 0.34, chestW * 0.34].forEach(vx => {
                const collar = new THREE.Mesh(collarGeo, armorMat);
                collar.position.set(vx, 0.9, 0.04);
                collar.rotation.z = vx < 0 ? 0.25 : -0.25;
                const vent = new THREE.Mesh(ventGeo, eyeMat);
                vent.position.set(vx, 0.7, 0.29);
                torsoPivot.add(collar, vent);
            });

            // Dorsal Reactor / Spine Vertebrae / Mortar Tube / Exhaust Stacks
            const spinePack = new THREE.Mesh(this._getGeo('spine_' + chestKey, () => new THREE.BoxGeometry(chestW * 0.56, 0.56, 0.3)), skinMat);
            spinePack.position.set(0, 0.58, -0.32);
            spinePack.userData.hitPart = 'body';
            torsoPivot.add(spinePack);

            let backTurbine = null;
            if (isHeavyFrame) {
                const stackGeo = this._getGeo('exStack', () => new THREE.CylinderGeometry(0.085, 0.11, 0.68, 8));
                const capGeo = this._getGeo('exCap', () => new THREE.CylinderGeometry(0.1, 0.09, 0.12, 8));
                [-0.36, 0.36].forEach(ex => {
                    const stack = new THREE.Mesh(stackGeo, servoMat);
                    stack.position.set(ex, 1.06, -0.36);
                    stack.rotation.x = -0.25;
                    const cap = new THREE.Mesh(capGeo, eyeMat);
                    cap.position.set(ex, 1.38, -0.44);
                    cap.rotation.x = -0.25;
                    torsoPivot.add(stack, cap);
                });
                const turbCowling = new THREE.Mesh(this._getGeo('turbCowling', () => new THREE.TorusGeometry(0.24, 0.045, 6, 16)), armorMat);
                turbCowling.position.set(0, 0.62, -0.5);
                backTurbine = new THREE.Mesh(this._getGeo('backTurbine', () => new THREE.OctahedronGeometry(0.18, 0)), eyeMat);
                backTurbine.position.set(0, 0.62, -0.5);
                torsoPivot.add(turbCowling, backTurbine);
            }

            let ammoDrum = null;
            if (type === 'grenadier') {
                const mortar = new THREE.Mesh(this._getGeo('mortar', () => new THREE.CylinderGeometry(0.18, 0.21, 0.82, 12)), armorMat);
                mortar.position.set(0, 0.98, -0.26);
                mortar.rotation.x = -0.38;
                const mRim = new THREE.Mesh(this._getGeo('mRim', () => new THREE.TorusGeometry(0.18, 0.035, 6, 16)), eyeMat);
                mRim.position.set(0, 1.35, -0.4);
                mRim.rotation.x = Math.PI / 2 - 0.38;
                ammoDrum = new THREE.Mesh(this._getGeo('ammoDrum', () => new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10)), skinMat);
                ammoDrum.rotation.z = Math.PI / 2;
                ammoDrum.position.set(-0.34, 0.56, -0.22);
                const mast = new THREE.Mesh(this._getGeo('mast', () => new THREE.BoxGeometry(0.08, 0.42, 0.08)), servoMat);
                mast.position.set(0.32, 0.98, 0.04);
                const sensor = new THREE.Mesh(this._getGeo('sensor', () => new THREE.BoxGeometry(0.12, 0.1, 0.18)), eyeMat);
                sensor.position.set(0.32, 1.2, 0.08);
                torsoPivot.add(mortar, mRim, ammoDrum, mast, sensor);
            }

            const thrusterGlows = [];
            if (type === 'leaper' || type === 'sniper' || type === 'overlord') {
                const podGeo = this._getGeo('pod', () => new THREE.CylinderGeometry(0.09, 0.12, 0.48, 8));
                const flameGeo = this._getGeo('flame', () => new THREE.ConeGeometry(0.1, 0.34, 6));
                [-0.26, 0.26].forEach(tx => {
                    const pod = new THREE.Mesh(podGeo, armorMat);
                    pod.position.set(tx, 0.66, -0.42);
                    pod.rotation.x = -0.35;
                    const flame = new THREE.Mesh(flameGeo, eyeMat);
                    flame.position.set(tx, 0.38, -0.5);
                    flame.rotation.x = Math.PI - 0.35;
                    torsoPivot.add(pod, flame);
                    thrusterGlows.push(flame);
                });
            }

            // Glowing Reactor Core + Armored Cage on Chest
            const coreGlow = new THREE.Mesh(this._getGeo('coreGlow', () => new THREE.OctahedronGeometry(0.2, 0)), eyeMat);
            coreGlow.position.set(0, 0.58, 0.3);
            coreGlow.userData.hitPart = 'body';
            const coreFrame = new THREE.Mesh(this._getGeo('coreFrame', () => new THREE.TorusGeometry(0.22, 0.03, 6, 16)), servoMat);
            coreFrame.position.copy(coreGlow.position);
            torsoPivot.add(coreGlow, coreFrame);

            // Shoulder Servo Joints + Layered Angular Armor Pauldrons + Hydraulic Dampers
            const shX = isHeavyFrame ? 0.72 : (isShieldFrame ? 0.56 : 0.47);
            const shoulderGeo = this._getGeo('shoulder_' + (isHeavyFrame ? 'heavy' : 'std'), () => new THREE.BoxGeometry(
                isHeavyFrame ? 0.46 : 0.3,
                isHeavyFrame ? 0.36 : 0.24,
                isHeavyFrame ? 0.48 : 0.34
            ));
            const shL = new THREE.Mesh(shoulderGeo, armorMat);
            const shR = new THREE.Mesh(shoulderGeo, armorMat);
            shL.position.set(-shX, 0.82, 0); shL.rotation.z = 0.22;
            shR.position.set( shX, 0.82, 0); shR.rotation.z = -0.22;
            const shTrimGeo = this._getGeo('shTrim', () => new THREE.BoxGeometry(0.12, 0.08, 0.36));
            const shTrimL = new THREE.Mesh(shTrimGeo, eyeMat);
            const shTrimR = new THREE.Mesh(shTrimGeo, eyeMat);
            shTrimL.position.set(-shX - 0.05, 0.94, 0);
            shTrimR.position.set( shX + 0.05, 0.94, 0);
            const shPistonGeo = this._getGeo('shPiston', () => new THREE.CylinderGeometry(0.038, 0.038, 0.32, 6));
            const shPistonL = new THREE.Mesh(shPistonGeo, servoMat);
            shPistonL.position.set(-shX + 0.14, 0.66, -0.14);
            shPistonL.rotation.z = -0.35;
            const shPistonR = new THREE.Mesh(shPistonGeo, servoMat);
            shPistonR.position.set(shX - 0.14, 0.66, -0.14);
            shPistonR.rotation.z = 0.35;
            torsoPivot.add(shL, shR, shTrimL, shTrimR, shPistonL, shPistonR);

            // Boss shoulder rail-cannons (Brute stays pure melee tank!)
            if (type === 'overlord') {
                const cannonGeo = this._getGeo('bossCannon', () => new THREE.CylinderGeometry(0.12, 0.14, 0.85, 8));
                const tipGeo = this._getGeo('bossCannonTip', () => new THREE.SphereGeometry(0.11, 8, 8));
                [-shX, shX].forEach(sx => {
                    const cannon = new THREE.Mesh(cannonGeo, armorMat);
                    cannon.rotation.x = Math.PI / 2;
                    cannon.position.set(sx, 1.12, 0.28);
                    const tip = new THREE.Mesh(tipGeo, eyeMat);
                    tip.position.set(sx, 1.12, 0.72);
                    torsoPivot.add(cannon, tip);
                });
            }

            // Head + Hydraulic Servo Neck + Armored Exo-Helmet & Optics (Headshot x1.75!)
            const neck = new THREE.Mesh(this._getGeo('neck', () => new THREE.CylinderGeometry(0.12, 0.15, 0.2, 8)), servoMat);
            neck.position.set(0, 0.95, 0.04);
            neck.userData.hitPart = 'head';
            torsoPivot.add(neck);

            const headGroup = new THREE.Group();
            headGroup.position.set(0, 1.22, 0.08);
            torsoPivot.add(headGroup);

            const cranium = new THREE.Mesh(this._getGeo('cranium', () => new THREE.BoxGeometry(0.46, 0.42, 0.48)), skinMat);
            cranium.userData.hitPart = 'head';
            headGroup.add(cranium);

            const helmBrow = new THREE.Mesh(this._getGeo('helmBrow', () => new THREE.BoxGeometry(0.5, 0.14, 0.52)), armorMat);
            helmBrow.position.set(0, 0.17, 0.02);
            helmBrow.userData.hitPart = 'head';
            headGroup.add(helmBrow);

            const helmVisorFrame = new THREE.Mesh(this._getGeo('helmVisorFrame', () => new THREE.BoxGeometry(0.48, 0.18, 0.16)), armorTrimMat);
            helmVisorFrame.position.set(0, 0.04, 0.19);
            helmVisorFrame.userData.hitPart = 'head';
            headGroup.add(helmVisorFrame);

            const jaw = new THREE.Mesh(this._getGeo('jaw', () => new THREE.BoxGeometry(0.32, 0.16, 0.34)), armorMat);
            jaw.position.set(0, -0.18, 0.12);
            jaw.userData.hitPart = 'head';
            headGroup.add(jaw);

            if (isHeavyFrame) {
                const hornCount = type === 'overlord' ? 2 : 1;
                for (let h = 0; h < hornCount; h++) {
                    const hornGeo = this._getGeo('horn_' + h, () => new THREE.ConeGeometry(0.09, 0.58 + h * 0.16, 6));
                    const hL = new THREE.Mesh(hornGeo, armorMat);
                    const hR = new THREE.Mesh(hornGeo, armorMat);
                    hL.position.set(-0.24 - h * 0.08, 0.32 + h * 0.08, 0.02); hL.rotation.z = 0.45 + h * 0.2;
                    hR.position.set( 0.24 + h * 0.08, 0.32 + h * 0.08, 0.02); hR.rotation.z = -0.45 - h * 0.2;
                    hL.userData.hitPart = 'head'; hR.userData.hitPart = 'head';
                    headGroup.add(hL, hR);
                }
                const triadVisor = new THREE.Mesh(this._getGeo('triadVisor', () => new THREE.BoxGeometry(0.44, 0.10, 0.12)), eyeMat);
                triadVisor.position.set(0, 0.03, 0.25);
                triadVisor.userData.hitPart = 'head';
                headGroup.add(triadVisor);
            } else if (type === 'sniper') {
                const lens = new THREE.Mesh(this._getGeo('sniperLens', () => new THREE.CylinderGeometry(0.12, 0.12, 0.26, 12)), eyeMat);
                lens.rotation.x = Math.PI / 2;
                lens.position.set(0, 0.04, 0.26);
                lens.userData.hitPart = 'head';
                const scopeSide = new THREE.Mesh(this._getGeo('sniperSideLens', () => new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8)), eyeMat);
                scopeSide.rotation.x = Math.PI / 2;
                scopeSide.position.set(0.16, 0.08, 0.24);
                scopeSide.userData.hitPart = 'head';
                const ant = new THREE.Mesh(this._getGeo('sniperAnt', () => new THREE.CylinderGeometry(0.02, 0.02, 0.65, 6)), servoMat);
                ant.position.set(0.2, 0.42, -0.14);
                ant.userData.hitPart = 'head';
                headGroup.add(lens, scopeSide, ant);
            } else {
                const visor = new THREE.Mesh(this._getGeo('stdVisor', () => new THREE.BoxGeometry(0.40, 0.10, 0.18)), eyeMat);
                visor.position.set(0, 0.04, 0.22);
                visor.userData.hitPart = 'head';
                headGroup.add(visor);
            }

            // Articulated Robotic Arms with Hydraulic Braces & Weapons
            const shEnergyMat = this._getMat('shEnergy', () => new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.58 }));
            const armUpperGeo = this._getGeo('armUpper', () => new THREE.CylinderGeometry(0.12, 0.1, 0.48, 8));
            const armForearmGeo = this._getGeo('armForearm', () => new THREE.CylinderGeometry(0.105, 0.085, 0.48, 8));
            const armPistonGeo = this._getGeo('armPiston', () => new THREE.CylinderGeometry(0.032, 0.032, 0.36, 6));

            const makeArm = (side) => {
                const armPivot = new THREE.Group();
                armPivot.position.set(side * (shX + 0.05), 0.74, 0);

                const shJoint = new THREE.Mesh(this._jointGeo, servoMat);
                armPivot.add(shJoint);

                const upper = new THREE.Mesh(armUpperGeo, skinMat);
                upper.position.y = -0.22;
                upper.userData.hitPart = 'body';
                armPivot.add(upper);

                const piston = new THREE.Mesh(armPistonGeo, servoMat);
                piston.position.set(side * 0.09, -0.24, -0.09);
                armPivot.add(piston);

                const elbow = new THREE.Mesh(this._jointGeo, servoMat);
                elbow.position.y = -0.46;
                armPivot.add(elbow);

                const forearm = new THREE.Mesh(armForearmGeo, armorMat);
                forearm.position.set(0, -0.6, 0.14);
                forearm.rotation.x = -0.58;
                forearm.userData.hitPart = 'body';
                armPivot.add(forearm);

                if (side === 1 && (type === 'spitter' || type === 'sniper')) {
                    const barrelLen = type === 'sniper' ? 1.25 : 0.78;
                    const gun = new THREE.Mesh(this._getGeo('armGun_' + type, () => new THREE.BoxGeometry(0.14, 0.16, barrelLen)), armorMat);
                    gun.position.set(0, -0.66, 0.54);
                    const coils = new THREE.Mesh(this._getGeo('armCoils_' + type, () => new THREE.CylinderGeometry(0.055, 0.055, barrelLen * 0.6, 8)), skinMat);
                    coils.rotation.x = Math.PI / 2;
                    coils.position.set(0, -0.6, 0.5);
                    const gunTip = new THREE.Mesh(this._getGeo('gunTip', () => new THREE.SphereGeometry(0.08, 8, 8)), eyeMat);
                    gunTip.position.set(0, -0.66, 0.54 + barrelLen / 2);
                    armPivot.add(gun, coils, gunTip);
                    if (type === 'sniper') {
                        const scope = new THREE.Mesh(this._getGeo('armScope', () => new THREE.CylinderGeometry(0.04, 0.048, 0.42, 8)), servoMat);
                        scope.rotation.x = Math.PI / 2;
                        scope.position.set(0, -0.52, 0.52);
                        armPivot.add(scope);
                    }
                } else if (side === -1 && type === 'shieldbearer') {
                    const shFrame = new THREE.Mesh(this._getGeo('shFrame', () => new THREE.BoxGeometry(1.12, 1.76, 0.12)), armorMat);
                    shFrame.position.set(0.18, -0.55, 0.52);
                    const shEnergy = new THREE.Mesh(this._getGeo('shEnergy', () => new THREE.BoxGeometry(0.96, 1.54, 0.14)), shEnergyMat);
                    shEnergy.position.copy(shFrame.position);
                    const shBar = new THREE.Mesh(this._getGeo('shBar', () => new THREE.BoxGeometry(1.06, 0.16, 0.16)), eyeMat);
                    shBar.position.set(0.18, -0.35, 0.54);
                    const shEmitGeo = this._getGeo('shEmit', () => new THREE.BoxGeometry(0.28, 0.16, 0.18));
                    const shEmitterTop = new THREE.Mesh(shEmitGeo, servoMat);
                    shEmitterTop.position.set(0.18, 0.34, 0.54);
                    const shEmitterBot = new THREE.Mesh(shEmitGeo, servoMat);
                    shEmitterBot.position.set(0.18, -1.42, 0.54);
                    shEnergy.userData.isEnemyShield = true;
                    shFrame.userData.isEnemyShield = true;
                    shBar.userData.isEnemyShield = true;
                    armPivot.add(shFrame, shEnergy, shBar, shEmitterTop, shEmitterBot);
                } else if (type === 'brute' || (type === 'overlord' && side === 1)) {
                    const fist = new THREE.Mesh(this._getGeo('heavyFist', () => new THREE.BoxGeometry(0.36, 0.38, 0.42)), armorMat);
                    fist.position.set(0, -0.82, 0.32);
                    const knuckle = new THREE.Mesh(this._getGeo('heavyKnuckle', () => new THREE.BoxGeometry(0.38, 0.14, 0.44)), eyeMat);
                    knuckle.position.set(0, -0.82, 0.36);
                    armPivot.add(fist, knuckle);
                } else {
                    const clawLen = type === 'leaper' ? 0.58 : 0.34;
                    const claw = new THREE.Mesh(this._getGeo('claw_' + (type === 'leaper' ? 'long' : 'std'), () => new THREE.ConeGeometry(0.085, clawLen, 5)), eyeMat);
                    claw.position.set(0, -0.82, 0.36);
                    claw.rotation.x = Math.PI * 0.42;
                    armPivot.add(claw);
                }
                torsoPivot.add(armPivot);
                return armPivot;
            };
            const armL = makeArm(-1);
            const armR = makeArm(1);

            // Articulated Robotic Legs with Kneecap Armor & Hydraulic Ankles
            const thighGeo = this._getGeo('thigh', () => new THREE.CylinderGeometry(0.15, 0.12, 0.54, 8));
            const thighArmorGeo = this._getGeo('thighArmor', () => new THREE.BoxGeometry(0.24, 0.36, 0.26));
            const kneePadGeo = this._getGeo('kneePad', () => new THREE.BoxGeometry(0.22, 0.2, 0.12));
            const shinGeo = this._getGeo('shin', () => new THREE.CylinderGeometry(0.11, 0.09, 0.52, 8));
            const footGeo = this._getGeo('foot', () => new THREE.BoxGeometry(0.22, 0.13, 0.42));

            const makeLeg = (side) => {
                const legPivot = new THREE.Group();
                legPivot.position.set(side * (isHeavyFrame ? 0.34 : 0.23), -0.05, 0);

                const hipJoint = new THREE.Mesh(this._jointGeo, servoMat);
                legPivot.add(hipJoint);

                const thigh = new THREE.Mesh(thighGeo, skinMat);
                thigh.position.y = -0.26;
                thigh.userData.hitPart = 'body';
                legPivot.add(thigh);

                const thighArmor = new THREE.Mesh(thighArmorGeo, armorMat);
                thighArmor.position.set(0, -0.25, 0.04);
                thighArmor.userData.hitPart = 'body';
                legPivot.add(thighArmor);

                const shinPivot = new THREE.Group();
                shinPivot.position.set(0, -0.52, 0);
                const kneeJoint = new THREE.Mesh(this._jointGeo, servoMat);
                const kneePad = new THREE.Mesh(kneePadGeo, armorMat);
                kneePad.position.set(0, 0.02, 0.12);
                shinPivot.add(kneeJoint, kneePad);

                const shin = new THREE.Mesh(shinGeo, armorMat);
                shin.position.y = -0.24;
                shin.userData.hitPart = 'body';
                shinPivot.add(shin);

                const foot = new THREE.Mesh(footGeo, armorMat);
                foot.position.set(0, -0.49, 0.1);
                foot.userData.hitPart = 'body';
                shinPivot.add(foot);

                legPivot.add(shinPivot);
                hipPivot.add(legPivot);
                return { legPivot, shinPivot };
            };
            const legL = makeLeg(-1);
            const legR = makeLeg(1);

            const iceShell = new THREE.Mesh(
                this._iceGeo,
                this._getMat('iceShellMat', () => new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45 }))
            );
            iceShell.position.y = 1.45;
            iceShell.scale.set(0.95, 1.5, 0.95);
            iceShell.visible = false;
            group.add(iceShell);

            let bossRing = null;
            let bossOuterRing = null;
            if (base.isBoss) {
                bossRing = new THREE.Mesh(
                    this._getGeo('bossRing', () => new THREE.TorusGeometry(1.15, 0.06, 8, 24)),
                    this._getMat('bossRingMat1', () => new THREE.MeshBasicMaterial({ color: 0xfacc15 }))
                );
                bossRing.position.y = 1.5;
                bossRing.rotation.x = Math.PI / 2.2;
                bossOuterRing = new THREE.Mesh(
                    this._getGeo('bossOuterRing', () => new THREE.TorusGeometry(1.42, 0.045, 6, 24)),
                    this._getMat('bossRingMat2', () => new THREE.MeshBasicMaterial({ color: 0x4ade80 }))
                );
                bossOuterRing.position.y = 1.5;
                bossOuterRing.rotation.x = -Math.PI / 2.5;
                group.add(bossRing, bossOuterRing);
            }

            // Visible Red Laser Sight Line for Sniper Robots ("ОСА") with static zero-GC BufferAttribute!
            let laserLine = null;
            let laserArr = null;
            let laserPosAttr = null;
            if (base.isSniper) {
                const lGeo = new THREE.BufferGeometry();
                laserArr = new Float32Array(6);
                laserPosAttr = new THREE.BufferAttribute(laserArr, 3);
                lGeo.setAttribute('position', laserPosAttr);
                laserLine = new THREE.Line(
                    lGeo,
                    this._getMat('sniperLaser', () => new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.85 }))
                );
                laserLine.visible = false;
                this.scene.add(laserLine);
            }

            group.scale.setScalar(base.scale);

            door.openTimer = 3.2;
            const laneOffset = (Math.random() - 0.5) * 4.8;
            const sx = door.x + laneOffset;
            const sz = door.spawnZ - Math.random() * 2.5;
            group.position.set(sx, 0, sz);

            const alienObj = {
                type,
                cfg: base,
                group,
                hipPivot,
                torsoPivot,
                headGroup,
                tailPivot,
                armL,
                armR,
                legL,
                legR,
                coreGlow,
                thrusterGlows,
                iceShell,
                bossRing,
                bossOuterRing,
                backTurbine,
                ammoDrum,
                laserLine,
                laserArr,
                laserPosAttr,
                skinMat,
                hp,
                maxHp: hp,
                speed,
                score: base.score,
                attackRange: base.attackRange,
                damage: scaledDamage,
                radius: base.radius,
                ranged: base.ranged,
                strideFreq: base.strideFreq,
                strideAmp: base.strideAmp,
                baseLean: base.torsoLean,
                baseScale: base.scale,
                baseEmissive: 0.16,
                exitingDoor: door,
                flankSign: Math.random() < 0.5 ? -1 : 1,
                strafeSign: Math.random() < 0.5 ? -1 : 1,
                strafeTimer: 1.5 + Math.random() * 2.0,
                leapCooldown: 2.4 + Math.random() * 2.0,
                leapVy: 0,
                inAir: false,
                attackCooldown: 0.85 + Math.random() * 0.85,
                attackWindup: 0,
                sniperAimTimer: 0,
                meleeChargeWindup: 0,
                flinchTimer: 0,
                hitFlash: 0,
                // External knockback velocity (from Impulse ability or Apex armor wave!)
                knockVel: new THREE.Vector3(),
                burnTimer: 0,
                burnTick: 0,
                polymerCoatTimer: 0,
                shockTimer: 0,
                freezeTimer: 0,
                telekinesisTimer: 0,
                telekinesisSlammed: false,
                dying: false,
                deathTimer: 0,
                deathSpinDir: Math.random() < 0.5 ? 1 : -1,
                deathBurstDone: false,
                walkPhase: Math.random() * Math.PI * 2,
                lastStepSign: 1,
                _losTimer: 0,
                _cachedLOS: false,
                _structTimer: 0,
                _cachedBlockingStruct: null,
                _turretScanTimer: 0,
                _cachedTurret: null
            };

            group.traverse(child => {
                if (child.isMesh) {
                    child.userData.alien = alienObj;
                    if (!child.userData.isEnemyShield && !child.userData.hitPart) {
                        child.userData.hitPart = 'body';
                    }
                }
            });

            this.scene.add(group);
            this.aliens.push(alienObj);
            return alienObj;
        }

        _setAlienEmissive(a, hex, intensity) {
            a.skinMat.emissive.setHex(hex);
            a.skinMat.emissiveIntensity = intensity;
        }

        update(rawDt, playerPos, playerVel, combatCtx) {
            const { timeStopActive, timeSlowActive, onDamageAlien, onDamagePlayer, spawnParticles, spawnShockwave } = combatCtx;

            const aiTimeScale = timeStopActive ? 0.0 : (timeSlowActive ? 0.22 : 1.0);
            const dt = rawDt * aiTimeScale;

            this.flowUpdateTimer -= rawDt;
            if (this.flowUpdateTimer <= 0) {
                this.flowUpdateTimer = 0.22;
                this.map.computeFlowField(playerPos.x, playerPos.z);
            }

            const flowVec = this._vFlow;
            const realPlayerPos = playerPos;
            const realPlayerVel = playerVel;

            for (let i = this.aliens.length - 1; i >= 0; i--) {
                const a = this.aliens[i];
                const pos = a.group.position;

                // 1. Kinetic Mechanical Death Disassembly Animation
                if (a.dying) {
                    if (a.laserLine) a.laserLine.visible = false;
                    a.deathTimer -= rawDt;
                    const p = Math.min(1, Math.max(0, 1 - a.deathTimer / 0.65));
                    a.torsoPivot.rotation.x = a.baseLean + p * 1.55;
                    a.torsoPivot.rotation.z += a.deathSpinDir * rawDt * 2.2;
                    a.hipPivot.position.y = Math.max(0.18, 1.08 - p * 0.94);
                    a.headGroup.position.y += rawDt * (3.6 - p * 5.2);
                    a.headGroup.position.x += a.deathSpinDir * rawDt * 1.3;
                    a.headGroup.rotation.z += a.deathSpinDir * rawDt * 8.5;
                    a.armL.rotation.x -= rawDt * 3.8;
                    a.armR.rotation.x += rawDt * 3.4;
                    if (p > 0.35 && !a.deathBurstDone) {
                        a.deathBurstDone = true;
                        spawnParticles(this._vTmp.set(pos.x, pos.y + 1.1, pos.z), 0xf97316, 10, 8);
                    }
                    if (p > 0.72) {
                        const shrink = 1 - (p - 0.72) / 0.28;
                        a.group.scale.setScalar(a.baseScale * Math.max(0.05, shrink));
                    }
                    if (a.deathTimer <= 0) {
                        if (a.laserLine) this.scene.remove(a.laserLine);
                        this.scene.remove(a.group);
                        this.aliens.splice(i, 1);
                    }
                    continue;
                }

                // 2. Time Stop (0.0x)
                if (timeStopActive) {
                    let intens = 0.42;
                    if (a.hitFlash > 0) {
                        a.hitFlash -= rawDt;
                        intens = 1.6;
                    }
                    this._setAlienEmissive(a, 0xfacc15, intens);
                    continue;
                }

                // 3. Apply Knockback Velocity (with Wall Crush Bonus Damage!)
                if (a.knockVel.lengthSq() > 0.2) {
                    pos.x += a.knockVel.x * dt;
                    pos.z += a.knockVel.z * dt;
                    a.knockVel.multiplyScalar(Math.exp(-5.5 * dt));

                    const preClampX = pos.x;
                    const preClampZ = pos.z;
                    this._resolveAlienCollisions(pos, a.radius);
                    const wallImpact = Math.hypot(pos.x - preClampX, pos.z - preClampZ);
                    if (wallImpact > 0.12 && a.knockVel.length() > 8.0) {
                        a.knockVel.set(0, 0, 0);
                        const crushDmg = 55;
                        const cPos = pos.clone().add(new THREE.Vector3(0, 1.4, 0));
                        spawnParticles(cPos, 0x38bdf8, 10, 8);
                        if (onDamageAlien(a, crushDmg, cPos, 0x38bdf8, false)) continue;
                    }
                }

                // 4. Telekinesis Lift & Slam
                if (a.telekinesisTimer > 0) {
                    a.telekinesisTimer -= dt;
                    if (a.laserLine) a.laserLine.visible = false;
                    if (a.telekinesisTimer > 0.35) {
                        const targetY = 4.6 + Math.sin(performance.now() * 0.008 + i) * 0.5;
                        pos.y += (targetY - pos.y) * Math.min(1, dt * 6.5);
                        a.torsoPivot.rotation.x = -0.35;
                        a.armL.rotation.x = -2.2;
                        a.armR.rotation.x = -2.2;
                    } else {
                        pos.y = Math.max(0, pos.y - 38 * dt);
                        if (pos.y <= 0.05 && !a.telekinesisSlammed) {
                            a.telekinesisSlammed = true;
                            pos.y = 0;
                            spawnParticles(this._vTmp.set(pos.x, pos.y + 0.6, pos.z), 0x4ade80, 14, 9);
                            onDamageAlien(a, a.cfg.isBoss ? 105 : 145, pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x4ade80, false);
                        }
                    }
                    continue;
                }

                // 5. Cryo Freeze
                if (a.freezeTimer > 0) {
                    a.freezeTimer -= dt;
                    if (a.laserLine) a.laserLine.visible = false;
                    a.iceShell.visible = true;
                    let fInt = 0.65;
                    if (a.hitFlash > 0) {
                        a.hitFlash -= rawDt;
                        fInt = 1.6;
                    }
                    this._setAlienEmissive(a, 0x67e8f9, fInt);
                    if (a.freezeTimer <= 0) {
                        a.iceShell.visible = false;
                        this._setAlienEmissive(a, a.cfg.bodyColor, a.baseEmissive);
                    }
                    continue;
                } else if (a.iceShell.visible) {
                    a.iceShell.visible = false;
                }

                // 6. Status Effects
                let slowMult = 1.0;
                if (a.shockTimer > 0) {
                    a.shockTimer -= dt;
                    slowMult = 0.45;
                }
                if (a.polymerCoatTimer > 0) a.polymerCoatTimer -= dt;
                if (a.burnTimer > 0) {
                    a.burnTimer -= dt;
                    a.burnTick += dt;
                    this._setAlienEmissive(a, 0xff5722, 0.85);
                    if (a.burnTick >= 0.35) {
                        a.burnTick = 0;
                        const center = pos.clone().add(new THREE.Vector3(0, 1.4, 0));
                        spawnParticles(center, 0xff6b00, 3, 3.5);
                        const killed = onDamageAlien(a, a.polymerCoatTimer > 0 ? 16 : 9.5, center, 0xff5722, false);
                        if (killed) continue;
                    }
                    if (a.burnTimer <= 0) {
                        this._setAlienEmissive(a, a.cfg.bodyColor, a.baseEmissive);
                    }
                } else if (a.hitFlash > 0) {
                    a.hitFlash -= rawDt;
                    if (a.hitFlash > 0) {
                        this._setAlienEmissive(a, a.cfg.bodyColor, 1.5);
                    } else {
                        this._setAlienEmissive(a, a.cfg.bodyColor, a.baseEmissive);
                    }
                } else if (timeSlowActive) {
                    this._setAlienEmissive(a, 0x6ee7b7, 0.28);
                } else {
                    this._setAlienEmissive(a, a.cfg.bodyColor, a.baseEmissive);
                }

                if (a.bossRing) a.bossRing.rotation.z += dt * 2.2;

                // 7. Movement & Role-Based Tactical AI (Turret Aggro + Zero Wall-Clipping + Craft-Wall Assault)
                const dmgTurretFn = combatCtx.onDamageTurret || (combatCtx.building ? (tr, d, att) => combatCtx.building.damageTurret(tr, d, att, combatCtx) : null);
                const enemyHeight = 2.45 * a.baseScale;
                let playerPos = realPlayerPos;
                let playerVel = realPlayerVel;
                let targetTurret = null;
                const getTurretCoords = (t) => (t.pos || (t.group && t.group.position) || { x: t.x || 0, y: t.y || 0, z: t.z || 0 });
                if (!a.exitingDoor && combatCtx.turrets && combatCtx.turrets.length > 0) {
                    if (a.aggroTurret && a.aggroTurret.hp > 0 && combatCtx.turrets.includes(a.aggroTurret)) {
                        const tp = getTurretCoords(a.aggroTurret);
                        const dAggro = Math.hypot(tp.x - pos.x, tp.z - pos.z);
                        if (dAggro < 52) targetTurret = a.aggroTurret;
                        else a.aggroTurret = null;
                    } else {
                        a.aggroTurret = null;
                    }
                    if (!targetTurret) {
                        a._turretScanTimer -= rawDt;
                        if (a._turretScanTimer <= 0 || (a._cachedTurret && a._cachedTurret.hp <= 0)) {
                            a._turretScanTimer = 0.20 + Math.random() * 0.06;
                            a._cachedTurret = null;
                            const dReal = Math.hypot(realPlayerPos.x - pos.x, realPlayerPos.z - pos.z);
                            let bestDist = Infinity;
                            const prioDist = Math.min(34, Math.max(20, dReal * 1.15));
                            for (const t of combatCtx.turrets) {
                                if (!t || t.hp <= 0) continue;
                                const tp = getTurretCoords(t);
                                const dtTur = Math.hypot(tp.x - pos.x, tp.z - pos.z);
                                if (dtTur < bestDist && dtTur < prioDist) {
                                    bestDist = dtTur;
                                    a._cachedTurret = t;
                                }
                            }
                        }
                        if (a._cachedTurret && a._cachedTurret.hp > 0 && combatCtx.turrets.includes(a._cachedTurret)) {
                            targetTurret = a._cachedTurret;
                        }
                    }
                    if (targetTurret) {
                        const tp = getTurretCoords(targetTurret);
                        this._vTurret.set(tp.x, tp.y, tp.z);
                        playerPos = this._vTurret;
                        playerVel = this._zeroVel;
                    }
                }
                const toPlayer = this._vToP.set(playerPos.x - pos.x, 0, playerPos.z - pos.z);
                const distToPlayer = toPlayer.length();
                if (distToPlayer > 0.01) toPlayer.divideScalar(distToPlayer);

                const moveDir = this._vMove.set(0, 0, 0);
                let moving = false;
                const effSpeed = a.speed * slowMult;

                if (a.exitingDoor) {
                    a.exitingDoor.openTimer = Math.max(a.exitingDoor.openTimer, 1.0);
                    const exitTargetX = a.exitingDoor.x + a.flankSign * 1.4;
                    const exitTargetZ = a.exitingDoor.exitZ;
                    moveDir.set(exitTargetX - pos.x, 0, exitTargetZ - pos.z);
                    if (moveDir.lengthSq() > 0.25) {
                        moveDir.normalize();
                        pos.x += moveDir.x * Math.max(effSpeed, 7.8) * dt;
                        pos.z += moveDir.z * Math.max(effSpeed, 7.8) * dt;
                        pos.x = Math.max(a.exitingDoor.x - 3.6, Math.min(a.exitingDoor.x + 3.6, pos.x));
                        moving = true;
                        a.group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
                    }
                    if (pos.z >= a.exitingDoor.exitZ - 0.5) {
                        a.exitingDoor = null;
                    }
                } else {
                    a._losTimer -= rawDt;
                    if (a._losTimer <= 0 || a.sniperAimTimer > 0) {
                        a._losTimer = 0.09 + Math.random() * 0.04;
                        const muzzleY = pos.y + 1.65 * a.baseScale;
                        const targetY = playerPos.y + 1.35;
                        a._cachedLOS = distToPlayer < 75 && this.map.hasLineOfSight(
                            pos.x, muzzleY, pos.z,
                            playerPos.x, targetY, playerPos.z,
                            true
                        );
                    }
                    const hasLOS = a._cachedLOS;

                    const desiredDist = a.ranged
                        ? (a.cfg.isSniper ? 38 : (a.cfg.isGrenadier ? 26 : 21))
                        : (a.attackRange - 0.6);

                    // Check if a player-crafted fortification blocks immediate path forward (staggered)
                    if (a._cachedBlockingStruct && a._cachedBlockingStruct.hp <= 0) {
                        a._cachedBlockingStruct = null;
                        a._structTimer = 0;
                    }
                    a._structTimer -= rawDt;
                    if (a._structTimer <= 0) {
                        a._structTimer = 0.12 + Math.random() * 0.04;
                        a._cachedBlockingStruct = null;
                        if (combatCtx.building && combatCtx.building.structures.length > 0) {
                            const probeDist = a.radius + 1.85;
                            const probe = this.map.segmentHitsObstacle(
                                pos.x, pos.y + 1.1, pos.z,
                                pos.x + toPlayer.x * probeDist, pos.y + 1.1, pos.z + toPlayer.z * probeDist,
                                { expand: 0.2 }
                            );
                            if (probe.hit && probe.box && probe.box.structureRef) {
                                a._cachedBlockingStruct = probe.box.structureRef;
                            }
                        }
                    }
                    const blockingStruct = a._cachedBlockingStruct;

                    // Evasive dodge when player aims straight at an agile/ranged bot!
                    if (hasLOS && a.ranged && playerVel && combatCtx.cameraDir) {
                        const fromPlayer = this._vTmp.set(pos.x - playerPos.x, 0, pos.z - playerPos.z).normalize();
                        if (combatCtx.cameraDir.dot(fromPlayer) > 0.96 && a.strafeTimer > 0.3) {
                            a.strafeTimer = 0.25;
                        }
                    }

                    if (a.meleeChargeWindup > 0) {
                        a.meleeChargeWindup -= dt;
                        if (a.meleeChargeWindup <= 0) {
                            spawnShockwave(this._vTmp.set(pos.x, pos.y + 0.3, pos.z), 6.2, 0xf97316, 0.35);
                            this.sound.playGiantStomp(1.0);
                            if (targetTurret && dmgTurretFn && distToPlayer <= 6.8 && Math.abs(playerPos.y - pos.y) < 3.0) {
                                dmgTurretFn(targetTurret, a.damage * 1.45, a);
                            }
                            const realDist = Math.hypot(realPlayerPos.x - pos.x, realPlayerPos.z - pos.z);
                            if (realDist <= 6.2 && Math.abs(realPlayerPos.y - pos.y) < 3.0 &&
                                this.map.hasLineOfSight(pos.x, pos.y + 1.0, pos.z, realPlayerPos.x, realPlayerPos.y + 1.0, realPlayerPos.z, true)) {
                                onDamagePlayer(a.damage, pos);
                            }
                            a.attackCooldown = 1.65;
                            a.attackWindup = 0.28;
                        }
                    } else if (blockingStruct) {
                        // Melee / Assault bots smash blocking Fortnite/Rust fortifications!
                        a.attackCooldown -= dt;
                        if (a.attackCooldown <= 0 && combatCtx.onDamageStructure) {
                            a.attackCooldown = 1.05;
                            a.attackWindup = 0.28;
                            combatCtx.onDamageStructure(blockingStruct, a.damage * 1.45, a);
                        }
                    } else if (distToPlayer > desiredDist || !hasLOS) {
                        if (!hasLOS && this.map.sampleFlowDirection(pos.x, pos.z, flowVec)) {
                            moveDir.copy(flowVec);
                            // Add mild corner-peek lateral bias if stuck close to wall
                            moveDir.x += -flowVec.z * a.strafeSign * 0.22;
                            moveDir.z += flowVec.x * a.strafeSign * 0.22;
                            moveDir.normalize();
                        } else {
                            moveDir.copy(toPlayer);
                            if (!a.ranged && distToPlayer > 6.0 && distToPlayer < 35.0) {
                                const perpX = -toPlayer.z * a.flankSign;
                                const perpZ = toPlayer.x * a.flankSign;
                                moveDir.x += perpX * (a.cfg.role === 'tank' ? 0.16 : 0.44);
                                moveDir.z += perpZ * (a.cfg.role === 'tank' ? 0.16 : 0.44);
                                moveDir.normalize();
                            }
                        }
                        pos.x += moveDir.x * effSpeed * dt;
                        pos.z += moveDir.z * effSpeed * dt;
                        moving = true;
                    } else if (a.ranged && !a.sniperAimTimer) {
                        a.strafeTimer -= dt;
                        if (a.strafeTimer <= 0) {
                            a.strafeTimer = 1.2 + Math.random() * 1.6;
                            a.strafeSign *= -1;
                        }
                        const perpX = -toPlayer.z * a.strafeSign;
                        const perpZ = toPlayer.x * a.strafeSign;
                        moveDir.set(perpX, 0, perpZ);
                        if (distToPlayer < 13.5) {
                            moveDir.x -= toPlayer.x * 0.72;
                            moveDir.z -= toPlayer.z * 0.72;
                        }
                        moveDir.normalize();
                        pos.x += moveDir.x * effSpeed * 0.82 * dt;
                        pos.z += moveDir.z * effSpeed * 0.82 * dt;
                        moving = true;
                    }

                    // Leaper Jump
                    if (a.cfg.canLeap && !a.inAir && hasLOS && distToPlayer > 8.5 && distToPlayer < 24.0) {
                        a.leapCooldown -= dt;
                        if (a.leapCooldown <= 0) {
                            a.leapCooldown = 4.0 + Math.random() * 2.0;
                            a.inAir = true;
                            a.leapVy = 12.2;
                        }
                    }

                    if (a.inAir) {
                        a.leapVy -= 25.0 * dt;
                        pos.y += a.leapVy * dt;
                        pos.x += toPlayer.x * effSpeed * 1.4 * dt;
                        pos.z += toPlayer.z * effSpeed * 1.4 * dt;
                        if (pos.y <= 0) {
                            pos.y = 0;
                            a.inAir = false;
                            a.leapVy = 0;
                        }
                    }

                    const lookVec = (a.ranged && hasLOS && distToPlayer < a.attackRange)
                        ? toPlayer
                        : (moving ? moveDir : toPlayer);
                    const targetRot = Math.atan2(lookVec.x, lookVec.z);
                    let diff = targetRot - a.group.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    a.group.rotation.y += diff * Math.min(1, dt * 10);

                    // Separation
                    for (let j = 0; j < this.aliens.length; j++) {
                        if (i === j) continue;
                        const other = this.aliens[j];
                        if (other.dying) continue;
                        const dx = pos.x - other.group.position.x;
                        const dz = pos.z - other.group.position.z;
                        const d2 = dx * dx + dz * dz;
                        const minSep = a.radius + other.radius + 0.42;
                        if (d2 > 0.001 && d2 < minSep * minSep) {
                            const d = Math.sqrt(d2);
                            const push = (minSep - d) * 3.6 * dt;
                            pos.x += (dx / d) * push;
                            pos.z += (dz / d) * push;
                        }
                    }

                    // Strict 2-pass Wall + Crafted Fortification + Ramp Collision!
                    this._resolveAlienCollisions(pos, a.radius, enemyHeight);

                    // Attack Execution (Strict LOS Enforced — NEVER shoots through walls!)
                    a.attackCooldown -= dt;
                    if (a.cfg.isSniper && a.sniperAimTimer > 0) {
                        if (!hasLOS) {
                            // Player stepped behind cover: break sniper lock immediately!
                            a.sniperAimTimer = 0;
                            if (a.laserLine) a.laserLine.visible = false;
                        } else {
                            a.sniperAimTimer -= dt;
                            if (a.laserLine) {
                                a.laserArr[0] = pos.x;
                                a.laserArr[1] = pos.y + 1.85 * a.baseScale;
                                a.laserArr[2] = pos.z;
                                a.laserArr[3] = playerPos.x;
                                a.laserArr[4] = playerPos.y + 1.35;
                                a.laserArr[5] = playerPos.z;
                                a.laserPosAttr.needsUpdate = true;
                                a.laserLine.visible = true;
                            }
                            if (a.sniperAimTimer <= 0) {
                                if (a.laserLine) a.laserLine.visible = false;
                                this._fireEnemyProjectile(a, playerPos, playerVel, 'sniper');
                                a.attackCooldown = 2.6;
                                a.attackWindup = 0.25;
                            }
                        }
                    } else if (!blockingStruct && a.attackCooldown <= 0 && a.meleeChargeWindup <= 0) {
                        if (!a.ranged) {
                            const reach = a.attackRange + (targetTurret ? 1.15 : 0);
                            if (distToPlayer <= reach && Math.abs(playerPos.y - pos.y) < 3.0 && hasLOS) {
                                if (a.cfg.hasGroundSlam) {
                                    a.meleeChargeWindup = 0.36;
                                } else {
                                    if (targetTurret && dmgTurretFn) {
                                        dmgTurretFn(targetTurret, a.damage * 1.35, a);
                                    } else if (!targetTurret) {
                                        onDamagePlayer(a.damage, pos);
                                    }
                                    a.attackCooldown = a.type === 'shieldbearer' ? 1.25 : 0.95;
                                    a.attackWindup = 0.28;
                                }
                            }
                        } else if (a.cfg.isSniper && hasLOS && distToPlayer <= a.attackRange) {
                            a.sniperAimTimer = 0.85;
                        } else if (a.cfg.isGrenadier && distToPlayer <= a.attackRange && distToPlayer > 7.5 && hasLOS) {
                            this._fireEnemyProjectile(a, playerPos, playerVel, 'grenade');
                            a.attackCooldown = 2.75;
                            a.attackWindup = 0.3;
                        } else if (distToPlayer <= a.attackRange) {
                            if (a.cfg.isBoss && distToPlayer <= 5.5 && hasLOS) {
                                a.meleeChargeWindup = 0.36;
                            } else if (hasLOS) {
                                this._fireEnemyProjectile(a, playerPos, playerVel, 'plasma');
                                a.attackCooldown = a.cfg.isBoss ? 1.6 : 1.95;
                                a.attackWindup = 0.25;
                            }
                        }
                    }
                }

                this._animateAlien(a, dt, moving, slowMult, distToPlayer);
            }
        }

        _animateAlien(a, dt, moving, slowMult, distToPlayer) {
            if (a.flinchTimer > 0) a.flinchTimer = Math.max(0, a.flinchTimer - dt);
            if (a.attackWindup > 0) a.attackWindup = Math.max(0, a.attackWindup - dt);

            const flinchBack = a.flinchTimer > 0 ? -Math.sin((a.flinchTimer / 0.16) * Math.PI) * 0.28 : 0;
            const strikeFwd = a.attackWindup > 0 ? Math.sin((a.attackWindup / 0.28) * Math.PI) * 0.45 : 0;

            if (a.inAir) {
                a.legL.legPivot.rotation.x = 0.65;
                a.legR.legPivot.rotation.x = -0.35;
                a.armL.rotation.x = -1.2;
                a.armR.rotation.x = -1.2;
                a.thrusterGlows.forEach(t => t.scale.setScalar(1.8));
                return;
            }
            a.thrusterGlows.forEach(t => t.scale.setScalar(0.9));

            // Heavy Brute Ground-Slam Windup Pose!
            if (a.meleeChargeWindup > 0) {
                const lift = Math.min(1, (0.36 - a.meleeChargeWindup) / 0.36);
                a.armL.rotation.x = -2.4 * lift;
                a.armR.rotation.x = -2.4 * lift;
                a.torsoPivot.rotation.x = a.baseLean - 0.3 * lift;
                return;
            }

            if (moving) {
                a.walkPhase += dt * a.strideFreq * slowMult;
                const s = Math.sin(a.walkPhase);
                const c = Math.cos(a.walkPhase);

                a.legL.legPivot.rotation.x = s * a.strideAmp;
                a.legR.legPivot.rotation.x = -s * a.strideAmp;
                a.legL.shinPivot.rotation.x = Math.max(0, -c) * (a.type === 'scout' || a.type === 'leaper' ? 1.15 : 0.68);
                a.legR.shinPivot.rotation.x = Math.max(0, c) * (a.type === 'scout' || a.type === 'leaper' ? 1.15 : 0.68);

                if (a.type === 'shieldbearer') {
                    // Brace heavy shield forward while advancing!
                    a.armL.rotation.x = -0.92 + s * 0.06;
                    a.armR.rotation.x = s * 0.55 - strikeFwd * 1.1;
                } else if (a.type === 'spitter' || a.type === 'sniper') {
                    a.armL.rotation.x = -s * a.strideAmp * 0.6;
                    a.armR.rotation.x = -0.9 - strikeFwd * 0.6;
                } else {
                    a.armL.rotation.x = -s * a.strideAmp * 0.85 - strikeFwd;
                    a.armR.rotation.x = s * a.strideAmp * 0.85 - strikeFwd;
                }

                if (a.tailPivot) a.tailPivot.rotation.y = s * 0.35;

                if (a.type === 'scout' || a.type === 'leaper') {
                    a.hipPivot.position.y = 1.08 + Math.abs(s) * 0.22;
                    a.hipPivot.rotation.z = s * 0.08;
                    a.torsoPivot.rotation.x = a.baseLean + Math.abs(c) * 0.09 + flinchBack;
                } else if (a.type === 'brute' || a.type === 'overlord') {
                    a.hipPivot.position.y = 1.08 - Math.abs(s) * 0.16;
                    a.hipPivot.rotation.z = s * 0.13;
                    a.torsoPivot.rotation.y = -s * 0.11;
                    a.torsoPivot.rotation.x = a.baseLean + flinchBack + strikeFwd * 0.5;

                    const stepSign = s >= 0 ? 1 : -1;
                    if (stepSign !== a.lastStepSign) {
                        a.lastStepSign = stepSign;
                        if (distToPlayer < 34) {
                            const prox = 1 - distToPlayer / 34;
                            this.sound.playGiantStomp(prox);
                            XB.events.emit('camera:shake', { intensity: prox * 0.12 });
                        }
                    }
                } else {
                    a.hipPivot.position.y = 1.08 + Math.abs(s) * 0.08;
                    a.hipPivot.rotation.z = s * 0.035;
                    a.torsoPivot.rotation.x = a.baseLean + flinchBack + strikeFwd * 0.35;
                }
            } else {
                a.legL.legPivot.rotation.x *= 0.85;
                a.legR.legPivot.rotation.x *= 0.85;
                a.hipPivot.rotation.z *= 0.85;
                a.torsoPivot.rotation.x = a.baseLean + flinchBack + strikeFwd * 0.35;
                if (a.type === 'spitter' || a.type === 'sniper') {
                    a.armR.rotation.x = -0.92 - strikeFwd * 0.5;
                }
            }

            a.headGroup.rotation.y = Math.sin(a.walkPhase * 0.55) * 0.14;
            a.coreGlow.rotation.y += dt * 3.2;
            a.coreGlow.scale.setScalar(0.92 + Math.sin(a.walkPhase * 0.8) * 0.12);
            if (a.backTurbine) a.backTurbine.rotation.z += dt * (a.meleeChargeWindup > 0 ? 18.0 : 7.5);
            if (a.bossOuterRing) a.bossOuterRing.rotation.z -= dt * 2.4;
            if (a.ammoDrum && a.attackWindup > 0) a.ammoDrum.rotation.x += dt * 11.0;
        }

        _ensureCollisionGrid() {
            const boxes = this.map.boxes;
            if (this._colGridMap === this.map && this._colGridCount === boxes.length) return;
            this._colGridMap = this.map;
            this._colGridCount = boxes.length;
            this._colHalf = 112;
            this._colCell = 16;
            this._colDim = 14;
            this._colStamp = this._colStamp || 0;
            const total = this._colDim * this._colDim;
            const grid = new Array(total);
            for (let k = 0; k < total; k++) grid[k] = [];
            const half = this._colHalf;
            const cell = this._colCell;
            const maxIdx = this._colDim - 1;

            for (let i = 0; i < boxes.length; i++) {
                const b = boxes[i];
                if (b.playerOnly || b.isShieldScreen) continue;
                const x0 = Math.max(0, Math.min(maxIdx, Math.floor((b.minX + half) / cell)));
                const x1 = Math.max(0, Math.min(maxIdx, Math.floor((b.maxX + half) / cell)));
                const z0 = Math.max(0, Math.min(maxIdx, Math.floor((b.minZ + half) / cell)));
                const z1 = Math.max(0, Math.min(maxIdx, Math.floor((b.maxZ + half) / cell)));
                for (let gz = z0; gz <= z1; gz++) {
                    const row = gz * this._colDim;
                    for (let gx = x0; gx <= x1; gx++) {
                        grid[row + gx].push(b);
                    }
                }
            }
            this._colGrid = grid;
        }

        _resolveBoxPush(pos, radius, enemyHeight, b) {
            if (b.playerOnly || b.isShieldScreen) return;
            if (pos.y >= b.maxY - 0.12 || pos.y + enemyHeight <= b.minY + 0.12) return;
            if (pos.x + radius <= b.minX || pos.x - radius >= b.maxX ||
                pos.z + radius <= b.minZ || pos.z - radius >= b.maxZ) return;

            const closestX = pos.x < b.minX ? b.minX : (pos.x > b.maxX ? b.maxX : pos.x);
            const closestZ = pos.z < b.minZ ? b.minZ : (pos.z > b.maxZ ? b.maxZ : pos.z);
            const dx = pos.x - closestX;
            const dz = pos.z - closestZ;
            const distSq = dx * dx + dz * dz;
            if (distSq < radius * radius) {
                if (distSq > 0.00001) {
                    const dist = Math.sqrt(distSq);
                    const push = radius - dist;
                    pos.x += (dx / dist) * push;
                    pos.z += (dz / dist) * push;
                } else {
                    const pushL = Math.abs(pos.x - b.minX);
                    const pushR = Math.abs(b.maxX - pos.x);
                    const pushB = Math.abs(pos.z - b.minZ);
                    const pushF = Math.abs(b.maxZ - pos.z);
                    const m = Math.min(pushL, pushR, pushB, pushF);
                    if (m === pushL) pos.x = b.minX - radius;
                    else if (m === pushR) pos.x = b.maxX + radius;
                    else if (m === pushB) pos.z = b.minZ - radius;
                    else pos.z = b.maxZ + radius;
                }
            }
        }

        _resolveAlienCollisions(pos, radius, enemyHeight = 2.4) {
            this._ensureCollisionGrid();
            const half = this._colHalf;
            const cell = this._colCell;
            const dim = this._colDim;
            const maxIdx = dim - 1;
            const grid = this._colGrid;
            const dynBoxes = this.map.dynamicBoxes;
            const pad = radius + 0.25;
            const limitX = this.map.ARENA_LIMIT_X - radius * 0.5;
            const limitZ = this.map.ARENA_LIMIT_Z - radius * 0.5;

            // Two iterative passes guarantee robots never squeeze through corner intersections!
            for (let pass = 0; pass < 2; pass++) {
                if (pos.x < -limitX) pos.x = -limitX;
                else if (pos.x > limitX) pos.x = limitX;
                if (pos.z < -limitZ) pos.z = -limitZ;
                else if (pos.z > limitZ) pos.z = limitZ;

                const stamp = ++this._colStamp;
                const x0 = Math.max(0, Math.min(maxIdx, Math.floor((pos.x - pad + half) / cell)));
                const x1 = Math.max(0, Math.min(maxIdx, Math.floor((pos.x + pad + half) / cell)));
                const z0 = Math.max(0, Math.min(maxIdx, Math.floor((pos.z - pad + half) / cell)));
                const z1 = Math.max(0, Math.min(maxIdx, Math.floor((pos.z + pad + half) / cell)));

                for (let gz = z0; gz <= z1; gz++) {
                    const row = gz * dim;
                    for (let gx = x0; gx <= x1; gx++) {
                        const bucket = grid[row + gx];
                        for (let i = 0; i < bucket.length; i++) {
                            const b = bucket[i];
                            if (b._visitStamp === stamp) continue;
                            b._visitStamp = stamp;
                            this._resolveBoxPush(pos, radius, enemyHeight, b);
                        }
                    }
                }

                for (let i = 0; i < dynBoxes.length; i++) {
                    this._resolveBoxPush(pos, radius, enemyHeight, dynBoxes[i]);
                }
            }
        }

        _fireEnemyProjectile(alien, playerPos, playerVel, kind) {
            const p = alien.group.position;
            const origin = this._vOrigin.set(p.x, p.y + 1.85 * alien.baseScale, p.z);

            if (kind === 'grenade') {
                // Parabolic arcing mortar grenade with floor landing ring!
                const targetX = playerPos.x + playerVel.x * 0.45;
                const targetZ = playerPos.z + playerVel.z * 0.45;
                const flightTime = 1.35;
                const grav = 18.0;
                const vx = (targetX - origin.x) / flightTime;
                const vz = (targetZ - origin.z) / flightTime;
                const vy = ((playerPos.y - origin.y) + 0.5 * grav * flightTime * flightTime) / flightTime;

                const mesh = new THREE.Mesh(
                    this._getGeo('grenadeGeo', () => new THREE.OctahedronGeometry(0.32, 1)),
                    this._getMat('grenadeMat', () => new THREE.MeshBasicMaterial({ color: 0xf97316 }))
                );
                mesh.position.copy(origin);
                this.scene.add(mesh);

                const ringMesh = new THREE.Mesh(
                    this._getGeo('grenadeRingGeo', () => new THREE.RingGeometry(2.8, 3.2, 24)),
                    this._getMat('grenadeRingMat', () => new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }))
                );
                ringMesh.rotation.x = Math.PI / 2;
                ringMesh.position.set(targetX, 0.12, targetZ);
                this.scene.add(ringMesh);

                this.enemyBullets.push({
                    mesh,
                    ringMesh,
                    vel: new THREE.Vector3(vx, vy, vz),
                    gravity: grav,
                    isGrenade: true,
                    blastRadius: 4.2,
                    damage: alien.damage,
                    life: 2.5,
                    color: 0xf97316,
                    reflected: false
                });
                return;
            }

            const speed = kind === 'sniper' ? 52 : (alien.cfg.isBoss ? 27 : 21);
            const dist = origin.distanceTo(playerPos);
            const leadTime = kind === 'sniper' ? 0.15 : Math.min(0.65, (dist / speed) * 0.55);
            const aimTarget = this._vTarget.set(
                playerPos.x + playerVel.x * leadTime,
                playerPos.y + 1.45,
                playerPos.z + playerVel.z * leadTime
            );
            const baseDir = aimTarget.sub(origin).normalize();

            const volleyCount = alien.cfg.isBoss ? 3 : 1;
            const color = kind === 'sniper' ? 0xf43f5e : (alien.cfg.isBoss ? 0xfacc15 : 0x4ade80);
            const radius = kind === 'sniper' ? 0.24 : (alien.cfg.isBoss ? 0.42 : 0.22);
            const projGeo = this._getGeo('proj_' + radius, () => new THREE.SphereGeometry(radius, 10, 10));
            const projMat = this._getMat('projMat_' + color, () => new THREE.MeshBasicMaterial({ color }));

            for (let v = 0; v < volleyCount; v++) {
                const dir = baseDir.clone();
                if (volleyCount > 1) {
                    const spread = (v - (volleyCount - 1) / 2) * 0.12;
                    dir.applyAxisAngle(this._yAxis, spread);
                }

                const mesh = new THREE.Mesh(projGeo, projMat);
                mesh.position.copy(origin);
                this.scene.add(mesh);

                this.enemyBullets.push({
                    mesh,
                    vel: dir.multiplyScalar(speed),
                    gravity: 0,
                    isGrenade: false,
                    damage: alien.damage,
                    life: 4.5,
                    color,
                    reflected: false
                });
            }
        }
    }

    XB.EnemySystem = EnemySystem;
})(window);
