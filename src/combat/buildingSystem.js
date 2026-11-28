/**
 * Tactical Construction & Allied Defense System (Fortnite / Rust inspired):
 *  - Grid-snapped Building Mode [C]: Tactical Walls, Embrasure Window Walls, Walkable Ramps,
 *    Pure-Polymer Sentry Turrets, and Heavy 6-Barrel Gatling Defense Emplacements.
 *  - 4 Wall Attachments [U]: Armor Plate (MVK), Electric Shock Spikes, Polymer Holo-Shield, Wall-Mounted Gatling.
 *  - Allied Turrets AI with exact Line-of-Sight checks and rotating 3D barrels.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class BuildingSystem {
        constructor(scene, camera, mapBuilder, enemySystem, soundEngine) {
            this.scene = scene;
            this.camera = camera;
            this.map = mapBuilder;
            this.enemies = enemySystem;
            this.sound = soundEngine;

            this.buildMode = false;
            this.selectedBlueprintIdx = 0;
            this.buildRotation = 0; // 0..3 (x 90 deg)
            this.selectedAttachmentId = 'armor_plate';

            this.unlockedWallAttachments = new Set(['armor_plate', 'shock_spikes']);
            this.wallHpLvl = 1;
            this.maxTurrets = 4;

            this.structures = [];
            this.turrets = [];
            this.hoveredStructure = null;

            this.previewValid = false;
            this.previewPos = new THREE.Vector3();
            this.previewGroup = new THREE.Group();
            this.previewMesh = null;
            this.previewMat = new THREE.MeshBasicMaterial({
                color: 0x4ade80,
                wireframe: true,
                transparent: true,
                opacity: 0.72
            });
            this.previewFillMat = new THREE.MeshBasicMaterial({
                color: 0x4ade80,
                transparent: true,
                opacity: 0.22,
                depthWrite: false
            });
            this.previewGroup.visible = false;
            this.scene.add(this.previewGroup);

            this._forward = new THREE.Vector3();
            this._rebuildPreviewMesh();
        }

        reset() {
            this.buildMode = false;
            this.selectedBlueprintIdx = 0;
            this.buildRotation = 0;
            this.selectedAttachmentId = 'armor_plate';
            this.unlockedWallAttachments = new Set(['armor_plate', 'shock_spikes']);
            this.wallHpLvl = 1;
            this.maxTurrets = 4;

            for (const s of this.structures) {
                this.scene.remove(s.group);
            }
            this.structures = [];

            for (const t of this.turrets) {
                this.scene.remove(t.group);
            }
            this.turrets = [];
            this.hoveredStructure = null;
            this.previewGroup.visible = false;
            this.map.clearDynamicStructures();
            this._rebuildPreviewMesh();
        }

        toggleBuildMode(forceState) {
            this.buildMode = (forceState !== undefined) ? Boolean(forceState) : !this.buildMode;
            this.previewGroup.visible = this.buildMode;
            if (this.buildMode) {
                this._rebuildPreviewMesh();
            }
            return this.buildMode;
        }

        selectBlueprint(idx) {
            if (idx < 0 || idx >= XB.BUILD_BLUEPRINTS.length) return;
            this.selectedBlueprintIdx = idx;
            this._rebuildPreviewMesh();
        }

        rotateBlueprint() {
            this.buildRotation = (this.buildRotation + 1) % 4;
            this.sound.playWheelTick();
        }

        cycleWallAttachment() {
            const unlockedList = XB.WALL_ATTACHMENTS.filter(a => this.unlockedWallAttachments.has(a.id));
            if (unlockedList.length === 0) return null;
            const curIdx = unlockedList.findIndex(a => a.id === this.selectedAttachmentId);
            const next = unlockedList[(curIdx + 1) % unlockedList.length];
            this.selectedAttachmentId = next.id;
            this.sound.playWheelTick();
            return next;
        }

        _rebuildPreviewMesh() {
            while (this.previewGroup.children.length > 0) {
                const c = this.previewGroup.children[0];
                this.previewGroup.remove(c);
                if (c.geometry) c.geometry.dispose();
            }
            const bp = XB.BUILD_BLUEPRINTS[this.selectedBlueprintIdx];
            if (!bp) return;

            let geo;
            if (bp.id === 'ramp' || bp.id === 'stairs_steep') {
                geo = new THREE.BoxGeometry(bp.width, 0.36, Math.hypot(bp.depth, bp.height));
                const m1 = new THREE.Mesh(geo, this.previewMat);
                const m2 = new THREE.Mesh(geo, this.previewFillMat);
                const slopeAng = Math.atan2(bp.height, bp.depth);
                m1.rotation.x = slopeAng;
                m2.rotation.x = slopeAng;
                m1.position.y = bp.height * 0.5;
                m2.position.y = bp.height * 0.5;
                this.previewGroup.add(m1, m2);
                return;
            }
            if (bp.id === 'hedgehog') {
                for (let s = -1; s <= 1; s += 2) {
                    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.35, 0.28), this.previewMat);
                    bar.position.y = 1.05;
                    bar.rotation.z = s * 0.65;
                    bar.rotation.x = s * 0.35;
                    this.previewGroup.add(bar);
                }
                return;
            }
            if (bp.id === 'bunker_post') {
                // U-shaped Armored Bunker with Front Embrasure + Protective Roof (open at +Z rear!)
                const frontLower = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 1.25, 0.8), this.previewFillMat);
                frontLower.position.set(0, 0.625, -bp.depth / 2 + 0.4);
                const roof = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 0.45, bp.depth), this.previewMat);
                roof.position.set(0, bp.height - 0.22, 0);
                const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.75, bp.height, bp.depth), this.previewFillMat);
                sideL.position.set(-bp.width / 2 + 0.38, bp.height / 2, 0);
                const sideR = sideL.clone();
                sideR.position.x = bp.width / 2 - 0.38;
                this.previewGroup.add(frontLower, roof, sideL, sideR);
                return;
            }
            if (bp.isTurret) {
                geo = new THREE.CylinderGeometry(0.65, 0.95, 1.85, 10);
                const m1 = new THREE.Mesh(geo, this.previewMat);
                const m2 = new THREE.Mesh(geo, this.previewFillMat);
                m1.position.y = 0.95;
                m2.position.y = 0.95;
                this.previewGroup.add(m1, m2);
                return;
            }

            geo = new THREE.BoxGeometry(bp.width, bp.height, bp.depth);
            const m1 = new THREE.Mesh(geo, this.previewMat);
            const m2 = new THREE.Mesh(geo, this.previewFillMat);
            m1.position.y = bp.height / 2;
            m2.position.y = bp.height / 2;
            this.previewGroup.add(m1, m2);
        }

        _computePlacementPose(playerPos) {
            this.camera.getWorldDirection(this._forward);
            const flatFwd = new THREE.Vector3(this._forward.x, 0, this._forward.z);
            if (flatFwd.lengthSq() < 0.001) flatFwd.set(0, 0, -1);
            flatFwd.normalize();

            const bp = XB.BUILD_BLUEPRINTS[this.selectedBlueprintIdx] || XB.BUILD_BLUEPRINTS[0];
            let dist = Math.max(2.6, Math.min(9.5, 6.2 - this._forward.y * 2.5));

            // Ray-check obstacles so aiming toward ANY arena wall or bunker snaps cleanly IN FRONT of the wall instead of clipping past bounds!
            const probeStartY = playerPos.y + 1.5;
            const obsHit = this.map.segmentHitsObstacle(
                playerPos.x, probeStartY, playerPos.z,
                playerPos.x + flatFwd.x * dist, probeStartY, playerPos.z + flatFwd.z * dist,
                { expand: 0 }
            );
            if (obsHit.hit && obsHit.point) {
                const hitDist = Math.hypot(obsHit.point.x - playerPos.x, obsHit.point.z - playerPos.z);
                const wallOffset = bp.isTurret ? 0.95 : ((bp.depth || 1.0) * 0.52 + 0.35);
                if (this._forward.y <= 0.16) {
                    dist = Math.max(1.25, hitDist - wallOffset);
                }
            }

            const rawX = playerPos.x + flatFwd.x * dist;
            const rawZ = playerPos.z + flatFwd.z * dist;

            const snapSize = bp.isTurret ? 1.5 : 2.25;
            const limitMargin = bp.isTurret ? 0.8 : 0.65;
            const maxCoordX = this.map.ARENA_LIMIT_X - limitMargin;
            const maxCoordZ = this.map.ARENA_LIMIT_Z - limitMargin;
            let sx = Math.round(rawX / snapSize) * snapSize;
            let sz = Math.round(rawZ / snapSize) * snapSize;
            sx = Math.max(-maxCoordX, Math.min(maxCoordX, sx));
            sz = Math.max(-maxCoordZ, Math.min(maxCoordZ, sz));

            const playerYawCard = Math.round(-Math.atan2(flatFwd.x, -flatFwd.z) / (Math.PI / 2));
            const rotIdx = ((playerYawCard + this.buildRotation) % 4 + 4) % 4;
            const rotY = rotIdx * (Math.PI / 2);

            // Stack on elevated floor, ramp, or wall top smoothly (plus roof overhead elevation!)
            const probeY = playerPos.y + Math.max(0.2, this._forward.y * 4.0 + 0.6);
            let sy = this.map.getFloorHeightAt(sx, sz, probeY + 0.6);
            if (!bp.isTurret && (this._forward.y > 0.18 || bp.isFloorOrRoof)) {
                for (const st of this.structures) {
                    if (st.type !== 'ramp' && st.type !== 'stairs_steep' && Math.hypot(st.x - sx, st.z - sz) < 3.6) {
                        if (this._forward.y > 0.18 || bp.defaultElevate) {
                            sy = Math.max(sy, st.y + st.height);
                        }
                    }
                }
            }
            if (bp.defaultElevate && sy < playerPos.y + bp.defaultElevate - 0.5) {
                sy = playerPos.y + bp.defaultElevate;
            }
            if (sy > 8.6) sy = 8.4;

            return { x: sx, y: sy, z: sz, rotIdx, rotY };
        }

        _findHoveredStructure(playerPos, playerEyeH) {
            const origin = new THREE.Vector3(playerPos.x, playerPos.y + playerEyeH, playerPos.z);
            this.camera.getWorldDirection(this._forward);
            let best = null;
            let bestDist = 11.5;

            for (const st of this.structures) {
                const center = new THREE.Vector3(st.x, st.y + 1.5, st.z);
                const toC = center.sub(origin);
                const d = toC.length();
                if (d > bestDist || d < 0.8) continue;
                const dot = toC.normalize().dot(this._forward);
                if (dot > 0.84) {
                    bestDist = d;
                    best = st;
                }
            }
            return best;
        }

        updatePreviewAndHovered(playerPos, playerEyeH, gameCtx) {
            this.hoveredStructure = this._findHoveredStructure(playerPos, playerEyeH);

            if (!this.buildMode) {
                this.previewGroup.visible = false;
                return;
            }

            const bp = XB.BUILD_BLUEPRINTS[this.selectedBlueprintIdx];
            const pose = this._computePlacementPose(playerPos);
            this.previewPos.set(pose.x, pose.y, pose.z);
            this.previewGroup.position.copy(this.previewPos);
            this.previewGroup.rotation.y = pose.rotY;
            this.previewGroup.visible = true;

            const insideBounds = Math.abs(pose.x) <= this.map.ARENA_LIMIT_X - 0.5 && Math.abs(pose.z) <= this.map.ARENA_LIMIT_Z - 0.5;
            const minPlayerDist = bp.isFloorOrRoof ? 0.0 : (bp.isTurret ? 1.1 : 1.0);
            const farFromPlayer = Math.hypot(pose.x - playerPos.x, pose.z - playerPos.z) >= minPlayerDist;
            const canAfford = gameCtx.coins >= bp.costCoins && gameCtx.combat.polymerEnergy >= bp.costPoly;
            const turretRoom = !bp.isTurret || this.turrets.length < this.maxTurrets;

            this.previewValid = insideBounds && farFromPlayer && canAfford && turretRoom;
            const c = this.previewValid ? (bp.color || 0x4ade80) : 0xf43f5e;
            this.previewMat.color.setHex(c);
            this.previewFillMat.color.setHex(c);
        }

        tryPlaceCurrentBlueprint(playerPos, gameCtx) {
            const bp = XB.BUILD_BLUEPRINTS[this.selectedBlueprintIdx];
            if (!bp) return false;

            const pose = this._computePlacementPose(playerPos);
            if (Math.abs(pose.x) > this.map.ARENA_LIMIT_X - 0.45 || Math.abs(pose.z) > this.map.ARENA_LIMIT_Z - 0.45) {
                gameCtx.showToast('НЕЛЬЗЯ СТРОИТЬ ЗА ГРАНИЦЕЙ АРЕНЫ!', '#fb7185');
                return false;
            }
            const minPlayerDist = bp.isFloorOrRoof ? 0.0 : (bp.isTurret ? 1.1 : 1.0);
            if (Math.hypot(pose.x - playerPos.x, pose.z - playerPos.z) < minPlayerDist) {
                gameCtx.showToast('ОТОЙДИТЕ ЧУТЬ ДАЛЬШЕ ДЛЯ ПОСТРОЙКИ!', '#fb7185');
                return false;
            }
            if (gameCtx.coins < bp.costCoins) {
                gameCtx.showToast(`НУЖНО ${bp.costCoins} МОНЕТ!`, '#f59e0b');
                return false;
            }
            if (gameCtx.combat.polymerEnergy < bp.costPoly) {
                gameCtx.showToast(`НУЖНО ${bp.costPoly} ПОЛИМЕРА!`, '#f59e0b');
                return false;
            }
            if (bp.isTurret && this.turrets.length >= this.maxTurrets) {
                gameCtx.showToast(`ЛИМИТ ТУРЕЛЕЙ: ${this.maxTurrets} (РАСШИРЬТЕ В МАГАЗИНЕ)`, '#fb7185');
                return false;
            }

            gameCtx.spendResources(bp.costCoins, bp.costPoly);
            this.sound.playBuildPlace();

            if (bp.isTurret) {
                const kind = bp.id === 'gatling_turret' ? 'gatling' : 'polymer';
                const dur = bp.permanent ? Infinity : bp.duration;
                this.spawnTurret(kind, pose.x, pose.y, pose.z, dur, gameCtx, null, Boolean(bp.permanent));
                gameCtx.showToast(`СОЗДАНО${bp.permanent ? ' (ПОСТОЯННО)' : ''}: ${bp.shortName}`, bp.id === 'gatling_turret' ? '#f97316' : '#4ade80');
                return true;
            }

            this._buildFortStructure(bp, pose.x, pose.y, pose.z, pose.rotIdx, pose.rotY);
            gameCtx.showToast(`ПОСТРОЕНО ПОСТОЯННО: ${bp.shortName}`, '#4ade80');
            return true;
        }

        /**
         * Restores full HP to all permanent Coin-crafted fortifications & Gatling turrets after every wave!
         */
        repairAllPermanentStructures() {
            let repaired = 0;
            for (const st of this.structures) {
                if (st.hp < st.maxHp) {
                    st.hp = st.maxHp;
                    repaired++;
                }
            }
            for (const t of this.turrets) {
                if (t.permanent && t.hp < t.maxHp) {
                    t.hp = t.maxHp;
                    repaired++;
                }
            }
            return repaired;
        }

        _buildFortStructure(bp, x, y, z, rotIdx, rotY) {
            const group = new THREE.Group();
            group.position.set(x, y, z);
            group.rotation.y = rotY;

            const baseMat = new THREE.MeshStandardMaterial({ color: 0x162b22, metalness: 0.72, roughness: 0.35 });
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b1712, metalness: 0.85, roughness: 0.25 });
            const trimMat = new THREE.MeshBasicMaterial({ color: bp.color });

            const hpBonus = 1 + (this.wallHpLvl - 1) * 0.22;
            const maxHp = Math.round(bp.hp * hpBonus);
            const structObj = {
                id: `st_${Date.now()}_${Math.random()}`,
                type: bp.id,
                x,
                y,
                z,
                rotIdx,
                rotY,
                height: bp.height,
                hp: maxHp,
                maxHp,
                group,
                baseMat,
                attachments: new Set(),
                boxes: [],
                rampRef: null,
                coverMeshes: [],
                mountedTurret: null,
                isSpikeTrap: Boolean(bp.isSpikeTrap)
            };

            const rotated90 = (rotIdx % 2 === 1);
            const worldW = rotated90 ? bp.depth : bp.width;
            const worldD = rotated90 ? bp.width : bp.depth;

            if (bp.id === 'ramp' || bp.id === 'stairs_steep') {
                const slopeLen = Math.hypot(bp.depth, bp.height);
                const slopeAngle = Math.atan2(bp.height, bp.depth);
                const deck = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 0.34, slopeLen), baseMat);
                deck.position.set(0, bp.height / 2, 0);
                deck.rotation.x = slopeAngle;
                deck.castShadow = true;
                deck.receiveShadow = true;
                deck.userData.isCover = true;
                deck.userData.craftedStructure = structObj;

                const railL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, slopeLen), trimMat);
                railL.position.set(-bp.width / 2 + 0.14, bp.height / 2 + 0.16, 0);
                railL.rotation.x = slopeAngle;
                const railR = railL.clone();
                railR.position.x = bp.width / 2 - 0.14;

                const supportL = new THREE.Mesh(new THREE.BoxGeometry(0.28, bp.height, 0.35), frameMat);
                supportL.position.set(-bp.width / 2 + 0.2, bp.height / 2, -bp.depth / 2 + 0.25);
                const supportR = supportL.clone();
                supportR.position.x = bp.width / 2 - 0.2;

                group.add(deck, railL, railR, supportL, supportR);

                if (bp.id === 'stairs_steep') {
                    // Add crisp visible stepped steel stair treads!
                    const steps = 8;
                    for (let st = 0; st < steps; st++) {
                        const t = (st + 0.5) / steps;
                        const tread = new THREE.Mesh(new THREE.BoxGeometry(bp.width - 0.35, 0.16, bp.depth / steps), frameMat);
                        tread.position.set(0, t * bp.height, (0.5 - t) * bp.depth);
                        group.add(tread);
                    }
                }
                this.scene.add(group);

                this.map.dynamicCoverMeshes.push(deck, supportL, supportR);
                structObj.coverMeshes.push(deck, supportL, supportR);

                let dir = 'N';
                if (rotIdx === 0) dir = 'N';
                else if (rotIdx === 1) dir = 'W';
                else if (rotIdx === 2) dir = 'S';
                else dir = 'E';

                const rxW = (dir === 'E' || dir === 'W') ? bp.depth : bp.width;
                const rzD = (dir === 'E' || dir === 'W') ? bp.width : bp.depth;
                const rampData = {
                    minX: x - rxW / 2,
                    maxX: x + rxW / 2,
                    minZ: z - rzD / 2,
                    maxZ: z + rzD / 2,
                    yBase: y,
                    axis: (dir === 'N' || dir === 'S') ? 'z' : 'x',
                    yAtMin: (dir === 'N' || dir === 'W') ? (y + bp.height) : y,
                    yAtMax: (dir === 'N' || dir === 'W') ? y : (y + bp.height),
                    structureRef: structObj
                };
                this.map.dynamicRamps.push(rampData);
                structObj.rampRef = rampData;
                this.structures.push(structObj);
                return;
            }

            if (bp.id === 'floor_deck' || bp.id === 'roof_cap') {
                const slab = new THREE.Mesh(new THREE.BoxGeometry(bp.width, bp.height, bp.depth), baseMat);
                slab.position.y = bp.height / 2;
                slab.castShadow = true;
                slab.receiveShadow = true;
                slab.userData.isCover = true;
                slab.userData.craftedStructure = structObj;

                const rim = new THREE.Mesh(new THREE.BoxGeometry(bp.width + 0.08, 0.1, bp.depth + 0.08), trimMat);
                rim.position.y = bp.height * 0.5;
                group.add(slab, rim);

                // Diagonal steel support struts on edges
                [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
                    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), frameMat);
                    brace.position.set(sx * (bp.width / 2 - 0.22), 0.05, sz * (bp.depth / 2 - 0.22));
                    group.add(brace);
                });

                this.map.dynamicCoverMeshes.push(slab);
                structObj.coverMeshes.push(slab);

                const box = {
                    minX: x - worldW / 2,
                    maxX: x + worldW / 2,
                    minY: y,
                    maxY: y + bp.height,
                    minZ: z - worldD / 2,
                    maxZ: z + worldD / 2,
                    jumpable: true,
                    navSolid: (y < 1.5 && bp.id === 'floor_deck' && bp.height > 1.0), // Walkable above & passable underneath roofs!
                    structureRef: structObj
                };
                this.map.dynamicBoxes.push(box);
                structObj.boxes.push(box);
                this.scene.add(group);
                this.structures.push(structObj);
                this.map.refreshNavWithDynamics();
                return;
            }

            if (bp.id === 'hedgehog') {
                // Iconic Czech Anti-Tank X-Hedgehog with Glowing Electric Razor Coils!
                const beamGeo = new THREE.BoxGeometry(0.28, 2.75, 0.28);
                [
                    { rx: 0.62, rz: 0.62 },
                    { rx: -0.62, rz: 0.62 },
                    { rx: 0, rz: -0.78 }
                ].forEach(ang => {
                    const b = new THREE.Mesh(beamGeo, frameMat);
                    b.position.y = 1.05;
                    b.rotation.set(ang.rx, 0, ang.rz);
                    b.castShadow = true;
                    b.userData.isCover = true;
                    b.userData.craftedStructure = structObj;
                    group.add(b);
                    this.map.dynamicCoverMeshes.push(b);
                    structObj.coverMeshes.push(b);
                });
                const shockRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 16), trimMat);
                shockRing.rotation.x = Math.PI / 2;
                shockRing.position.y = 1.05;
                group.add(shockRing);

                const box = {
                    minX: x - worldW / 2,
                    maxX: x + worldW / 2,
                    minY: y,
                    maxY: y + bp.height,
                    minZ: z - worldD / 2,
                    maxZ: z + worldD / 2,
                    jumpable: true,
                    navSolid: true,
                    structureRef: structObj
                };
                this.map.dynamicBoxes.push(box);
                structObj.boxes.push(box);
                this.scene.add(group);
                this.structures.push(structObj);
                this.map.refreshNavWithDynamics();
                return;
            }

            if (bp.id === 'laser_gate') {
                // Passable Laser Barrier Gate: Players walk & shoot freely through, while blocking & damaging robots!
                const postL = new THREE.Mesh(new THREE.BoxGeometry(0.45, bp.height, bp.depth + 0.15), frameMat);
                postL.position.set(-bp.width / 2 + 0.22, bp.height / 2, 0);
                const postR = postL.clone();
                postR.position.x = bp.width / 2 - 0.22;
                const topHeader = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 0.45, bp.depth), frameMat);
                topHeader.position.y = bp.height - 0.22;
                group.add(postL, postR, topHeader);

                const laserMat = new THREE.MeshBasicMaterial({ color: bp.color, transparent: true, opacity: 0.48 });
                for (let lx = -1.6; lx <= 1.6; lx += 0.8) {
                    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, bp.height - 0.5, 8), laserMat);
                    bar.position.set(lx, bp.height / 2 - 0.1, 0);
                    group.add(bar);
                }
                const curtain = new THREE.Mesh(new THREE.PlaneGeometry(bp.width - 0.8, bp.height - 0.5), new THREE.MeshBasicMaterial({ color: bp.color, transparent: true, opacity: 0.16, side: 2 }));
                curtain.position.y = bp.height / 2 - 0.1;
                group.add(curtain);

                [postL, postR, topHeader].forEach(m => {
                    m.castShadow = true;
                    m.userData.isCover = true;
                    m.userData.craftedStructure = structObj;
                    this.map.dynamicCoverMeshes.push(m);
                    structObj.coverMeshes.push(m);
                });

                const box = {
                    minX: x - worldW / 2,
                    maxX: x + worldW / 2,
                    minY: y,
                    maxY: y + bp.height,
                    minZ: z - worldD / 2,
                    maxZ: z + worldD / 2,
                    jumpable: false,
                    navSolid: true,
                    playerPassable: true,
                    structureRef: structObj
                };
                this.map.dynamicBoxes.push(box);
                structObj.boxes.push(box);
                this.scene.add(group);
                this.structures.push(structObj);
                this.map.refreshNavWithDynamics();
                return;
            }

            if (bp.id === 'window_wall') {
                // Lower wall (0..1.35m), Left & Right pillars (1.35..2.35m), Top lintel (2.35..3.4m) — REAL open shooting window!
                const lower = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 1.35, bp.depth), baseMat);
                lower.position.y = 0.675;
                const leftP = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, bp.depth), frameMat);
                leftP.position.set(-bp.width / 2 + 0.5, 2.375, 0);
                const rightP = leftP.clone();
                rightP.position.x = bp.width / 2 - 0.5;
                const topBeam = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 0.9, bp.depth), baseMat);
                topBeam.position.y = 2.95;
                const strip = new THREE.Mesh(new THREE.BoxGeometry(bp.width + 0.08, 0.14, bp.depth + 0.08), trimMat);
                strip.position.y = 1.36;

                group.add(lower, leftP, rightP, topBeam, strip);
                [lower, leftP, rightP, topBeam].forEach(m => {
                    m.castShadow = true;
                    m.receiveShadow = true;
                    m.userData.isCover = true;
                    m.userData.craftedStructure = structObj;
                    this.map.dynamicCoverMeshes.push(m);
                    structObj.coverMeshes.push(m);
                });

                const makeSubBox = (lx, lyCenter, lz, lw, lh, ld, navSolid, jumpable = false) => {
                    const cosR = Math.round(Math.cos(rotY));
                    const sinR = Math.round(Math.sin(rotY));
                    const wx = lx * cosR + lz * sinR;
                    const wz = -lx * sinR + lz * cosR;
                    const bw = rotated90 ? ld : lw;
                    const bd = rotated90 ? lw : ld;
                    const box = {
                        minX: x + wx - bw / 2,
                        maxX: x + wx + bw / 2,
                        minY: y + lyCenter - lh / 2,
                        maxY: y + lyCenter + lh / 2,
                        minZ: z + wz - bd / 2,
                        maxZ: z + wz + bd / 2,
                        jumpable,
                        navSolid,
                        structureRef: structObj
                    };
                    this.map.dynamicBoxes.push(box);
                    structObj.boxes.push(box);
                };

                makeSubBox(0, 0.675, 0, bp.width, 1.35, bp.depth, true);
                makeSubBox(-bp.width / 2 + 0.5, 2.375, 0, 1.0, 2.05, bp.depth, true);
                makeSubBox(bp.width / 2 - 0.5, 2.375, 0, 1.0, 2.05, bp.depth, true);
                makeSubBox(0, 2.95, 0, bp.width, 0.9, bp.depth, false);
            } else if (bp.id === 'bunker_post') {
                // Full Walk-In Permanent Bunker Installation ("БРОНЕ-ПОСТ ДОТ")!
                // Front lower armor shield (0..1.28m) lets standing players shoot & crouch [Ctrl] cleanly behind cover!
                const wallT = 0.72;
                const frontZ = -bp.depth / 2 + wallT / 2;
                const fLow = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 1.28, wallT), baseMat);
                fLow.position.set(0, 0.64, frontZ);
                const fTrim = new THREE.Mesh(new THREE.BoxGeometry(bp.width + 0.08, 0.14, wallT + 0.08), trimMat);
                fTrim.position.set(0, 1.28, frontZ);
                const fTop = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 0.88, wallT), frameMat);
                fTop.position.set(0, bp.height - 0.44, frontZ);

                const roof = new THREE.Mesh(new THREE.BoxGeometry(bp.width, 0.44, bp.depth), frameMat);
                roof.position.set(0, bp.height - 0.22, 0);

                const sideL = new THREE.Mesh(new THREE.BoxGeometry(wallT, bp.height, bp.depth), baseMat);
                sideL.position.set(-bp.width / 2 + wallT / 2, bp.height / 2, 0);
                const sideR = sideL.clone();
                sideR.position.x = bp.width / 2 - wallT / 2;

                // Rear doorframe pilasters (leaves generous 3.6m center back doorway open to walk/bhop in!)
                const rearZ = bp.depth / 2 - wallT / 2;
                const backL = new THREE.Mesh(new THREE.BoxGeometry(0.95, bp.height, wallT), frameMat);
                backL.position.set(-bp.width / 2 + 0.48, bp.height / 2, rearZ);
                const backR = backL.clone();
                backR.position.x = bp.width / 2 - 0.48;

                // Interior warm emerald tactical lamp bar under bunker roof
                const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.35), trimMat);
                lamp.position.set(0, bp.height - 0.48, 0);

                group.add(fLow, fTrim, fTop, roof, sideL, sideR, backL, backR, lamp);
                [fLow, fTop, roof, sideL, sideR, backL, backR].forEach(m => {
                    m.castShadow = true;
                    m.receiveShadow = true;
                    m.userData.isCover = true;
                    m.userData.craftedStructure = structObj;
                    this.map.dynamicCoverMeshes.push(m);
                    structObj.coverMeshes.push(m);
                });

                const makeLocalBox = (lx, lyCenter, lz, lw, lh, ld, navSolid, jumpable = false) => {
                    const cosR = Math.round(Math.cos(rotY));
                    const sinR = Math.round(Math.sin(rotY));
                    const wx = lx * cosR + lz * sinR;
                    const wz = -lx * sinR + lz * cosR;
                    const bw = rotated90 ? ld : lw;
                    const bd = rotated90 ? lw : ld;
                    const box = {
                        minX: x + wx - bw / 2,
                        maxX: x + wx + bw / 2,
                        minY: y + lyCenter - lh / 2,
                        maxY: y + lyCenter + lh / 2,
                        minZ: z + wz - bd / 2,
                        maxZ: z + wz + bd / 2,
                        jumpable,
                        navSolid,
                        structureRef: structObj
                    };
                    this.map.dynamicBoxes.push(box);
                    structObj.boxes.push(box);
                };

                // Front lower crouch-cover shield + upper lintel + roof + left/right flank walls + rear framing
                makeLocalBox(0, 0.64, frontZ, bp.width, 1.28, wallT, true, true);
                makeLocalBox(0, bp.height - 0.44, frontZ, bp.width, 0.88, wallT, false, false);
                makeLocalBox(0, bp.height - 0.22, 0, bp.width, 0.44, bp.depth, false, true);
                makeLocalBox(-bp.width / 2 + wallT / 2, bp.height / 2, 0, wallT, bp.height, bp.depth, true, false);
                makeLocalBox( bp.width / 2 - wallT / 2, bp.height / 2, 0, wallT, bp.height, bp.depth, true, false);
                makeLocalBox(-bp.width / 2 + 0.48, bp.height / 2, rearZ, 0.95, bp.height, wallT, true, false);
                makeLocalBox( bp.width / 2 - 0.48, bp.height / 2, rearZ, 0.95, bp.height, wallT, true, false);
            } else {
                // Solid Tactical Wall (stackable!)
                const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(bp.width, bp.height, bp.depth), baseMat);
                wallMesh.position.y = bp.height / 2;
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                wallMesh.userData.isCover = true;
                wallMesh.userData.craftedStructure = structObj;

                const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.45, bp.height + 0.1, bp.depth + 0.25), frameMat);
                pillarL.position.set(-bp.width / 2 + 0.22, bp.height / 2, 0);
                const pillarR = pillarL.clone();
                pillarR.position.x = bp.width / 2 - 0.22;
                const trim = new THREE.Mesh(new THREE.BoxGeometry(bp.width + 0.08, 0.16, bp.depth + 0.12), trimMat);
                trim.position.y = bp.height - 0.18;

                group.add(wallMesh, pillarL, pillarR, trim);
                [wallMesh, pillarL, pillarR].forEach(m => {
                    m.userData.isCover = true;
                    m.userData.craftedStructure = structObj;
                    this.map.dynamicCoverMeshes.push(m);
                    structObj.coverMeshes.push(m);
                });

                const box = {
                    minX: x - worldW / 2,
                    maxX: x + worldW / 2,
                    minY: y,
                    maxY: y + bp.height,
                    minZ: z - worldD / 2,
                    maxZ: z + worldD / 2,
                    jumpable: true,
                    navSolid: true,
                    structureRef: structObj
                };
                this.map.dynamicBoxes.push(box);
                structObj.boxes.push(box);
            }

            this.scene.add(group);
            this.structures.push(structObj);
            this.map.refreshNavWithDynamics();
        }

        /**
         * Rust-style Wall Attachment Application [U] when aiming at a player-built wall!
         */
        tryAttachModToHoveredWall(gameCtx) {
            const st = this.hoveredStructure;
            if (!st) {
                gameCtx.showToast('НАВЕДИТЕ ПРИЦЕЛ НА СВОЮ СТЕНУ ДЛЯ ОБВЕСА [U]', '#94a3b8');
                return false;
            }
            const attId = this.selectedAttachmentId;
            if (!this.unlockedWallAttachments.has(attId)) {
                gameCtx.showToast('ОТКРОЙТЕ ЭТОТ ОБВЕС В МАГАЗИНЕ [B]!', '#f59e0b');
                return false;
            }
            const cfg = XB.WALL_ATTACHMENTS.find(a => a.id === attId);
            if (!cfg) return false;
            if (st.attachments.has(attId)) {
                gameCtx.showToast(`НА ЭТОЙ СТЕНЕ УЖЕ ЕСТЬ: ${cfg.shortName}`, '#94a3b8');
                return false;
            }
            if (gameCtx.coins < cfg.applyCoins) {
                gameCtx.showToast(`НУЖНО ${cfg.applyCoins} МОНЕТ НА УСТАНОВКУ!`, '#f59e0b');
                return false;
            }

            gameCtx.spendResources(cfg.applyCoins, 0);
            st.attachments.add(attId);
            this.sound.playBuildUpgrade();

            if (attId === 'armor_plate') {
                st.maxHp += cfg.hpBonus;
                st.hp += cfg.hpBonus;
                st.baseMat.color.setHex(0x334155);
                const plate = new THREE.Mesh(
                    new THREE.BoxGeometry(4.75, 0.55, 1.05),
                    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 })
                );
                plate.position.y = st.height * 0.48;
                st.group.add(plate);
            } else if (attId === 'shock_spikes') {
                const spikeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
                for (let sx = -1.8; sx <= 1.8; sx += 0.72) {
                    [-0.52, 0.52].forEach(sz => {
                        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 5), spikeMat);
                        sp.rotation.x = sz < 0 ? -Math.PI / 2 : Math.PI / 2;
                        sp.position.set(sx, 0.95, sz);
                        st.group.add(sp);
                    });
                }
            } else if (attId === 'shield_screen') {
                const rotated90 = (st.rotIdx % 2 === 1);
                const w = 4.6, h = 2.0, d = 0.25;
                const shieldPane = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, d),
                    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.34 })
                );
                shieldPane.position.y = st.height + 1.0;
                shieldPane.userData.isFriendlyShield = true;
                st.group.add(shieldPane);

                const bw = rotated90 ? d : w;
                const bd = rotated90 ? w : d;
                const sBox = {
                    minX: st.x - bw / 2,
                    maxX: st.x + bw / 2,
                    minY: st.y + st.height,
                    maxY: st.y + st.height + h,
                    minZ: st.z - bd / 2,
                    maxZ: st.z + bd / 2,
                    jumpable: false,
                    navSolid: false,
                    isShieldScreen: true,
                    structureRef: st
                };
                this.map.dynamicBoxes.push(sBox);
                st.boxes.push(sBox);
            } else if (attId === 'wall_gatling') {
                const tObj = this.spawnTurret('gatling_mini', st.x, st.y + st.height, st.z, 9999, gameCtx);
                st.mountedTurret = tObj;
            }

            gameCtx.showToast(`УСТАНОВЛЕН ОБВЕС: ${cfg.name}`, cfg.color);
            return true;
        }

        damageStructure(struct, damage, attacker, combatCtx) {
            if (!struct || struct.hp <= 0) return false;
            struct.hp -= damage;

            if (attacker && (struct.attachments.has('shock_spikes') || struct.isSpikeTrap)) {
                attacker.shockTimer = Math.max(attacker.shockTimer, 1.8);
                const hitPt = attacker.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
                const spikeDmg = struct.attachments.has('shock_spikes') ? 42 : 32;
                if (typeof combatCtx.onDamageAlien === 'function') {
                    combatCtx.onDamageAlien(attacker, spikeDmg, hitPt, 0x38bdf8, false);
                } else if (combatCtx.combat && typeof combatCtx.combat.damageAlien === 'function') {
                    combatCtx.combat.damageAlien(attacker, spikeDmg, hitPt, 0x38bdf8, false, 1.75, combatCtx);
                }
            }

            if (struct.hp <= 0) {
                this._destroyStructure(struct);
                return true;
            }
            return false;
        }

        damageTurret(turret, damage, attacker, combatCtx) {
            if (!turret || turret.hp <= 0) return false;
            turret.hp -= damage;
            if (turret.hpFill && turret.maxHp > 0) {
                const ratio = Math.max(0.02, turret.hp / turret.maxHp);
                turret.hpFill.scale.set(ratio, 1, 1);
                turret.hpFill.material.color.setHex(ratio < 0.4 ? 0xf43f5e : (turret.isGatling ? 0xf97316 : 0x4ade80));
            }
            if (combatCtx && combatCtx.spawnParticles) {
                combatCtx.spawnParticles(new THREE.Vector3(turret.x, turret.y + 1.25, turret.z), 0xfacc15, 4, 5);
            }
            if (turret.hp <= 0) {
                if (combatCtx && combatCtx.spawnParticles) {
                    combatCtx.spawnParticles(new THREE.Vector3(turret.x, turret.y + 1.1, turret.z), turret.color, 18, 10);
                }
                if (combatCtx && combatCtx.spawnShockwave) {
                    combatCtx.spawnShockwave(new THREE.Vector3(turret.x, turret.y + 1.0, turret.z), 4.5, turret.color, 0.3);
                }
                this.sound.playExplosion();
                if (turret.box) {
                    this.map.dynamicBoxes = this.map.dynamicBoxes.filter(b => b !== turret.box);
                }
                const ti = this.turrets.indexOf(turret);
                if (ti !== -1) this.turrets.splice(ti, 1);
                this.scene.remove(turret.group);
                if (combatCtx && combatCtx.showToast) {
                    combatCtx.showToast(`ТУРЕЛЬ РАЗРУШЕНА РОБОТАМИ!`, '#fb7185');
                }
                return true;
            }
            return false;
        }

        _destroyStructure(struct) {
            const idx = this.structures.indexOf(struct);
            if (idx !== -1) this.structures.splice(idx, 1);

            if (struct.mountedTurret) {
                const ti = this.turrets.indexOf(struct.mountedTurret);
                if (ti !== -1) {
                    this.scene.remove(struct.mountedTurret.group);
                    this.turrets.splice(ti, 1);
                }
            }

            const boxSet = new Set(struct.boxes);
            this.map.dynamicBoxes = this.map.dynamicBoxes.filter(b => !boxSet.has(b));
            if (struct.rampRef) {
                this.map.dynamicRamps = this.map.dynamicRamps.filter(r => r !== struct.rampRef);
            }
            const meshSet = new Set(struct.coverMeshes);
            this.map.dynamicCoverMeshes = this.map.dynamicCoverMeshes.filter(m => !meshSet.has(m));

            this.scene.remove(struct.group);
            this.map.refreshNavWithDynamics();
        }

        // =====================================================================
        // ALLIED TURRETS (POLYMER TURRET + HEAVY GATLING EMPLACEMENT!)
        // =====================================================================
        spawnTurret(kind, x, y, z, duration, gameCtx, customStats = null, isPermanent = false) {
            const isGatling = (kind === 'gatling' || kind === 'gatling_mini');
            const isMini = (kind === 'gatling_mini');
            const permanent = Boolean(isPermanent || isMini || !Number.isFinite(duration));
            const group = new THREE.Group();
            group.position.set(x, y, z);

            const steelMat = new THREE.MeshStandardMaterial({ color: 0x0f1f18, metalness: 0.85, roughness: 0.26 });
            const bodyMat = new THREE.MeshStandardMaterial({
                color: isGatling ? 0x2a1d12 : 0x133829,
                metalness: 0.72,
                roughness: 0.34
            });
            const glowMat = new THREE.MeshBasicMaterial({ color: isGatling ? 0xf97316 : 0x4ade80 });

            // Heavy tripod legs + stabilizer feet + armored collar
            for (let k = 0; k < 3; k++) {
                const ang = (k / 3) * Math.PI * 2;
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.18), steelMat);
                leg.position.set(Math.cos(ang) * 0.44, 0.42, Math.sin(ang) * 0.44);
                leg.rotation.z = Math.cos(ang) * 0.42;
                leg.rotation.x = -Math.sin(ang) * 0.42;
                const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), bodyMat);
                pad.position.set(Math.cos(ang) * 0.62, 0.04, Math.sin(ang) * 0.62);
                group.add(leg, pad);
            }

            const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.55, 10), steelMat);
            pedestal.position.y = 0.78;
            const rotCollar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 6, 16), glowMat);
            rotCollar.rotation.x = Math.PI / 2;
            rotCollar.position.y = 1.06;
            group.add(pedestal, rotCollar);

            const headPivot = new THREE.Group();
            headPivot.position.y = 1.24;
            group.add(headPivot);
            const glbHeadPivot = new THREE.Group();
            group.add(glbHeadPivot);

            const housing = new THREE.Mesh(new THREE.BoxGeometry(isGatling ? 0.7 : 0.56, 0.44, 0.72), bodyMat);
            const opticEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), glowMat);
            opticEye.position.set(0, 0.25, 0.24);
            headPivot.add(housing, opticEye);

            let barrelCluster = null;
            if (isGatling) {
                const gunShield = new THREE.Mesh(
                    new THREE.BoxGeometry(0.95, 0.58, 0.1),
                    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
                );
                gunShield.position.set(0, 0.08, 0.38);
                headPivot.add(gunShield);

                const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12), steelMat);
                drum.rotation.z = Math.PI / 2;
                drum.position.set(-0.36, -0.05, 0.02);
                headPivot.add(drum);

                barrelCluster = new THREE.Group();
                barrelCluster.position.set(0, 0, 0.85);
                const bGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.95, 6);
                bGeo.rotateX(Math.PI / 2);
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    const bar = new THREE.Mesh(bGeo, steelMat);
                    bar.position.set(Math.cos(ang) * 0.09, Math.sin(ang) * 0.09, 0);
                    barrelCluster.add(bar);
                }
                const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 14), glowMat);
                tipRing.position.z = 0.42;
                barrelCluster.add(tipRing);
                headPivot.add(barrelCluster);
            } else {
                // Twin-barrel Polymer Plasma Sentry
                barrelCluster = new THREE.Group();
                barrelCluster.position.set(0, 0, 0.56);
                [-0.16, 0.16].forEach(bx => {
                    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.82, 8), steelMat);
                    bar.rotation.x = Math.PI / 2;
                    bar.position.set(bx, 0, 0);
                    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.65, 8), glowMat);
                    core.rotation.x = Math.PI / 2;
                    core.position.set(bx, 0.06, -0.14);
                    barrelCluster.add(bar, core);
                });
                headPivot.add(barrelCluster);
                const holoHalo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 20), glowMat);
                holoHalo.rotation.x = Math.PI / 2;
                holoHalo.position.y = 0.45;
                group.add(holoHalo);
            }

            if (isMini) group.scale.setScalar(0.84);

            // Overhead 3D Health Bar so players see when robots attack their Gatlings!
            const hpBg = new THREE.Mesh(
                new THREE.BoxGeometry(1.15, 0.11, 0.08),
                new THREE.MeshBasicMaterial({ color: 0x09130f })
            );
            hpBg.position.set(0, 2.05, 0);
            const hpFill = new THREE.Mesh(
                new THREE.BoxGeometry(1.08, 0.08, 0.1),
                new THREE.MeshBasicMaterial({ color: isGatling ? 0xf97316 : 0x4ade80 })
            );
            hpFill.position.set(0, 2.05, 0);
            group.add(hpBg, hpFill);

            this.scene.add(group);

            const dmg = customStats ? customStats.damage : (isGatling ? (isMini ? 22 : 30) : 34);
            const fireInterval = customStats ? customStats.fireRate : (isGatling ? (isMini ? 0.11 : 0.068) : 0.26);
            const range = customStats ? customStats.range : (isGatling ? 46 : 38);

            const tObj = {
                kind,
                isGatling,
                permanent,
                group,
                headPivot,
                glbHeadPivot,
                glbTopObj: null,
                barrelCluster,
                hpFill,
                x,
                y,
                z,
                pos: new THREE.Vector3(x, y, z),
                hp: isGatling ? 980 : 420,
                maxHp: isGatling ? 980 : 420,
                life: permanent ? Infinity : duration,
                maxLife: permanent ? Infinity : duration,
                fireTimer: 0.15,
                fireInterval,
                damage: dmg,
                range,
                spinVel: 0,
                recoilOffset: 0,
                color: isGatling ? 0xf97316 : 0x4ade80,
                box: null
            };

            if (XB.Assets && typeof XB.Assets.instantiateTurret === 'function') {
                const procKeep = new Set([hpBg, hpFill, glbHeadPivot]);
                const procParts = group.children.filter(c => !procKeep.has(c));
                XB.Assets.instantiateTurret(isGatling ? 'gatling' : 'polymer').then((res) => {
                    if (!res || tObj.hp <= 0) return;
                    procParts.forEach(p => { p.visible = false; });
                    if (res.baseObj) group.add(res.baseObj);
                    if (res.topObj) {
                        glbHeadPivot.add(res.topObj);
                        tObj.glbTopObj = res.topObj;
                    }
                });
            }

            // Register soft turret collision against robots (robots must walk around or break the turret!)
            const tBox = {
                minX: x - 0.85, maxX: x + 0.85,
                minY: y, maxY: y + 1.9,
                minZ: z - 0.85, maxZ: z + 0.85,
                jumpable: false, navSolid: true, isTurretBox: true,
                turretRef: tObj
            };
            tObj.box = tBox;
            this.map.dynamicBoxes.push(tBox);

            // Respect max temporary turret cap without ever evicting permanent Coin-built Gatlings!
            const maxAllowed = this.maxTurrets + 2;
            while (this.turrets.filter(t => !t.permanent).length > maxAllowed) {
                const tempIdx = this.turrets.findIndex(t => !t.permanent);
                if (tempIdx === -1) break;
                const old = this.turrets.splice(tempIdx, 1)[0];
                this.scene.remove(old.group);
            }
            this.turrets.push(tObj);
            return tObj;
        }

        update(dt, combat, gameCtx) {
            const muzzleWorld = new THREE.Vector3();
            for (let i = this.turrets.length - 1; i >= 0; i--) {
                const t = this.turrets[i];
                if (!t.permanent && Number.isFinite(t.life)) {
                    t.life -= dt;
                }
                if ((!t.permanent && t.life <= 0) || t.hp <= 0) {
                    combat._spawnParticles(new THREE.Vector3(t.x, t.y + 1.0, t.z), t.color, 12, 8);
                    if (t.box) this.map.dynamicBoxes = this.map.dynamicBoxes.filter(b => b !== t.box);
                    this.scene.remove(t.group);
                    this.turrets.splice(i, 1);
                    continue;
                }

                // Shield Screen Passive Proximity Regen
                const headOrigin = new THREE.Vector3(t.x, t.y + 1.35, t.z);

                // Acquire nearest visible live alien
                let target = null;
                let bestDist = t.range;
                for (const a of this.enemies.aliens) {
                    if (a.dying || a.hp <= 0) continue;
                    const aCenter = a.group.position.clone().add(new THREE.Vector3(0, 1.35 * a.baseScale, 0));
                    const d = headOrigin.distanceTo(aCenter);
                    if (d < bestDist && this.map.hasLineOfSight(headOrigin.x, headOrigin.y, headOrigin.z, aCenter.x, aCenter.y, aCenter.z)) {
                        bestDist = d;
                        target = a;
                    }
                }

                if (target) {
                    const aCenter = target.group.position.clone().add(new THREE.Vector3(0, 1.35 * target.baseScale, 0));
                    const dx = aCenter.x - headOrigin.x;
                    const dy = aCenter.y - headOrigin.y;
                    const dz = aCenter.z - headOrigin.z;
                    const targetYaw = Math.atan2(dx, dz);
                    const flatD = Math.hypot(dx, dz);
                    const targetPitch = -Math.atan2(dy, Math.max(0.1, flatD));

                    let diff = targetYaw - t.headPivot.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    t.headPivot.rotation.y += diff * Math.min(1, dt * 12);
                    t.headPivot.rotation.x += (targetPitch - t.headPivot.rotation.x) * Math.min(1, dt * 10);

                    t.spinVel = t.isGatling ? 32 : 0;
                    t.fireTimer -= dt;
                    if (t.fireTimer <= 0 && Math.abs(diff) < 0.45) {
                        t.fireTimer = t.fireInterval;
                        t.recoilOffset = t.isGatling ? 0.08 : 0.14;
                        muzzleWorld.set(0, 0, 1.05).applyMatrix4(t.headPivot.matrixWorld);
                        combat._spawnTracer(muzzleWorld, aCenter, t.color, t.isGatling ? 0.045 : 0.075);
                        if (!t.isGatling) {
                            target.shockTimer = Math.max(target.shockTimer, 0.45);
                        }
                        // Robot remembers the "troll" Gatling turret shooting it and may try to destroy it!
                        if (!target.aggroTurret || target.aggroTurret.hp <= 0) {
                            target.aggroTurret = t;
                        }
                        combat.damageAlien(target, t.damage, aCenter, t.color, false, 1.75, gameCtx);
                        if (headOrigin.distanceTo(gameCtx.playerPos) < 42) {
                            this.sound.playTurretShot(t.isGatling);
                        }
                    }
                } else {
                    t.headPivot.rotation.y += dt * 0.7;
                    t.headPivot.rotation.x *= Math.exp(-5 * dt);
                    t.spinVel = Math.max(0, t.spinVel - dt * 24);
                }

                if (t.recoilOffset > 0) {
                    t.recoilOffset = Math.max(0, t.recoilOffset - dt * 1.1);
                }
                if (t.glbHeadPivot) {
                    t.glbHeadPivot.rotation.y = t.headPivot.rotation.y;
                    t.glbHeadPivot.rotation.x = t.headPivot.rotation.x;
                }
                if (t.glbTopObj) {
                    t.glbTopObj.position.z = -t.recoilOffset * 1.4;
                }
                if (t.barrelCluster) {
                    t.barrelCluster.position.z = (t.isGatling ? 0.85 : 0.56) - t.recoilOffset;
                    if (t.spinVel > 0.1) t.barrelCluster.rotation.z += t.spinVel * dt;
                }
            }

            // Crafted Wall Holo-Shield Regeneration & Visual Pulse
            for (const st of this.structures) {
                if (st.attachments.has('shield_screen')) {
                    const d = Math.hypot(st.x - gameCtx.playerPos.x, st.z - gameCtx.playerPos.z);
                    if (d < 6.5 && Math.abs(st.y - gameCtx.playerPos.y) < 3.5) {
                        gameCtx.restoreShieldSilent(9 * dt);
                    }
                }
            }
        }
    }

    XB.BuildingSystem = BuildingSystem;
})(window);
