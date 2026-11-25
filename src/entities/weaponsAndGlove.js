/**
 * First-Person ViewModel Rig:
 *  - Right-hand arm + 11 distinct 3D sci-fi weapons (including Polymer Beam Cannon "ГЕЛИОС-П")
 *  - Dynamic visible 3D Attachments (Barrel, Extended Mag, Holo Optic, Tactical Core)
 *  - Left-hand Atomic Heart Polymer Glove with articulated fingers & dynamic ability lighting
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
            this.gloveLight = new THREE.PointLight(0x34d399, 0.5, 5.5);
            this.gloveLight.position.set(-0.3, -0.18, -0.62);
            this.camera.add(this.gloveLight);

            this.weaponRecoil = 0;
            this.drawProgress = 1;
            this.minigunSpin = 0;
            this.minigunHeat = 0;
            this.shotgunPumpAnim = 0;
            this.gloveCastTimer = 0;
            this.gloveCastPower = 'shield';
            this.glovePoseOpen = 0;

            this._buildAllWeapons();
            this._buildPolymerGlove();
        }

        _buildAllWeapons() {
            const darkAlloy = new THREE.MeshStandardMaterial({ color: 0x111e19, metalness: 0.85, roughness: 0.25 });
            const gunSteel = new THREE.MeshStandardMaterial({ color: 0x3b5249, metalness: 0.78, roughness: 0.3 });
            const armorSleeve = new THREE.MeshStandardMaterial({ color: 0x1b2e26, metalness: 0.65, roughness: 0.4 });
            const opticMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.55 });

            const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.42), armorSleeve);
            rArm.position.set(0.03, -0.11, 0.25);
            rArm.rotation.x = 0.25;
            this.weaponHolder.add(rArm);

            const makeWeaponGroup = (id) => {
                const g = new THREE.Group();
                g.visible = false;
                this.weaponHolder.add(g);
                this.weaponMeshes.push(g);
                return g;
            };

            // 0: rifle
            {
                const g = makeWeaponGroup('rifle');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.58), darkAlloy);
                const hg = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.11, 0.32), gunSteel);
                hg.position.set(0, 0.01, -0.22);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.44, 10), gunSteel);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.025, -0.42);
                this.rifleBolt = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.12), gunSteel);
                this.rifleBolt.position.set(0.055, 0.045, 0.02);
                const glow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.36), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
                glow.position.set(0, 0.045, -0.12);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.09), gunSteel);
                mag.position.set(0, -0.13, -0.08); mag.rotation.x = 0.18;
                g.add(body, hg, barrel, this.rifleBolt, glow, mag);
                this.weaponMags[0] = mag;
            }

            // 1: shotgun
            {
                const g = makeWeaponGroup('shotgun');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.5), darkAlloy);
                const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.42, 10), gunSteel);
                const b2 = b1.clone();
                b1.rotation.x = Math.PI / 2; b1.position.set(-0.038, 0.025, -0.36);
                b2.rotation.x = Math.PI / 2; b2.position.set( 0.038, 0.025, -0.36);
                this.shotgunPump = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.075, 0.22), new THREE.MeshStandardMaterial({ color: 0x92400e, metalness: 0.4, roughness: 0.5 }));
                this.shotgunPump.position.set(0, -0.055, -0.28);
                const glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 0.24), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
                glow.position.set(0, 0.055, -0.1);
                g.add(body, b1, b2, this.shotgunPump, glow);
            }

            // 2: minigun
            {
                const g = makeWeaponGroup('minigun');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.46), darkAlloy);
                body.position.set(0, -0.04, 0.02);
                const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.24, 14), new THREE.MeshStandardMaterial({ color: 0x713f12, metalness: 0.55, roughness: 0.4 }));
                drum.rotation.z = Math.PI / 2; drum.position.set(-0.13, -0.15, -0.02);
                this.weaponMags[2] = drum;

                this.minigunBarrelCluster = new THREE.Group();
                this.minigunBarrelCluster.position.set(0, -0.02, -0.44);
                const bGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.66, 6);
                bGeo.rotateX(Math.PI / 2);
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    const b = new THREE.Mesh(bGeo, gunSteel);
                    b.position.set(Math.cos(ang) * 0.058, Math.sin(ang) * 0.058, 0);
                    this.minigunBarrelCluster.add(b);
                }
                const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 12), darkAlloy);
                clamp.rotation.x = Math.PI / 2; clamp.position.z = -0.2;
                this.minigunHeatGlow = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.072, 0.072, 0.26, 12),
                    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.05 })
                );
                this.minigunHeatGlow.rotation.x = Math.PI / 2; this.minigunHeatGlow.position.z = -0.18;
                this.minigunBarrelCluster.add(clamp, this.minigunHeatGlow);
                const accent = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.035, 0.28), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
                accent.position.set(0, 0.055, -0.04);
                g.add(body, drum, this.minigunBarrelCluster, accent);
            }

            // 3: polymer_beam ("ГЕЛИОС-П") — Polymer-Powered Disintegrator!
            {
                const g = makeWeaponGroup('polymer_beam');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.56), darkAlloy);
                // Twin glowing cyan-emerald polymer tubes along sides
                const tubeMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
                [-0.088, 0.088].forEach(tx => {
                    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 10), tubeMat);
                    tube.rotation.x = Math.PI / 2;
                    tube.position.set(tx, 0.02, -0.24);
                    g.add(tube);
                });
                const prongL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.36), gunSteel);
                const prongR = prongL.clone();
                prongL.position.set(-0.06, 0.02, -0.45);
                prongR.position.set( 0.06, 0.02, -0.45);
                this.polyCoreOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 1), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
                this.polyCoreOrb.position.set(0, 0.02, -0.62);
                this.polyRings = [];
                for (let i = 0; i < 2; i++) {
                    const pr = new THREE.Mesh(new THREE.TorusGeometry(0.082 - i * 0.014, 0.012, 8, 20), tubeMat);
                    pr.position.set(0, 0.02, -0.42 - i * 0.14);
                    g.add(pr);
                    this.polyRings.push(pr);
                }
                g.add(body, prongL, prongR, this.polyCoreOrb);
            }

            // 4: nova
            {
                const g = makeWeaponGroup('nova');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.54), darkAlloy);
                const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.018, 8, 18), gunSteel);
                r1.position.set(0, 0.02, -0.32);
                const r2 = r1.clone(); r2.position.set(0, 0.02, -0.5);
                this.chargeOrbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
                this.chargeOrbMesh.position.set(0, 0.02, -0.58);
                this.chargeFins = [];
                for (let i = 0; i < 3; i++) {
                    const ang = (i / 3) * Math.PI * 2;
                    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.07, 0.22), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
                    fin.position.set(Math.cos(ang) * 0.1, Math.sin(ang) * 0.1 + 0.02, -0.46);
                    fin.rotation.z = ang;
                    g.add(fin);
                    this.chargeFins.push({ mesh: fin, angle: ang });
                }
                g.add(body, r1, r2, this.chargeOrbMesh);
            }

            // 5: smg ("ШЕРШЕНЬ-VX")
            {
                const g = makeWeaponGroup('smg');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.125, 0.42), darkAlloy);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.28, 10), gunSteel);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.28);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.24, 0.065), gunSteel);
                mag.position.set(0, -0.15, -0.05); mag.rotation.x = -0.22;
                const glow = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.024, 0.28), new THREE.MeshBasicMaterial({ color: 0x86efac }));
                glow.position.set(0, 0.042, -0.06);
                g.add(body, barrel, mag, glow);
                this.weaponMags[5] = mag;
            }

            // 6: flamer
            {
                const g = makeWeaponGroup('flamer');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.52), darkAlloy);
                const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.36, 12), new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.55, roughness: 0.35 }));
                tank.rotation.x = Math.PI / 2; tank.position.set(0, -0.12, -0.08);
                this.weaponMags[6] = tank;
                const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.034, 0.4, 10), gunSteel);
                nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, 0.02, -0.42);
                this.flamerPilot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff6b2b }));
                this.flamerPilot.position.set(0, -0.01, -0.63);
                g.add(body, tank, nozzle, this.flamerPilot);
            }

            // 7: railgun
            {
                const g = makeWeaponGroup('railgun');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.58), darkAlloy);
                const railL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.054, 0.58), gunSteel);
                const railR = railL.clone();
                railL.position.set(-0.048, 0.03, -0.47);
                railR.position.set( 0.048, 0.03, -0.47);
                const core = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.56, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
                core.rotation.x = Math.PI / 2; core.position.set(0, 0.03, -0.45);
                this.railCaps = [];
                for (let i = 0; i < 3; i++) {
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
                    cap.position.set(0.072, 0.03, -0.18 - i * 0.09);
                    g.add(cap);
                    this.railCaps.push(cap);
                }
                g.add(body, railL, railR, core);
            }

            // 8: tesla
            {
                const g = makeWeaponGroup('tesla');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.5), darkAlloy);
                const tCoilMat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
                for (let i = 0; i < 3; i++) {
                    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.07 - i * 0.008, 0.014, 8, 16), tCoilMat);
                    coil.position.set(0, 0.02, -0.26 - i * 0.11);
                    g.add(coil);
                }
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), gunSteel);
                rod.rotation.x = Math.PI / 2; rod.position.set(0, 0.02, -0.39);
                this.teslaTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), tCoilMat);
                this.teslaTip.position.set(0, 0.02, -0.65);
                g.add(body, rod, this.teslaTip);
            }

            // 9: cryo_launcher ("МЕТЕЛЬ")
            {
                const g = makeWeaponGroup('cryo_launcher');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.44), darkAlloy);
                this.cryoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.65, roughness: 0.3 }));
                this.cryoDrum.rotation.x = Math.PI / 2; this.cryoDrum.position.set(0, 0.01, -0.16);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.38, 12), gunSteel);
                barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.42);
                const iceRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
                iceRing.position.set(0, 0.03, -0.59);
                g.add(body, this.cryoDrum, barrel, iceRing);
                this.weaponMags[9] = this.cryoDrum;
            }

            // 10: hydra ("ГИДРА-3")
            {
                const g = makeWeaponGroup('hydra');
                const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.56), darkAlloy);
                box.position.set(0, 0.02, -0.15);
                const trim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.44), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
                trim.position.set(0, 0.1, -0.15);
                g.add(box, trim);
                this.hydraPorts = [];
                [-0.068, 0, 0.068].forEach(px => {
                    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 10), new THREE.MeshBasicMaterial({ color: 0xfb7185 }));
                    port.rotation.x = Math.PI / 2;
                    port.position.set(px, 0.02, -0.44);
                    g.add(port);
                    this.hydraPorts.push(port);
                });
            }

            // 11: vulcan_gatling ("КРАФТОВЫЙ ГАТЛИНГ M6-БУРЯ")
            {
                const g = makeWeaponGroup('vulcan_gatling');
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.5), darkAlloy);
                body.position.set(0, -0.04, 0.02);
                const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.04), gunSteel);
                shieldPlate.position.set(0, 0.06, -0.2);
                const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 14), new THREE.MeshStandardMaterial({ color: 0x9a3412, metalness: 0.72, roughness: 0.3 }));
                drum.rotation.z = Math.PI / 2;
                drum.position.set(-0.14, -0.16, -0.04);
                this.weaponMags[11] = drum;

                this.vulcanBarrelCluster = new THREE.Group();
                this.vulcanBarrelCluster.position.set(0, -0.02, -0.5);
                const vbGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.78, 8);
                vbGeo.rotateX(Math.PI / 2);
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    const bar = new THREE.Mesh(vbGeo, gunSteel);
                    bar.position.set(Math.cos(ang) * 0.068, Math.sin(ang) * 0.068, 0);
                    this.vulcanBarrelCluster.add(bar);
                }
                const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 6, 16), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
                muzzleRing.position.z = -0.34;
                this.vulcanBarrelCluster.add(muzzleRing);
                const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.36), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
                topRail.position.set(0, 0.09, -0.05);
                g.add(body, shieldPlate, drum, this.vulcanBarrelCluster, topRail);
            }

            // Build Dynamic Visible 3D Attachment Sub-Meshes for EACH Weapon!
            const attAlloy = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.22 });
            const attGlow = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
            const attFire = new THREE.MeshBasicMaterial({ color: 0xf97316 });
            this.weaponMeshes.forEach((wg, idx) => {
                const barrelMod = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.19, 10), attAlloy);
                barrelMod.rotation.x = Math.PI / 2;
                barrelMod.position.set(0, 0.025, -0.68);
                barrelMod.visible = false;

                const magMod = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 10), attGlow);
                magMod.rotation.z = Math.PI / 2;
                magMod.position.set(0, -0.14, -0.12);
                magMod.visible = false;

                const opticMod = new THREE.Group();
                const frame = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.12), attAlloy);
                const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.042), opticMat);
                glass.position.y = 0.01;
                opticMod.add(frame, glass);
                opticMod.position.set(0, 0.12, -0.06);
                opticMod.visible = false;

                const coreMod = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.052, 0.2), attFire);
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
            const cuffMat = new THREE.MeshStandardMaterial({ color: 0x0f221b, metalness: 0.82, roughness: 0.25 });
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x264438, metalness: 0.72, roughness: 0.32 });
            this.gloveVeinsMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

            const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.076, 0.38, 10), cuffMat);
            forearm.rotation.x = Math.PI / 2.2;
            forearm.position.set(-0.03, -0.08, 0.18);
            this.gloveHolder.add(forearm);

            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.055, 0.14), plateMat);
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
            this.gloveHolder.add(this.gloveCore, this.gloveHoloRing);

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
                const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, f.len), plateMat);
                seg1.position.z = -f.len * 0.45;
                const tip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, f.len * 0.45), this.gloveVeinsMat);
                tip.position.z = -f.len * 0.95;
                pivot.add(seg1, tip);
                this.gloveHolder.add(pivot);
                this.gloveFingers.push(pivot);
            });
        }

        onWeaponSwitch(weaponIndex, equippedAttachments) {
            this.weaponMeshes.forEach((m, i) => {
                m.visible = (i === weaponIndex);
            });
            this.syncWeaponAttachments(weaponIdxSafe(weaponIndex), equippedAttachments);
            this.drawProgress = 0;

            function weaponIdxSafe(idx) { return Math.max(0, Math.min(idx, 11)); }
        }

        onWeaponFire(weaponIndex, weaponCfg, recoilMult = 1.0) {
            this.weaponRecoil = (weaponCfg.recoil || 0.08) * recoilMult;
            if (weaponCfg.id === 'minigun' || weaponCfg.id === 'vulcan_gatling') {
                this.minigunSpin = 38;
                this.minigunHeat = Math.min(1, this.minigunHeat + 0.045);
            }
            if (weaponCfg.id === 'shotgun') {
                this.shotgunPumpAnim = 1.0;
            }
            if (weaponCfg.id === 'cryo_launcher' && this.cryoDrum) {
                this.cryoDrum.rotation.z += Math.PI / 3;
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
                bobTime,
                slideTimer,
                wheelOpen,
                buildMode = false,
                polymerFireBuffTimer,
                timeStopTimer,
                timeSlowTimer
            } = state;

            const tNow = performance.now() * 0.005;

            this.drawProgress = Math.min(1, this.drawProgress + dt * 6.5);
            const drawDrop = (1 - this.drawProgress) * 0.25;
            this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 1.35);

            const effReloadDur = reloadDur || (curWeapon.reloadTime * (boostActive ? 0.62 : 1.0));
            const reloadProg = reloading ? 1 - (reloadTimer / Math.max(0.1, effReloadDur)) : 0;
            const reloadDip = reloading ? Math.sin(reloadProg * Math.PI) * 0.28 : 0;

            const curMag = this.weaponMags[weaponIndex];
            if (curMag) {
                const magDrop = reloading ? Math.sin(reloadProg * Math.PI) * 0.16 : 0;
                curMag.position.y = (curWeapon.id === 'minigun' || curWeapon.id === 'smg' ? -0.15 : (curWeapon.id === 'flamer' ? -0.12 : -0.13)) - magDrop;
            }

            this.weaponHolder.position.set(
                0.31 + Math.cos(bobTime * 0.5) * 0.016,
                -0.25 - reloadDip - drawDrop - (buildMode ? 0.14 : 0) + Math.abs(Math.sin(bobTime)) * 0.016 - (slideTimer > 0 ? 0.05 : 0),
                -0.52 + this.weaponRecoil
            );
            this.weaponHolder.rotation.x = this.weaponRecoil * 1.15 - reloadDip * 1.65 - drawDrop * 1.2 - (buildMode ? 0.45 : 0);
            this.weaponHolder.rotation.z = (slideTimer > 0 ? -0.22 : 0) + (reloading ? 0.28 : 0);

            if (this.rifleBolt && curWeapon.id === 'rifle') {
                this.rifleBolt.position.z = 0.02 + this.weaponRecoil * 1.2;
            }
            if (this.shotgunPumpAnim > 0) {
                this.shotgunPumpAnim = Math.max(0, this.shotgunPumpAnim - dt * 2.8);
                this.shotgunPump.position.z = -0.28 + Math.sin(this.shotgunPumpAnim * Math.PI) * 0.11;
            }
            if (this.minigunBarrelCluster || this.vulcanBarrelCluster) {
                if (this.minigunSpin > 0) {
                    if (this.minigunBarrelCluster) this.minigunBarrelCluster.rotation.z += this.minigunSpin * dt;
                    if (this.vulcanBarrelCluster) this.vulcanBarrelCluster.rotation.z += this.minigunSpin * 1.25 * dt;
                    this.minigunSpin = Math.max(0, this.minigunSpin - dt * 34);
                }
                this.minigunHeat = Math.max(0, this.minigunHeat - dt * 0.25);
                if (this.minigunHeatGlow) {
                    this.minigunHeatGlow.material.opacity = 0.05 + this.minigunHeat * 0.55;
                }
            }
            if (this.polyCoreOrb && curWeapon.id === 'polymer_beam') {
                const infScale = isCharging ? (1 + Math.min(7.5, Math.sqrt(Math.max(0, chargeSeconds)) * 2.6 + chargeRatio * 1.4)) : 1.0;
                this.polyCoreOrb.scale.setScalar(infScale);
                this.polyCoreOrb.rotation.y += dt * (isCharging ? (10 + chargeSeconds * 4) : 2.5);
                this.polyCoreOrb.material.color.setHex(chargeSeconds > 3.0 ? 0xfacc15 : (chargeSeconds > 1.2 ? 0x67e8f9 : 0x34d399));
                this.polyRings.forEach((pr, idx) => {
                    pr.rotation.z += dt * (isCharging ? (10 + Math.min(30, chargeSeconds * 8)) : 2.0) * (idx === 0 ? 1 : -1);
                });
            }
            if (this.flamerPilot) {
                this.flamerPilot.scale.setScalar(0.85 + Math.sin(tNow * 6) * 0.25);
            }
            if (this.chargeOrbMesh && isCharging && curWeapon.id === 'nova') {
                this.chargeOrbMesh.scale.setScalar(1 + chargeRatio * 3.1);
                this.chargeFins.forEach(f => {
                    const spread = 0.1 + chargeRatio * 0.09;
                    f.mesh.position.x = Math.cos(f.angle + tNow * 0.8) * spread;
                    f.mesh.position.y = Math.sin(f.angle + tNow * 0.8) * spread + 0.02;
                    f.mesh.rotation.z = f.angle + tNow * 0.8;
                });
            }
            if (this.teslaTip) {
                this.teslaTip.rotation.y += dt * 4.2;
                this.teslaTip.rotation.x += dt * 2.6;
            }
            if (this.railCaps.length > 0 && curWeapon.id === 'railgun') {
                this.railCaps.forEach((cap, idx) => {
                    cap.material.color.setHex((Math.floor(tNow * 2 + idx) % 3 === 0) ? 0x4ade80 : 0x38bdf8);
                });
            }

            if (this.muzzleLight.intensity > 0) {
                this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 34);
                if (this.muzzleLight.intensity < 1.2) this.muzzleFlash.visible = false;
            }

            // Left-Hand Polymer Glove animation
            this.gloveCore.rotation.y += dt * (wheelOpen || buildMode ? 6.0 : 2.2);
            this.gloveHoloRing.rotation.z -= dt * (wheelOpen || buildMode ? 5.0 : 1.8);

            const targetWheelPose = (wheelOpen || buildMode) ? 1 : 0;
            this.glovePoseOpen += (targetWheelPose - this.glovePoseOpen) * Math.min(1, dt * 14);

            let castThrustZ = 0, castLiftY = 0, castRoll = 0;
            let fingerCurl = -0.35;

            if (this.gloveCastTimer > 0) {
                this.gloveCastTimer = Math.max(0, this.gloveCastTimer - dt);
                const bell = Math.sin((this.gloveCastTimer / 0.55) * Math.PI);
                if (this.gloveCastPower === 'timestop' || this.gloveCastPower === 'timeslow') {
                    castThrustZ = -0.18 * bell;
                    castLiftY = 0.14 * bell;
                    castRoll = 0.65 * bell;
                    fingerCurl = -1.25 * bell;
                } else if (this.gloveCastPower === 'knockback') {
                    castThrustZ = -0.32 * bell;
                    castLiftY = 0.1 * bell;
                    fingerCurl = 0.45 * bell;
                } else {
                    castThrustZ = -0.26 * bell;
                    castLiftY = 0.1 * bell;
                    fingerCurl = 0.28 * bell;
                }
            } else if (wheelOpen) {
                fingerCurl = 0.28;
            }

            this.gloveFingers.forEach((f, idx) => {
                const targetX = fingerCurl + Math.sin(tNow * 0.7 + idx * 0.6) * 0.06;
                f.rotation.x += (targetX - f.rotation.x) * Math.min(1, dt * 16);
            });

            this.gloveHolder.position.set(
                -0.31 + this.glovePoseOpen * 0.1 - Math.cos(bobTime * 0.5) * 0.014,
                -0.21 + this.glovePoseOpen * 0.08 + castLiftY + Math.abs(Math.sin(bobTime)) * 0.014 - (slideTimer > 0 ? 0.04 : 0),
                -0.46 + castThrustZ - this.glovePoseOpen * 0.05
            );
            this.gloveHolder.rotation.set(
                this.glovePoseOpen * 0.34 + (polymerFireBuffTimer > 0 ? Math.sin(tNow * 4) * 0.04 : 0),
                0.14 + this.glovePoseOpen * 0.22,
                castRoll - this.glovePoseOpen * 0.22
            );

            this.gloveLight.intensity = 0.5 + (this.gloveCastTimer > 0 ? 2.4 : 0) + (timeStopTimer > 0 || timeSlowTimer > 0 ? 0.9 : 0);
        }
    }

    XB.ViewModelRig = ViewModelRig;
})(window);
