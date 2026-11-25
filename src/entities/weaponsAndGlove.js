/**
 * First-Person ViewModel Rig:
 *  - Articulated right forearm + wrist cuff + 12 high-detail sci-fi 3D weapons
 *  - Dynamic visible 3D Attachments (Machined Suppressor, High-Cap Drum, Reflex Optic, Plasma Core)
 *  - Articulated Left-Hand Atomic Heart Polymer Glove with phalanx segments, knuckle armor & live polymer gauge
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class ViewModelRig {
        constructor(camera) {
            this.camera = camera;

            this.weaponHolder = new THREE.Group();
            this.weaponHolder.position.set(0.31, -0.25, -0.52);
            this.camera.add(this.weaponHolder);
            this.weaponMeshes = [];
            this.weaponMags = [];
            this.weaponAttGroups = [];

            // Animated weapon parts
            this.rifleBolt = null;
            this.shotgunPump = null;
            this.minigunBarrelCluster = null;
            this.minigunHeatGlow = null;
            this.vulcanBarrelCluster = null;
            this.polyCoreOrb = null;
            this.polyRings = [];
            this.flamerPilot = null;
            this.chargeOrbMesh = null;
            this.chargeFins = [];
            this.railCaps = [];
            this.teslaTip = null;
            this.cryoDrum = null;
            this.hydraPorts = [];

            this.muzzleFlash = null;
            this.muzzleLight = new THREE.PointLight(0x4ade80, 0, 18);
            this.muzzleLight.position.set(0.32, -0.18, -1.35);
            this.camera.add(this.muzzleLight);

            // Left hand Polymer Glove
            this.gloveHolder = new THREE.Group();
            this.gloveHolder.position.set(-0.31, -0.21, -0.46);
            this.camera.add(this.gloveHolder);
            this.gloveFingers = [];
            this.gloveCore = null;
            this.gloveHoloRing = null;
            this.gloveVeinsMat = null;
            this.polymerGaugeFill = null;
            this.gloveLight = new THREE.PointLight(0x34d399, 0.5, 5.5);
            this.gloveLight.position.set(-0.3, -0.18, -0.62);
            this.camera.add(this.gloveLight);

            this.weaponRecoil = 0;
            this.weaponRecoilRoll = 0;
            this.drawProgress = 1;
            this.minigunSpin = 0;
            this.minigunHeat = 0;
            this.shotgunPumpAnim = 0;
            this.cryoDrumAngle = 0;
            this.cryoDrumTarget = 0;
            this.hydraFirePulse = 0;
            this.swayX = 0;
            this.swayY = 0;
            this.lastYaw = null;
            this.lastPitch = null;
            this.strafeRoll = 0;
            this.gloveCastTimer = 0;
            this.gloveCastPower = 'shield';
            this.glovePoseOpen = 0;
            this.gloveInnerRing = null;

            this._buildAllWeapons();
            this._buildPolymerGlove();
        }

        _buildAllWeapons() {
            const darkAlloy = new THREE.MeshStandardMaterial({ color: 0x0f1c17, metalness: 0.86, roughness: 0.24 });
            const gunSteel = new THREE.MeshStandardMaterial({ color: 0x3b544a, metalness: 0.78, roughness: 0.28 });
            const warmSteel = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.82, roughness: 0.26 });
            const armorSleeve = new THREE.MeshStandardMaterial({ color: 0x1a2e25, metalness: 0.65, roughness: 0.38 });
            const bronzeTrim = new THREE.MeshStandardMaterial({ color: 0x92400e, metalness: 0.68, roughness: 0.34 });
            const opticMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.58 });

            // Articulated Right Forearm + Armor Cuff + Pistol Grip Hand
            const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.38), armorSleeve);
            rArm.position.set(0.03, -0.115, 0.26);
            rArm.rotation.x = 0.24;
            const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.1, 8), darkAlloy);
            rCuff.rotation.x = Math.PI / 2 + 0.24;
            rCuff.position.set(0.025, -0.095, 0.14);
            const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.085, 0.1), gunSteel);
            rHand.position.set(0.015, -0.085, 0.055);
            const rThumb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.07), armorSleeve);
            rThumb.position.set(-0.042, -0.045, 0.035);
            this.weaponHolder.add(rArm, rCuff, rHand, rThumb);

            const makeWeaponGroup = () => {
                const g = new THREE.Group();
                g.visible = false;
                this.weaponHolder.add(g);
                this.weaponMeshes.push(g);
                return g;
            };

            const addMesh = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x, y, z);
                if (rx) m.rotation.x = rx;
                if (ry) m.rotation.y = ry;
                if (rz) m.rotation.z = rz;
                g.add(m);
                return m;
            };

            // 0: rifle ("ПЛАЗМОМЁТ MK-IV")
            {
                const g = makeWeaponGroup();
                const em = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
                addMesh(g, new THREE.BoxGeometry(0.105, 0.125, 0.56), darkAlloy, 0, 0, -0.02);
                addMesh(g, new THREE.BoxGeometry(0.088, 0.045, 0.42), gunSteel, 0, 0.078, -0.06); // upper receiver
                addMesh(g, new THREE.BoxGeometry(0.06, 0.02, 0.36), warmSteel, 0, 0.106, -0.1); // picatinny rail
                addMesh(g, new THREE.BoxGeometry(0.118, 0.095, 0.3), gunSteel, 0, 0.01, -0.26); // shrouded handguard
                addMesh(g, new THREE.CylinderGeometry(0.023, 0.027, 0.46, 10), warmSteel, 0, 0.024, -0.44, Math.PI / 2);
                addMesh(g, new THREE.CylinderGeometry(0.034, 0.032, 0.08, 10), darkAlloy, 0, 0.024, -0.66, Math.PI / 2); // muzzle brake
                addMesh(g, new THREE.BoxGeometry(0.016, 0.035, 0.03), darkAlloy, 0, 0.125, -0.26); // front sight post
                this.rifleBolt = addMesh(g, new THREE.BoxGeometry(0.038, 0.028, 0.11), warmSteel, 0.056, 0.05, 0.02);
                addMesh(g, new THREE.BoxGeometry(0.118, 0.022, 0.34), em, 0, 0.042, -0.14); // plasma core strip
                const mag = addMesh(g, new THREE.BoxGeometry(0.054, 0.18, 0.088), gunSteel, 0, -0.13, -0.08, 0.18);
                this.weaponMags[0] = mag;
            }

            // 1: shotgun ("ЭНЕРГО-ДРОБОВИК X7")
            {
                const g = makeWeaponGroup();
                const em = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
                addMesh(g, new THREE.BoxGeometry(0.145, 0.145, 0.48), darkAlloy, 0, 0, 0);
                addMesh(g, new THREE.BoxGeometry(0.13, 0.03, 0.38), gunSteel, 0, 0.082, -0.18); // top rib
                addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), warmSteel, -0.038, 0.026, -0.37, Math.PI / 2);
                addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), warmSteel, 0.038, 0.026, -0.37, Math.PI / 2);
                addMesh(g, new THREE.BoxGeometry(0.125, 0.055, 0.045), darkAlloy, 0, 0.026, -0.52); // barrel clamp bridge
                this.shotgunPump = addMesh(g, new THREE.BoxGeometry(0.148, 0.072, 0.22), bronzeTrim, 0, -0.055, -0.29);
                addMesh(g, new THREE.BoxGeometry(0.156, 0.028, 0.24), em, 0, 0.055, -0.1);
                // Side 4-shell carrier saddle!
                for (let s = 0; s < 4; s++) {
                    addMesh(g, new THREE.CylinderGeometry(0.011, 0.011, 0.048, 6), em, -0.078, 0.005, -0.14 + s * 0.04);
                }
            }

            // 2: minigun ("ПУЛЕМЁТ «ВУЛКАН-200»")
            {
                const g = makeWeaponGroup();
                const em = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
                addMesh(g, new THREE.BoxGeometry(0.22, 0.22, 0.46), darkAlloy, 0, -0.04, 0.02);
                addMesh(g, new THREE.BoxGeometry(0.24, 0.04, 0.3), gunSteel, 0, 0.08, -0.05); // top motor block
                addMesh(g, new THREE.TorusGeometry(0.11, 0.016, 6, 14, Math.PI), warmSteel, 0, 0.14, 0.02); // top carry hoop
                const drum = addMesh(g, new THREE.CylinderGeometry(0.115, 0.115, 0.24, 14), bronzeTrim, -0.13, -0.15, -0.02, 0, 0, Math.PI / 2);
                this.weaponMags[2] = drum;
                addMesh(g, new THREE.BoxGeometry(0.05, 0.12, 0.16), warmSteel, -0.09, -0.08, -0.04, 0, 0, 0.35); // ammo feed belt chute

                this.minigunBarrelCluster = new THREE.Group();
                this.minigunBarrelCluster.position.set(0, -0.02, -0.44);
                const bGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.68, 8);
                bGeo.rotateX(Math.PI / 2);
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    const b = new THREE.Mesh(bGeo, warmSteel);
                    b.position.set(Math.cos(ang) * 0.058, Math.sin(ang) * 0.058, 0);
                    this.minigunBarrelCluster.add(b);
                }
                const clamp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.055, 14), darkAlloy);
                clamp1.rotation.x = Math.PI / 2; clamp1.position.z = -0.16;
                const clamp2 = clamp1.clone();
                clamp2.position.z = -0.32;
                this.minigunHeatGlow = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.044, 0.044, 0.45, 10),
                    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.12 })
                );
                this.minigunHeatGlow.rotation.x = Math.PI / 2; this.minigunHeatGlow.position.z = -0.18;
                this.minigunBarrelCluster.add(clamp1, clamp2, this.minigunHeatGlow);
                addMesh(g, new THREE.BoxGeometry(0.23, 0.032, 0.28), em, 0, 0.055, -0.04);
                g.add(this.minigunBarrelCluster);
            }

            // 3: polymer_beam ("ГЕЛИОС-П") — Polymer-Powered Sphere Cannon!
            {
                const g = makeWeaponGroup();
                const tubeMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
                const cyanMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
                addMesh(g, new THREE.BoxGeometry(0.16, 0.16, 0.56), darkAlloy, 0, 0, 0);
                addMesh(g, new THREE.BoxGeometry(0.18, 0.05, 0.36), gunSteel, 0, 0.09, -0.14); // upper stabilizer bridge
                [-0.088, 0.088].forEach(tx => {
                    addMesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.48, 10), tubeMat, tx, 0.02, -0.24, Math.PI / 2);
                    addMesh(g, new THREE.BoxGeometry(0.026, 0.072, 0.38), warmSteel, tx * 0.72, 0.02, -0.45);
                });
                addMesh(g, new THREE.BoxGeometry(0.07, 0.022, 0.32), cyanMat, 0, 0.098, -0.42);
                this.polyCoreOrb = addMesh(g, new THREE.OctahedronGeometry(0.048, 1), cyanMat, 0, 0.02, -0.62);
                this.polyRings = [];
                for (let i = 0; i < 3; i++) {
                    const pr = addMesh(g, new THREE.TorusGeometry(0.086 - i * 0.012, 0.011, 8, 22), i === 1 ? cyanMat : tubeMat, 0, 0.02, -0.36 - i * 0.13);
                    this.polyRings.push(pr);
                }
            }

            // 4: nova ("ПУШКА СУПЕРНОВА")
            {
                const g = makeWeaponGroup();
                const em = new THREE.MeshBasicMaterial({ color: 0x22c55e });
                addMesh(g, new THREE.BoxGeometry(0.18, 0.17, 0.52), darkAlloy, 0, 0, 0);
                addMesh(g, new THREE.CylinderGeometry(0.036, 0.036, 0.28, 10), warmSteel, -0.105, -0.01, -0.12, Math.PI / 2); // left cap bottle
                addMesh(g, new THREE.CylinderGeometry(0.036, 0.036, 0.28, 10), warmSteel, 0.105, -0.01, -0.12, Math.PI / 2);  // right cap bottle
                addMesh(g, new THREE.TorusGeometry(0.098, 0.018, 8, 18), gunSteel, 0, 0.02, -0.32);
                addMesh(g, new THREE.TorusGeometry(0.092, 0.016, 8, 18), gunSteel, 0, 0.02, -0.49);
                this.chargeOrbMesh = addMesh(g, new THREE.SphereGeometry(0.044, 12, 12), new THREE.MeshBasicMaterial({ color: 0x34d399 }), 0, 0.02, -0.58);
                this.chargeFins = [];
                for (let i = 0; i < 4; i++) {
                    const ang = (i / 4) * Math.PI * 2;
                    const fin = addMesh(g, new THREE.BoxGeometry(0.022, 0.068, 0.22), em, Math.cos(ang) * 0.1, Math.sin(ang) * 0.1 + 0.02, -0.46, 0, 0, ang);
                    this.chargeFins.push({ mesh: fin, angle: ang });
                }
            }

            // 5: smg ("ПП ШЕРШЕНЬ-VX")
            {
                const g = makeWeaponGroup();
                const em = new THREE.MeshBasicMaterial({ color: 0x86efac });
                addMesh(g, new THREE.BoxGeometry(0.095, 0.12, 0.42), darkAlloy, 0, 0, 0.02);
                addMesh(g, new THREE.BoxGeometry(0.082, 0.05, 0.34), gunSteel, 0, 0.055, -0.08);
                addMesh(g, new THREE.CylinderGeometry(0.02, 0.022, 0.3, 10), warmSteel, 0, 0.022, -0.28, Math.PI / 2);
                addMesh(g, new THREE.CylinderGeometry(0.032, 0.022, 0.07, 10), darkAlloy, 0, 0.022, -0.44, Math.PI / 2); // compensator
                addMesh(g, new THREE.BoxGeometry(0.038, 0.1, 0.044), darkAlloy, 0, -0.09, -0.22, -0.15); // angled vertical grip
                const mag = addMesh(g, new THREE.BoxGeometry(0.042, 0.24, 0.064), gunSteel, 0, -0.15, -0.05, -0.22);
                this.weaponMags[5] = mag;
                addMesh(g, new THREE.BoxGeometry(0.102, 0.022, 0.28), em, 0, 0.044, -0.06);
                addMesh(g, new THREE.BoxGeometry(0.046, 0.025, 0.18), em, 0, 0.09, -0.04);
            }

            // 6: flamer ("ОГНЕМЁТ ИНФЕРНО")
            {
                const g = makeWeaponGroup();
                const em = new THREE.MeshBasicMaterial({ color: 0xff6b2b });
                addMesh(g, new THREE.BoxGeometry(0.14, 0.15, 0.52), darkAlloy, 0, 0, 0);
                const tank = addMesh(g, new THREE.CylinderGeometry(0.072, 0.072, 0.36, 12), new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.58, roughness: 0.32 }), 0, -0.12, -0.08, Math.PI / 2);
                this.weaponMags[6] = tank;
                addMesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), warmSteel, -0.06, -0.05, -0.22, 0.4, 0, 0.2); // fuel hose
                addMesh(g, new THREE.CylinderGeometry(0.052, 0.036, 0.42, 12), gunSteel, 0, 0.02, -0.42, Math.PI / 2);
                addMesh(g, new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12), bronzeTrim, 0, 0.02, -0.36, Math.PI / 2); // heat shroud jacket
                addMesh(g, new THREE.BoxGeometry(0.02, 0.02, 0.14), warmSteel, 0.035, -0.015, -0.56); // igniter prong
                this.flamerPilot = addMesh(g, new THREE.ConeGeometry(0.036, 0.09, 8), em, 0, -0.01, -0.64, Math.PI / 2);
            }

            // 7: railgun ("РЕЛЬСОТРОН ГИПЕРИОН")
            {
                const g = makeWeaponGroup();
                const cy = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
                const hiCy = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
                addMesh(g, new THREE.BoxGeometry(0.135, 0.165, 0.56), darkAlloy, 0, 0, 0);
                addMesh(g, new THREE.BoxGeometry(0.028, 0.056, 0.62), warmSteel, -0.05, 0.03, -0.47);
                addMesh(g, new THREE.BoxGeometry(0.028, 0.056, 0.62), warmSteel, 0.05, 0.03, -0.47);
                addMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), cy, 0, 0.03, -0.46, Math.PI / 2);
                addMesh(g, new THREE.BoxGeometry(0.11, 0.03, 0.06), gunSteel, 0, 0.065, -0.58); // forward rail bridge
                this.railCaps = [];
                for (let i = 0; i < 4; i++) {
                    const cap = addMesh(g, new THREE.BoxGeometry(0.02, 0.062, 0.044), hiCy, 0.076, 0.03, -0.14 - i * 0.08);
                    this.railCaps.push(cap);
                }
            }

            // 8: tesla ("ТЕСЛА-ДУГА ЗЕВС")
            {
                const g = makeWeaponGroup();
                const tCoilMat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
                addMesh(g, new THREE.BoxGeometry(0.14, 0.16, 0.5), darkAlloy, 0, 0, 0);
                addMesh(g, new THREE.CylinderGeometry(0.026, 0.026, 0.24, 8), bronzeTrim, -0.078, 0.01, -0.1, Math.PI / 2);
                addMesh(g, new THREE.CylinderGeometry(0.026, 0.026, 0.24, 8), bronzeTrim, 0.078, 0.01, -0.1, Math.PI / 2);
                for (let i = 0; i < 4; i++) {
                    addMesh(g, new THREE.TorusGeometry(0.072 - i * 0.007, 0.013, 8, 18), i % 2 === 0 ? tCoilMat : bronzeTrim, 0, 0.02, -0.22 - i * 0.095);
                }
                addMesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8), warmSteel, 0, 0.02, -0.39, Math.PI / 2);
                this.teslaTip = addMesh(g, new THREE.OctahedronGeometry(0.062, 0), tCoilMat, 0, 0.02, -0.66);
            }

            // 9: cryo_launcher ("КРИО-МИНОМЁТ МЕТЕЛЬ")
            {
                const g = makeWeaponGroup();
                const iceMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
                addMesh(g, new THREE.BoxGeometry(0.16, 0.16, 0.44), darkAlloy, 0, 0, 0);
                this.cryoDrum = addMesh(g, new THREE.CylinderGeometry(0.11, 0.11, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.68, roughness: 0.28 }), 0, 0.01, -0.16, Math.PI / 2);
                this.weaponMags[9] = this.cryoDrum;
                addMesh(g, new THREE.CylinderGeometry(0.068, 0.072, 0.4, 12), warmSteel, 0, 0.03, -0.43, Math.PI / 2);
                addMesh(g, new THREE.CylinderGeometry(0.024, 0.024, 0.26, 8), iceMat, -0.078, 0.02, -0.36, Math.PI / 2); // cryo tank L
                addMesh(g, new THREE.CylinderGeometry(0.024, 0.024, 0.26, 8), iceMat, 0.078, 0.02, -0.36, Math.PI / 2);  // cryo tank R
                addMesh(g, new THREE.TorusGeometry(0.076, 0.013, 6, 16), iceMat, 0, 0.03, -0.6);
                addMesh(g, new THREE.TorusGeometry(0.08, 0.012, 6, 16), gunSteel, 0, 0.03, -0.48);
            }

            // 10: hydra ("РАКЕТНИЦА ГИДРА-3")
            {
                const g = makeWeaponGroup();
                const roseMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
                const warheadMat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
                addMesh(g, new THREE.BoxGeometry(0.24, 0.17, 0.56), darkAlloy, 0, 0.02, -0.15);
                addMesh(g, new THREE.BoxGeometry(0.26, 0.035, 0.46), roseMat, 0, 0.106, -0.15);
                addMesh(g, new THREE.BoxGeometry(0.065, 0.06, 0.12), gunSteel, 0.09, 0.135, -0.08); // lock-on sensor pod
                addMesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), warheadMat, 0.09, 0.135, -0.15, Math.PI / 2); // lens
                this.hydraPorts = [];
                [-0.068, 0, 0.068].forEach(px => {
                    addMesh(g, new THREE.CylinderGeometry(0.034, 0.034, 0.12, 10), warmSteel, px, 0.02, -0.43, Math.PI / 2);
                    const nose = addMesh(g, new THREE.ConeGeometry(0.025, 0.06, 8), warheadMat, px, 0.02, -0.5, -Math.PI / 2);
                    this.hydraPorts.push(nose);
                });
            }

            // 11: vulcan_gatling ("ГАТЛИНГ БУРЯ-M6")
            {
                const g = makeWeaponGroup();
                const orMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
                addMesh(g, new THREE.BoxGeometry(0.24, 0.24, 0.5), darkAlloy, 0, -0.04, 0.02);
                addMesh(g, new THREE.BoxGeometry(0.32, 0.22, 0.04), gunSteel, 0, 0.06, -0.2); // armored gun shield
                const drum = addMesh(g, new THREE.CylinderGeometry(0.13, 0.13, 0.28, 14), bronzeTrim, -0.14, -0.16, -0.04, 0, 0, Math.PI / 2);
                this.weaponMags[11] = drum;
                addMesh(g, new THREE.BoxGeometry(0.06, 0.12, 0.18), warmSteel, -0.09, -0.09, -0.04, 0, 0, 0.3); // feed chute

                this.vulcanBarrelCluster = new THREE.Group();
                this.vulcanBarrelCluster.position.set(0, -0.02, -0.5);
                const vbGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.78, 8);
                vbGeo.rotateX(Math.PI / 2);
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    const bar = new THREE.Mesh(vbGeo, warmSteel);
                    bar.position.set(Math.cos(ang) * 0.068, Math.sin(ang) * 0.068, 0);
                    this.vulcanBarrelCluster.add(bar);
                }
                const midCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.06, 14), darkAlloy);
                midCollar.rotation.x = Math.PI / 2; midCollar.position.z = -0.14;
                const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 6, 16), orMat);
                muzzleRing.position.z = -0.34;
                this.vulcanBarrelCluster.add(midCollar, muzzleRing);
                addMesh(g, new THREE.BoxGeometry(0.18, 0.04, 0.36), orMat, 0, 0.09, -0.05);
                g.add(this.vulcanBarrelCluster);
            }

            // Build Dynamic Visible 3D Attachment Sub-Meshes for EACH Weapon
            const attAlloy = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
            const attGlow = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
            const attFire = new THREE.MeshBasicMaterial({ color: 0xf97316 });
            this.weaponMeshes.forEach((wg, idx) => {
                const barrelMod = new THREE.Group();
                const supMain = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.21, 10), attAlloy);
                supMain.rotation.x = Math.PI / 2;
                const supRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 12), attGlow);
                supRing.position.z = -0.07;
                barrelMod.add(supMain, supRing);
                barrelMod.position.set(0, 0.025, -0.68);
                barrelMod.visible = false;

                const magMod = new THREE.Group();
                const extDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.14, 12), attAlloy);
                extDrum.rotation.z = Math.PI / 2;
                const extBand = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.069, 0.04, 12), attGlow);
                extBand.rotation.z = Math.PI / 2;
                magMod.add(extDrum, extBand);
                magMod.position.set(0, -0.14, -0.12);
                magMod.visible = false;

                const opticMod = new THREE.Group();
                const frameBase = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.028, 0.12), attAlloy);
                const archL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.055, 0.03), attAlloy);
                archL.position.set(-0.03, 0.038, 0);
                const archR = archL.clone();
                archR.position.x = 0.03;
                const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.044), opticMat);
                glass.position.y = 0.038;
                const retDot = new THREE.Mesh(new THREE.OctahedronGeometry(0.007, 0), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
                retDot.position.set(0, 0.038, -0.002);
                opticMod.add(frameBase, archL, archR, glass, retDot);
                opticMod.position.set(0, 0.115, -0.06);
                opticMod.visible = false;

                const coreMod = new THREE.Group();
                const coilBody = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.052, 0.2), attAlloy);
                const coilFin = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.022, 0.16), attFire);
                coreMod.add(coilBody, coilFin);
                coreMod.position.set(0, -0.06, -0.34);
                coreMod.visible = false;

                wg.add(barrelMod, magMod, opticMod, coreMod);
                this.weaponAttGroups[idx] = {
                    barrel: barrelMod,
                    mag: magMod,
                    optic: opticMod,
                    core: coreMod
                };
            });

            this.muzzleFlash = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.16, 0),
                new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.92 })
            );
            this.muzzleFlash.position.set(0, 0.03, -0.78);
            this.muzzleFlash.visible = false;
            this.weaponHolder.add(this.muzzleFlash);
        }

        syncWeaponAttachments(weaponIdx, equippedMap) {
            const grp = this.weaponAttGroups[weaponIdx];
            if (!grp || !equippedMap) return;
            grp.barrel.visible = Boolean(equippedMap.barrel);
            grp.mag.visible = Boolean(equippedMap.mag);
            grp.optic.visible = Boolean(equippedMap.optic);
            grp.core.visible = Boolean(equippedMap.core);
        }

        _buildPolymerGlove() {
            const cuffMat = new THREE.MeshStandardMaterial({ color: 0x0f221b, metalness: 0.84, roughness: 0.24 });
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x264438, metalness: 0.74, roughness: 0.3 });
            const knuckleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.88, roughness: 0.22 });
            this.gloveVeinsMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

            const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.078, 0.38, 12), cuffMat);
            forearm.rotation.x = Math.PI / 2.2;
            forearm.position.set(-0.03, -0.08, 0.18);
            this.gloveHolder.add(forearm);

            const wristCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.074, 0.065, 12), knuckleMat);
            wristCollar.rotation.x = Math.PI / 2.2;
            wristCollar.position.set(-0.015, -0.04, 0.06);
            this.gloveHolder.add(wristCollar);

            // Live Forearm Polymer Gauge
            const gaugeFrame = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.02, 0.16), cuffMat);
            gaugeFrame.position.set(-0.045, 0.032, 0.11);
            gaugeFrame.rotation.z = -0.22;
            this.polymerGaugeFill = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.14), this.gloveVeinsMat);
            this.polymerGaugeFill.position.set(-0.045, 0.034, 0.11);
            this.polymerGaugeFill.rotation.z = -0.22;
            this.gloveHolder.add(gaugeFrame, this.polymerGaugeFill);

            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.055, 0.145), plateMat);
            palm.position.set(0, 0, -0.02);
            palm.rotation.z = -0.22;
            this.gloveHolder.add(palm);

            const veinStrip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.065, 0.26), this.gloveVeinsMat);
            veinStrip.position.set(0, 0.015, 0.03);
            veinStrip.rotation.z = -0.22;
            this.gloveHolder.add(veinStrip);

            this.gloveCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), this.gloveVeinsMat);
            this.gloveCore.position.set(0.02, 0.058, -0.03);
            this.gloveHoloRing = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.009, 6, 20), this.gloveVeinsMat);
            this.gloveHoloRing.position.copy(this.gloveCore.position);
            this.gloveHoloRing.rotation.x = Math.PI / 2.5;
            this.gloveInnerRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.007, 6, 16), this.gloveVeinsMat);
            this.gloveInnerRing.position.copy(this.gloveCore.position);
            this.gloveInnerRing.rotation.y = Math.PI / 3;
            this.gloveHolder.add(this.gloveCore, this.gloveHoloRing, this.gloveInnerRing);

            [
                { x: 0.062, y: -0.005, z: -0.055, rotZ: -0.6, len: 0.072 },
                { x: 0.035, y: 0.008,  z: -0.105, rotZ: -0.2, len: 0.088 },
                { x: 0.012, y: 0.012,  z: -0.112, rotZ: -0.2, len: 0.095 },
                { x: -0.014, y: 0.008, z: -0.106, rotZ: -0.2, len: 0.088 },
                { x: -0.038, y: 0.002, z: -0.096, rotZ: -0.2, len: 0.075 }
            ].forEach((f) => {
                const pivot = new THREE.Group();
                pivot.position.set(f.x, f.y, f.z);
                pivot.rotation.z = f.rotZ;
                const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.026, 0.024), knuckleMat);
                const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, f.len * 0.68), plateMat);
                seg1.position.z = -f.len * 0.36;
                const tip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, f.len * 0.45), this.gloveVeinsMat);
                tip.position.z = -f.len * 0.9;
                pivot.add(knuckle, seg1, tip);
                this.gloveHolder.add(pivot);
                this.gloveFingers.push(pivot);
            });
        }

        onWeaponSwitch(weaponIndex, equippedAttachments) {
            this.weaponMeshes.forEach((m, i) => {
                m.visible = (i === weaponIndex);
            });
            const safeIdx = Math.max(0, Math.min(weaponIndex, 11));
            this.syncWeaponAttachments(safeIdx, equippedAttachments);
            this.drawProgress = 0;
        }

        onWeaponFire(weaponIndex, weaponCfg, recoilMult = 1.0) {
            this.weaponRecoil = (weaponCfg.recoil || 0.08) * recoilMult;
            this.weaponRecoilRoll = ((Math.random() - 0.5) * 0.09) * recoilMult;
            if (weaponCfg.id === 'minigun' || weaponCfg.id === 'vulcan_gatling') {
                this.minigunSpin = 42;
                this.minigunHeat = Math.min(1, this.minigunHeat + 0.045);
            }
            if (weaponCfg.id === 'shotgun') {
                this.shotgunPumpAnim = 1.0;
            }
            if (weaponCfg.id === 'cryo_launcher') {
                this.cryoDrumTarget += Math.PI / 3;
            }
            if (weaponCfg.id === 'hydra') {
                this.hydraFirePulse = 1.0;
            }
            this.muzzleFlash.visible = true;
            this.muzzleFlash.material.color.setHex(weaponCfg.color);
            this.muzzleFlash.rotation.z = Math.random() * Math.PI;
            this.muzzleLight.color.setHex(weaponCfg.color);
            this.muzzleLight.intensity = weaponCfg.kind === 'flame' ? 2.5 : 3.8;
        }

        triggerGloveCast(powerId, hexColor) {
            this.gloveCastPower = powerId;
            this.gloveCastTimer = 0.55;
            this.setGloveColor(hexColor);
        }

        setGloveColor(hexColor) {
            if (this.gloveVeinsMat) this.gloveVeinsMat.color.setHex(hexColor);
            this.gloveLight.color.setHex(hexColor);
        }

        getMuzzleWorldPos() {
            return new THREE.Vector3(0.24, -0.2, -0.98).applyMatrix4(this.camera.matrixWorld);
        }

        getGloveWorldPos() {
            return new THREE.Vector3(-0.3, -0.18, -0.78).applyMatrix4(this.camera.matrixWorld);
        }

        update(dt, state) {
            const {
                weaponIndex,
                curWeapon,
                reloading,
                reloadTimer,
                reloadDur,
                boostActive,
                isCharging,
                chargeRatio,
                chargeSeconds = 0,
                polymerRatio = 1,
                playerYaw = 0,
                playerPitch = 0,
                horizSpeed = 0,
                moveRight = 0,
                bobTime,
                slideTimer,
                wheelOpen,
                buildMode = false,
                polymerFireBuffTimer,
                timeStopTimer,
                timeSlowTimer
            } = state;

            const tNow = performance.now() * 0.005;

            // Smooth camera turn lag sway + strafe banking + sprint/bhop posture tilt
            if (this.lastYaw !== null) {
                let dYaw = playerYaw - this.lastYaw;
                while (dYaw > Math.PI) dYaw -= Math.PI * 2;
                while (dYaw < -Math.PI) dYaw += Math.PI * 2;
                const dPitch = playerPitch - this.lastPitch;
                this.swayX = Math.max(-0.045, Math.min(0.045, this.swayX + dYaw * 0.14));
                this.swayY = Math.max(-0.04, Math.min(0.04, this.swayY - dPitch * 0.14));
            }
            this.lastYaw = playerYaw;
            this.lastPitch = playerPitch;
            this.swayX *= Math.exp(-12 * dt);
            this.swayY *= Math.exp(-12 * dt);
            this.strafeRoll += ((-moveRight * 0.05) - this.strafeRoll) * Math.min(1, dt * 11);

            const speedTilt = Math.max(0, Math.min(1, (horizSpeed - 12) / 14));
            this.drawProgress = Math.min(1, this.drawProgress + dt * 6.5);
            const drawDrop = (1 - this.drawProgress) * 0.25;
            this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 1.35);
            this.weaponRecoilRoll *= Math.exp(-14 * dt);

            const effReloadDur = reloadDur || (curWeapon.reloadTime * (boostActive ? 0.62 : 1.0));
            const reloadProg = reloading ? 1 - (reloadTimer / Math.max(0.1, effReloadDur)) : 0;
            const reloadDip = reloading ? Math.sin(reloadProg * Math.PI) * 0.28 : 0;
            const reloadRoll = reloading ? Math.sin(reloadProg * Math.PI) * 0.36 : 0;
            const reloadYaw = reloading ? Math.sin(reloadProg * Math.PI) * 0.22 : 0;
            const boltPull = (reloading && reloadProg > 0.72) ? Math.sin(((reloadProg - 0.72) / 0.28) * Math.PI) * 0.1 : 0;

            const curMag = this.weaponMags[weaponIndex];
            if (curMag) {
                const magDrop = reloading
                    ? (reloadProg < 0.5 ? Math.sin(reloadProg * Math.PI) * 0.24 : Math.pow(Math.max(0, 1 - reloadProg) * 2, 1.4) * 0.24)
                    : 0;
                curMag.position.y = (curWeapon.id === 'minigun' || curWeapon.id === 'smg' ? -0.15 : (curWeapon.id === 'flamer' ? -0.12 : -0.13)) - magDrop;
            }

            const breathY = Math.sin(tNow * 0.55) * 0.004;
            this.weaponHolder.position.set(
                0.31 + this.swayX - speedTilt * 0.03 + Math.cos(bobTime * 0.5) * (0.016 + speedTilt * 0.008),
                -0.25 + breathY + this.swayY - reloadDip - drawDrop - (buildMode ? 0.14 : 0) + Math.abs(Math.sin(bobTime)) * 0.016 - (slideTimer > 0 ? 0.05 : 0),
                -0.52 + this.weaponRecoil + boltPull * 0.25
            );
            this.weaponHolder.rotation.set(
                this.weaponRecoil * 1.15 - reloadDip * 1.35 - drawDrop * 1.2 - (buildMode ? 0.45 : 0) - speedTilt * 0.06,
                reloadYaw + speedTilt * 0.12,
                this.strafeRoll + this.weaponRecoilRoll + (slideTimer > 0 ? -0.24 : 0) + reloadRoll
            );

            if (this.rifleBolt && curWeapon.id === 'rifle') {
                this.rifleBolt.position.z = 0.02 + this.weaponRecoil * 1.2 + boltPull;
            }
            if (this.shotgunPump && (this.shotgunPumpAnim > 0 || boltPull > 0)) {
                this.shotgunPumpAnim = Math.max(0, this.shotgunPumpAnim - dt * 2.8);
                this.shotgunPump.position.z = -0.29 + Math.sin(this.shotgunPumpAnim * Math.PI) * 0.11 + boltPull;
            }
            if (this.cryoDrum) {
                this.cryoDrumAngle += (this.cryoDrumTarget - this.cryoDrumAngle) * Math.min(1, dt * 14);
                this.cryoDrum.rotation.z = this.cryoDrumAngle;
            }
            if (this.hydraPorts.length > 0 && curWeapon.id === 'hydra') {
                if (this.hydraFirePulse > 0) this.hydraFirePulse = Math.max(0, this.hydraFirePulse - dt * 2.6);
                const plunge = Math.sin(this.hydraFirePulse * Math.PI) * 0.06;
                this.hydraPorts.forEach((nose, idx) => {
                    nose.position.z = -0.5 + plunge + Math.sin(tNow * 1.5 + idx) * 0.004;
                });
            }
            if (this.minigunBarrelCluster || this.vulcanBarrelCluster) {
                if (this.minigunSpin > 0) {
                    if (this.minigunBarrelCluster) this.minigunBarrelCluster.rotation.z += this.minigunSpin * dt;
                    if (this.vulcanBarrelCluster) this.vulcanBarrelCluster.rotation.z += this.minigunSpin * 1.25 * dt;
                    this.minigunSpin = Math.max(0, this.minigunSpin - dt * 34);
                }
                this.minigunHeat = Math.max(0, this.minigunHeat - dt * 0.25);
                if (this.minigunHeatGlow) {
                    this.minigunHeatGlow.material.opacity = 0.1 + this.minigunHeat * 0.68;
                    this.minigunHeatGlow.material.color.setHex(this.minigunHeat > 0.65 ? 0xfde047 : 0xf97316);
                }
            }
            if (this.polyCoreOrb && curWeapon.id === 'polymer_beam') {
                const infScale = isCharging
                    ? (1 + Math.min(7.5, Math.sqrt(Math.max(0, chargeSeconds)) * 2.6 + chargeRatio * 1.4))
                    : (1.0 + Math.sin(tNow * 1.4) * 0.09);
                this.polyCoreOrb.scale.setScalar(infScale);
                this.polyCoreOrb.rotation.y += dt * (isCharging ? (10 + chargeSeconds * 4) : 2.8);
                this.polyCoreOrb.rotation.x += dt * (isCharging ? 6.0 : 1.5);
                this.polyCoreOrb.material.color.setHex(chargeSeconds > 3.0 ? 0xfacc15 : (chargeSeconds > 1.2 ? 0x67e8f9 : 0x34d399));
                this.polyRings.forEach((pr, idx) => {
                    pr.rotation.z += dt * (isCharging ? (10 + Math.min(30, chargeSeconds * 8)) : 2.2) * (idx % 2 === 0 ? 1 : -1);
                    pr.rotation.x = Math.sin(tNow * 0.9 + idx * 1.1) * (isCharging ? 0.35 : 0.12);
                });
            }
            if (this.flamerPilot) {
                this.flamerPilot.scale.set(
                    0.85 + Math.sin(tNow * 6.5) * 0.25,
                    0.9 + Math.cos(tNow * 8.2) * 0.28,
                    0.85 + Math.sin(tNow * 5.1) * 0.25
                );
            }
            if (this.chargeOrbMesh && curWeapon.id === 'nova') {
                const novaS = isCharging ? (1 + chargeRatio * 3.1) : (0.92 + Math.sin(tNow * 1.5) * 0.1);
                this.chargeOrbMesh.scale.setScalar(novaS);
                this.chargeFins.forEach(f => {
                    const spread = 0.1 + (isCharging ? chargeRatio * 0.09 : Math.sin(tNow * 0.8) * 0.008);
                    f.mesh.position.x = Math.cos(f.angle + tNow * 0.8) * spread;
                    f.mesh.position.y = Math.sin(f.angle + tNow * 0.8) * spread + 0.02;
                    f.mesh.rotation.z = f.angle + tNow * 0.8;
                });
            }
            if (this.teslaTip) {
                this.teslaTip.rotation.y += dt * 4.6;
                this.teslaTip.rotation.x += dt * 2.8;
                this.teslaTip.scale.setScalar(0.92 + Math.sin(tNow * 2.5) * 0.14);
            }
            if (this.railCaps.length > 0 && curWeapon.id === 'railgun') {
                this.railCaps.forEach((cap, idx) => {
                    cap.material.color.setHex((Math.floor(tNow * 2.4 + idx) % 4 === 0) ? 0x4ade80 : 0x38bdf8);
                });
            }

            if (this.muzzleLight.intensity > 0) {
                this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 34);
                if (this.muzzleLight.intensity < 1.2) this.muzzleFlash.visible = false;
            }

            // Left-Hand Polymer Glove + Multi-Ring Holo Iris + Organic Finger Ripple
            if (this.polymerGaugeFill) {
                const pr = Math.max(0.06, Math.min(1, polymerRatio));
                this.polymerGaugeFill.scale.set(1, 1, pr);
            }
            this.gloveCore.rotation.y += dt * (wheelOpen || buildMode || isCharging ? 7.2 : 2.4);
            this.gloveHoloRing.rotation.z -= dt * (wheelOpen || buildMode || isCharging ? 5.8 : 1.9);
            if (this.gloveInnerRing) {
                this.gloveInnerRing.rotation.x += dt * (wheelOpen || isCharging ? 6.4 : 2.5);
                this.gloveInnerRing.scale.setScalar(isCharging ? 1.25 : 0.94 + Math.sin(tNow * 1.8) * 0.08);
            }

            const targetWheelPose = (wheelOpen || buildMode) ? 1 : 0;
            this.glovePoseOpen += (targetWheelPose - this.glovePoseOpen) * Math.min(1, dt * 14);

            let castThrustZ = 0, castLiftY = 0, castRoll = 0;
            let fingerCurl = isCharging ? -0.78 : -0.35;

            if (this.gloveCastTimer > 0) {
                this.gloveCastTimer = Math.max(0, this.gloveCastTimer - dt);
                const bell = Math.sin((this.gloveCastTimer / 0.55) * Math.PI);
                if (this.gloveCastPower === 'timestop' || this.gloveCastPower === 'timeslow') {
                    castThrustZ = -0.18 * bell;
                    castLiftY = 0.14 * bell;
                    castRoll = 0.72 * bell;
                    fingerCurl = -1.28 * bell;
                } else if (this.gloveCastPower === 'freeze' || this.gloveCastPower === 'fire') {
                    castThrustZ = -0.28 * bell;
                    castLiftY = 0.08 * bell;
                    castRoll = -0.35 * bell;
                    fingerCurl = 0.48 * bell;
                } else if (this.gloveCastPower === 'telekinesis') {
                    castThrustZ = -0.2 * bell;
                    castLiftY = 0.18 * bell;
                    fingerCurl = -0.95 * bell;
                } else if (this.gloveCastPower === 'knockback') {
                    castThrustZ = -0.34 * bell;
                    castLiftY = 0.1 * bell;
                    fingerCurl = 0.52 * bell;
                } else {
                    castThrustZ = -0.26 * bell;
                    castLiftY = 0.1 * bell;
                    fingerCurl = 0.28 * bell;
                }
            } else if (wheelOpen) {
                fingerCurl = 0.28;
            }

            this.gloveFingers.forEach((f, idx) => {
                const wave = Math.sin(tNow * 1.4 - idx * 0.65) * 0.1;
                const targetX = fingerCurl + wave;
                f.rotation.x += (targetX - f.rotation.x) * Math.min(1, dt * 16);
            });

            this.gloveHolder.position.set(
                -0.31 + this.swayX * 0.8 + this.glovePoseOpen * 0.1 - Math.cos(bobTime * 0.5) * 0.014,
                -0.21 + breathY * 1.1 + this.swayY * 0.8 + this.glovePoseOpen * 0.08 + castLiftY + Math.abs(Math.sin(bobTime)) * 0.014 - (slideTimer > 0 ? 0.04 : 0),
                -0.46 + castThrustZ - this.glovePoseOpen * 0.05
            );
            this.gloveHolder.rotation.set(
                this.glovePoseOpen * 0.34 + (polymerFireBuffTimer > 0 ? Math.sin(tNow * 4) * 0.04 : 0),
                0.14 + this.glovePoseOpen * 0.22,
                this.strafeRoll * 0.7 + castRoll - this.glovePoseOpen * 0.22
            );

            this.gloveLight.intensity = 0.5 + (this.gloveCastTimer > 0 ? 2.4 : 0) + (isCharging ? 0.8 : 0) + (timeStopTimer > 0 || timeSlowTimer > 0 ? 0.9 : 0);
        }
    }

    XB.ViewModelRig = ViewModelRig;
})(window);
