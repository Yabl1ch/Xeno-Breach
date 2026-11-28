/**
 * Expanded 188x188 Multi-Level Orbital Complex MapBuilder & 2D NavGrid Flow-Field.
 * Features:
 *  - 3 Playable Vertical Levels (Ground y=0m, 2nd Deck y=4.0m, 3rd Skybridge & Sniper Deck y=8.0m)
 *  - 4 Reinforced Combat Pillboxes (ДОТы) with overhead roofs & shooting embrasures
 *  - Wide preserved BHop Speedways & smooth continuous ramps between floors
 *  - 4 Northern Airlock Breach Chambers with physical staging tunnels
 *  - 2 Shootable 3D Wave Trigger Buttons (for Intermission rest between waves!)
 *  - Interactive 3D Armory Terminal, 12 Barrels, 10 Grav-Pads, Cryo Pods, Mech Bay
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class MapBuilder {
        constructor(scene, maxAniso = 4) {
            this.scene = scene;
            this.maxAniso = maxAniso;
            this.ARENA_LIMIT_X = 92.0;
            this.ARENA_LIMIT_Z = 92.0;

            this.boxes = [];
            this.ramps = [];
            this.coverMeshes = [];
            this.dynamicBoxes = [];
            this.dynamicRamps = [];
            this.dynamicCoverMeshes = [];

            this.breachDoors = [];
            this.jumpPads = [];
            this.staticPads = [];
            this.barrels = [];
            this.decorSpinners = [];
            this.waveButtons = [];
            this.waveButtonMeshes = [];
            this.armoryTerminal = null;

            this.NAV_HALF = 96;
            this.NAV_CELL = 3.0;
            this.NAV_DIM = 64;
            this.navBlocked = new Uint8Array(this.NAV_DIM * this.NAV_DIM);
            this.flowDist = new Int16Array(this.NAV_DIM * this.NAV_DIM);
            this.flowDirX = new Float32Array(this.NAV_DIM * this.NAV_DIM);
            this.flowDirZ = new Float32Array(this.NAV_DIM * this.NAV_DIM);
            this._bfsQueue = new Int32Array(this.NAV_DIM * this.NAV_DIM);
        }

        build() {
            const aniso = this.maxAniso || 4;
            const floorMaps = XB.Textures.createFloorMaps(aniso);
            const wallMaps = XB.Textures.createWallMaps(aniso);
            const structMaps = XB.Textures.createSteelPanelMaps('#13241d', '#193127', '#22c55e', 2, 2, aniso);
            const bunkerMaps = XB.Textures.createSteelPanelMaps('#1a2c24', '#22382e', '#f59e0b', 2, 2, aniso);
            const darkSteelMaps = XB.Textures.createSteelPanelMaps('#0b1511', '#12221c', '#38bdf8', 3, 2, aniso);
            const crateMaps = XB.Textures.createCrateMaps('#4ade80', aniso);
            const cargoMaps = XB.Textures.createCrateMaps('#f59e0b', aniso);
            const hazardMaps = XB.Textures.createHazardMaps(aniso);
            const grateMaps = XB.Textures.createGratingMaps(aniso);

            const floorMat = new THREE.MeshStandardMaterial({
                map: floorMaps.map,
                bumpMap: floorMaps.bumpMap,
                bumpScale: 0.08,
                roughnessMap: floorMaps.roughnessMap,
                roughness: 0.72,
                metalness: 0.45,
                emissiveMap: floorMaps.emissiveMap,
                emissive: 0xffffff,
                emissiveIntensity: 0.35
            });
            const wallMat = new THREE.MeshStandardMaterial({
                map: wallMaps.map,
                bumpMap: wallMaps.bumpMap,
                bumpScale: 0.12,
                roughnessMap: wallMaps.roughnessMap,
                roughness: 0.68,
                metalness: 0.56,
                emissiveMap: wallMaps.emissiveMap,
                emissive: 0xffffff,
                emissiveIntensity: 0.45
            });
            const structMat = new THREE.MeshStandardMaterial({
                map: structMaps.map,
                bumpMap: structMaps.bumpMap,
                bumpScale: 0.1,
                roughnessMap: structMaps.roughnessMap,
                roughness: 0.62,
                metalness: 0.62
            });
            const bunkerMat = new THREE.MeshStandardMaterial({
                map: bunkerMaps.map,
                bumpMap: bunkerMaps.bumpMap,
                bumpScale: 0.14,
                roughnessMap: bunkerMaps.roughnessMap,
                roughness: 0.72,
                metalness: 0.52
            });
            const darkSteelMat = new THREE.MeshStandardMaterial({
                map: darkSteelMaps.map,
                bumpMap: darkSteelMaps.bumpMap,
                bumpScale: 0.08,
                roughnessMap: darkSteelMaps.roughnessMap,
                roughness: 0.48,
                metalness: 0.78
            });
            const crateMat = new THREE.MeshStandardMaterial({
                map: crateMaps.map,
                bumpMap: crateMaps.bumpMap,
                bumpScale: 0.12,
                roughnessMap: crateMaps.roughnessMap,
                roughness: 0.58,
                metalness: 0.54,
                emissiveMap: crateMaps.emissiveMap,
                emissive: 0xffffff,
                emissiveIntensity: 0.7
            });
            const cargoMat = new THREE.MeshStandardMaterial({
                map: cargoMaps.map,
                bumpMap: cargoMaps.bumpMap,
                bumpScale: 0.12,
                roughnessMap: cargoMaps.roughnessMap,
                roughness: 0.6,
                metalness: 0.52,
                emissiveMap: cargoMaps.emissiveMap,
                emissive: 0xffffff,
                emissiveIntensity: 0.7
            });
            const bridgeMat = new THREE.MeshStandardMaterial({
                map: grateMaps.map,
                bumpMap: grateMaps.bumpMap,
                bumpScale: 0.11,
                roughnessMap: grateMaps.roughnessMap,
                roughness: 0.52,
                metalness: 0.74
            });
            const rampMat = new THREE.MeshStandardMaterial({
                map: hazardMaps.map,
                bumpMap: hazardMaps.bumpMap,
                bumpScale: 0.1,
                roughnessMap: hazardMaps.roughnessMap,
                roughness: 0.66,
                metalness: 0.54
            });

            if (XB.Assets && typeof XB.Assets.applyExternalPBRToMaterial === 'function') {
                XB.Assets.applyExternalPBRToMaterial(floorMat, 'floor', 42, 42, { maxAniso: aniso, normalScale: 0.9, tintHex: 0xa4d9bc });
                XB.Assets.applyExternalPBRToMaterial(wallMat, 'wall', 12, 1, { maxAniso: aniso, normalScale: 1.15, tintHex: 0x86c9a5 });
                XB.Assets.applyExternalPBRToMaterial(structMat, 'struct', 2, 2, { maxAniso: aniso, normalScale: 1.0, tintHex: 0x72b091 });
                XB.Assets.applyExternalPBRToMaterial(bunkerMat, 'bunker', 2, 2, { maxAniso: aniso, normalScale: 1.2, tintHex: 0x9ac2ab });
                XB.Assets.applyExternalPBRToMaterial(darkSteelMat, 'floor', 3, 2, { maxAniso: aniso, normalScale: 0.85, tintHex: 0x456b58 });
                XB.Assets.applyExternalPBRToMaterial(bridgeMat, 'grate', 6, 2, { maxAniso: aniso, normalScale: 1.0, tintHex: 0x88b89f });
            }

            // Main floor
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(196, 212), floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(0, 0, -6);
            floor.receiveShadow = true;
            this.scene.add(floor);

            const addBox = (x, yCenter, z, w, h, d, mat, opts = {}) => {
                const {
                    jumpable = true,
                    accent = null,
                    navSolid = (yCenter - h / 2 < 1.9 && yCenter + h / 2 > 0.3),
                    blocksRaycast = true,
                    castShadow = true
                } = opts;

                const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                mesh.position.set(x, yCenter, z);
                mesh.castShadow = castShadow;
                mesh.receiveShadow = true;
                if (blocksRaycast) {
                    mesh.userData.isCover = true;
                    this.coverMeshes.push(mesh);
                }
                this.scene.add(mesh);

                if (accent !== null) {
                    const strip = new THREE.Mesh(
                        new THREE.BoxGeometry(w + 0.08, 0.16, d + 0.08),
                        new THREE.MeshBasicMaterial({ color: accent })
                    );
                    strip.position.set(x, yCenter + h / 2 - 0.2, z);
                    this.scene.add(strip);
                }

                this.boxes.push({
                    minX: x - w / 2,
                    maxX: x + w / 2,
                    minY: yCenter - h / 2,
                    maxY: yCenter + h / 2,
                    minZ: z - d / 2,
                    maxZ: z + d / 2,
                    jumpable,
                    navSolid
                });
                return mesh;
            };

            const addBlock = (x, z, w, h, d, mat, jumpable = false, accent = null, navSolid = true) => {
                return addBox(x, h / 2, z, w, h, d, mat, { jumpable, accent, navSolid });
            };

            // Walkable ramp supporting arbitrary start/end elevations (e.g. 0->4m AND 4m->8m!)
            const addRamp = (x, z, width, length, yLow, yHigh, dir, accentColor = 0x4ade80) => {
                const minX = x - (dir === 'E' || dir === 'W' ? length / 2 : width / 2);
                const maxX = x + (dir === 'E' || dir === 'W' ? length / 2 : width / 2);
                const minZ = z - (dir === 'N' || dir === 'S' ? length / 2 : width / 2);
                const maxZ = z + (dir === 'N' || dir === 'S' ? length / 2 : width / 2);

                let y00, y10, y01, y11;
                if (dir === 'N') { y00 = y10 = yHigh; y01 = y11 = yLow; }
                else if (dir === 'S') { y00 = y10 = yLow; y01 = y11 = yHigh; }
                else if (dir === 'E') { y00 = y01 = yLow; y10 = y11 = yHigh; }
                else { y00 = y01 = yHigh; y10 = y11 = yLow; }

                const bBase = Math.max(0, yLow - 0.35);
                const verts = new Float32Array([
                    // Top slope
                    minX, y00, minZ,  minX, y01, maxZ,  maxX, y11, maxZ,
                    minX, y00, minZ,  maxX, y11, maxZ,  maxX, y10, minZ,
                    // Underside
                    minX, bBase, minZ,  maxX, bBase, minZ,  maxX, bBase, maxZ,
                    minX, bBase, minZ,  maxX, bBase, maxZ,  minX, bBase, maxZ,
                    // West
                    minX, bBase, minZ,  minX, bBase, maxZ,  minX, y01, maxZ,
                    minX, bBase, minZ,  minX, y01, maxZ,  minX, y00, minZ,
                    // East
                    maxX, bBase, minZ,  maxX, y10, minZ,  maxX, y11, maxZ,
                    maxX, bBase, minZ,  maxX, y11, maxZ,  maxX, bBase, maxZ,
                    // North
                    minX, bBase, minZ,  minX, y00, minZ,  maxX, y10, minZ,
                    minX, bBase, minZ,  maxX, y10, minZ,  maxX, bBase, minZ,
                    // South
                    minX, bBase, maxZ,  maxX, bBase, maxZ,  maxX, y11, maxZ,
                    minX, bBase, maxZ,  maxX, y11, maxZ,  minX, y01, maxZ
                ]);
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
                geo.computeVertexNormals();
                const uvs = new Float32Array((verts.length / 3) * 2);
                for (let i = 0; i < verts.length / 3; i++) {
                    uvs[i * 2] = (verts[i * 3] + verts[i * 3 + 2]) * 0.25;
                    uvs[i * 2 + 1] = (verts[i * 3 + 1] + verts[i * 3 + 2]) * 0.25;
                }
                geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

                const mesh = new THREE.Mesh(geo, rampMat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.isCover = true;
                this.coverMeshes.push(mesh);
                this.scene.add(mesh);

                const stripLen = Math.hypot(length, yHigh - yLow);
                const slopeAngle = Math.atan2(yHigh - yLow, length);
                [-width / 2 + 0.15, width / 2 - 0.15].forEach(offset => {
                    const rail = new THREE.Mesh(
                        new THREE.BoxGeometry(0.18, 0.18, stripLen),
                        new THREE.MeshBasicMaterial({ color: accentColor })
                    );
                    if (dir === 'N' || dir === 'S') {
                        rail.position.set(x + offset, (yLow + yHigh) / 2 + 0.12, z);
                        rail.rotation.x = dir === 'N' ? slopeAngle : -slopeAngle;
                    } else {
                        rail.geometry = new THREE.BoxGeometry(stripLen, 0.18, 0.18);
                        rail.position.set(x, (yLow + yHigh) / 2 + 0.12, z + offset);
                        rail.rotation.z = dir === 'E' ? slopeAngle : -slopeAngle;
                    }
                    this.scene.add(rail);
                });

                this.ramps.push({
                    minX,
                    maxX,
                    minZ,
                    maxZ,
                    yBase: bBase,
                    axis: (dir === 'N' || dir === 'S') ? 'z' : 'x',
                    yAtMin: (dir === 'N' || dir === 'W') ? yHigh : yLow,
                    yAtMax: (dir === 'N' || dir === 'W') ? yLow : yHigh
                });
            };

            // =================================================================
            // 1. PERIMETER WALLS & 4 NORTHERN AIRLOCK BREACH BAYS
            // =================================================================
            const wallH = 13.5;
            addBox(0, wallH / 2, 95, 194, wallH, 2.5, wallMat, { jumpable: false, navSolid: false });
            addBox(-95, wallH / 2, 0, 2.5, wallH, 192, wallMat, { jumpable: false, navSolid: false });
            addBox(95, wallH / 2, 0, 2.5, wallH, 192, wallMat, { jumpable: false, navSolid: false });

            const gateXs = [-57, -19, 19, 57];
            [
                { x: -79, w: 34 },
                { x: -38, w: 26 },
                { x: 0, w: 26 },
                { x: 38, w: 26 },
                { x: 79, w: 34 }
            ].forEach(seg => {
                addBox(seg.x, wallH / 2, -94, seg.w, wallH, 2.6, wallMat, { jumpable: false, navSolid: false });
            });

            gateXs.forEach((dx, idx) => {
                const doorGroup = new THREE.Group();
                doorGroup.position.set(dx, 0, -94);

                const pLeft = new THREE.Mesh(new THREE.BoxGeometry(1.7, 9.5, 3.0), darkSteelMat);
                pLeft.position.set(-5.3, 4.75, 0);
                const pRight = pLeft.clone();
                pRight.position.set(5.3, 4.75, 0);
                const lintel = new THREE.Mesh(new THREE.BoxGeometry(12.4, 2.4, 3.2), darkSteelMat);
                lintel.position.set(0, 9.0, 0);
                doorGroup.add(pLeft, pRight, lintel);

                const tunnelWallL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 8.4, 15), structMat);
                tunnelWallL.position.set(-5.6, 4.2, -7.6);
                const tunnelWallR = tunnelWallL.clone();
                tunnelWallR.position.set(5.6, 4.2, -7.6);
                const tunnelRoof = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.0, 15.5), darkSteelMat);
                tunnelRoof.position.set(0, 8.6, -7.6);
                const tunnelBack = new THREE.Mesh(new THREE.BoxGeometry(12.2, 8.6, 1.0), darkSteelMat);
                tunnelBack.position.set(0, 4.3, -15.0);
                doorGroup.add(tunnelWallL, tunnelWallR, tunnelRoof, tunnelBack);

                const portalMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
                const portal = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 7.8), portalMat);
                portal.position.set(0, 3.9, -0.5);
                doorGroup.add(portal);

                const panelMat = new THREE.MeshStandardMaterial({ color: 0x263830, metalness: 0.72, roughness: 0.34 });
                const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7.8, 0.7), panelMat);
                leftLeaf.position.set(-2.25, 3.9, 0.35);
                const rightLeaf = leftLeaf.clone();
                rightLeaf.position.set(2.25, 3.9, 0.35);
                doorGroup.add(leftLeaf, rightLeaf);

                const beaconMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
                const beacon = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.55, 0.55), beaconMat);
                beacon.position.set(0, 9.4, 1.6);
                doorGroup.add(beacon);

                this.scene.add(doorGroup);

                this.boxes.push({
                    minX: dx - 5.4,
                    maxX: dx + 5.4,
                    minY: 0,
                    maxY: 9.0,
                    minZ: -96.5,
                    maxZ: -93.0,
                    jumpable: false,
                    navSolid: false,
                    playerOnly: true
                });

                this.breachDoors.push({
                    index: idx,
                    x: dx,
                    spawnZ: -103.5,
                    exitZ: -86.5,
                    leftLeaf,
                    rightLeaf,
                    beaconMat,
                    portalMat,
                    openAmount: 0,
                    openTimer: 0
                });
            });

            // =================================================================
            // 2. CENTRAL 3-FLOOR REACTOR CITADEL & SKYBRIDGE (0m -> 4.0m -> 8.0m!)
            // =================================================================
            const reactorBase = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.8, 2.0, 12), darkSteelMat);
            reactorBase.position.set(0, 1.0, 0);
            reactorBase.castShadow = true;
            reactorBase.receiveShadow = true;
            this.scene.add(reactorBase);

            const reactorCore = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
            reactorCore.position.set(0, 5.8, 0);
            this.scene.add(reactorCore);
            this.decorSpinners.push(reactorCore);

            const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.18, 10, 36), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
            ring1.position.set(0, 5.8, 0);
            ring1.rotation.x = Math.PI / 3;
            this.scene.add(ring1);
            this.decorSpinners.push(ring1);

            const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.14, 10, 36), new THREE.MeshBasicMaterial({ color: 0xa7f3d0 }));
            ring2.position.set(0, 5.8, 0);
            ring2.rotation.y = Math.PI / 4;
            this.scene.add(ring2);
            this.decorSpinners.push(ring2);

            const beamCol = new THREE.Mesh(
                new THREE.CylinderGeometry(0.65, 0.65, 26, 12),
                new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.28 })
            );
            beamCol.position.set(0, 13, 0);
            this.scene.add(beamCol);

            this.boxes.push({ minX: -4.8, maxX: 4.8, minY: 0, maxY: 10.0, minZ: -4.8, maxZ: 4.8, jumpable: false, navSolid: true });

            // 2nd Floor Reactor Catwalk Ring (y = 4.0m)
            const deck2Y = 4.0;
            addBox(0, deck2Y - 0.3, -22, 48, 0.6, 7.5, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox(0, deck2Y - 0.3,  22, 48, 0.6, 7.5, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox(-22, deck2Y - 0.3, 0, 7.5, 0.6, 36.5, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox( 22, deck2Y - 0.3, 0, 7.5, 0.6, 36.5, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });

            // Chest-high tactical cover barriers on 2nd Floor Deck!
            addBox(-14, deck2Y + 0.55, -25.1, 7.0, 1.1, 0.7, structMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox( 14, deck2Y + 0.55, -25.1, 7.0, 1.1, 0.7, structMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox(-14, deck2Y + 0.55,  25.1, 7.0, 1.1, 0.7, structMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox( 14, deck2Y + 0.55,  25.1, 7.0, 1.1, 0.7, structMat, { jumpable: true, accent: 0x4ade80, navSolid: false });

            // 4 Wide Walkable Ramps (Ground 0 -> 2nd Floor 4.0m)
            addRamp(0, -32.5, 7.0, 13.5, 0, deck2Y, 'S', 0x4ade80);
            addRamp(0,  32.5, 7.0, 13.5, 0, deck2Y, 'N', 0x4ade80);
            addRamp(-32.5, 0, 7.0, 13.5, 0, deck2Y, 'E', 0x4ade80);
            addRamp( 32.5, 0, 7.0, 13.5, 0, deck2Y, 'W', 0x4ade80);

            // Support Pillars under Reactor Deck Corners & Ground Cover
            [[-22, -22], [22, -22], [-22, 22], [22, 22]].forEach(([px, pz]) => {
                addBlock(px, pz, 3.2, 11.2, 3.2, structMat, false, 0x34d399, true);
            });
            [[-12, -12], [12, -12], [-12, 12], [12, 12]].forEach(([cx, cz]) => {
                addBlock(cx, cz, 3.6, 1.85, 3.6, crateMat, true, 0x4ade80, true);
            });

            // -----------------------------------------------------------------
            // 3RD FLOOR SKYBRIDGE & HIGH COMMAND OVERLOOKS (y = 8.0m!)
            // -----------------------------------------------------------------
            const deck3Y = 8.0;
            // High East-West Skybridge spanning above Reactor North Wing (Z = -22, y = 8.0m)
            addBox(0, deck3Y - 0.3, -22, 92, 0.6, 6.4, bridgeMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            // Protective sniper cover parapets on 3rd floor Skybridge!
            addBox(-24, deck3Y + 0.55, -24.8, 9.0, 1.1, 0.7, bunkerMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            addBox(  0, deck3Y + 0.55, -24.8, 9.0, 1.1, 0.7, bunkerMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            addBox( 24, deck3Y + 0.55, -24.8, 9.0, 1.1, 0.7, bunkerMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            // 3rd Floor South Overlook Skybridge (Z = +22, y = 8.0m)
            addBox(0, deck3Y - 0.3, 22, 52, 0.6, 6.0, bridgeMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            addBox(0, deck3Y + 0.55, 19.3, 12.0, 1.1, 0.7, bunkerMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            // Connecting 3rd floor side walkways (X = -22 and +22 at y = 8.0m)
            addBox(-22, deck3Y - 0.3, 0, 5.8, 0.6, 37.6, bridgeMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });
            addBox( 22, deck3Y - 0.3, 0, 5.8, 0.6, 37.6, bridgeMat, { jumpable: true, accent: 0x67e8f9, navSolid: false });

            // 2nd Floor -> 3rd Floor Ramps (connecting 4.0m decks smoothly up to 8.0m skybridge!)
            addRamp(-54, -22, 6.2, 16, deck2Y, deck3Y, 'E', 0x67e8f9); // West 2nd->3rd
            addRamp( 54, -22, 6.2, 16, deck2Y, deck3Y, 'W', 0x67e8f9); // East 2nd->3rd
            // 2nd floor landing pads for those 3rd floor ramps (connecting X=-62..78 at y=4.0m)
            addBox(-69, deck2Y - 0.3, -22, 16, 0.6, 7.0, bridgeMat, { jumpable: true, accent: 0x34d399, navSolid: false });
            addBox( 69, deck2Y - 0.3, -22, 16, 0.6, 7.0, bridgeMat, { jumpable: true, accent: 0x34d399, navSolid: false });
            // North-to-South upper sniper ramp from South 2nd deck (y=4.0m -> 8.0m at X=-22/+22? Place at X=-32/+32 Z=22!)
            addRamp(-33, 22, 5.8, 15, deck2Y, deck3Y, 'E', 0x67e8f9);
            addRamp( 33, 22, 5.8, 15, deck2Y, deck3Y, 'W', 0x67e8f9);
            addBox(-44, deck2Y - 0.3, 22, 8.0, 0.6, 6.8, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
            addBox( 44, deck2Y - 0.3, 22, 8.0, 0.6, 6.8, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });

            // =================================================================
            // 3. 4 REINFORCED COMBAT PILLBOXES (БОЕВЫЕ ДОТЫ С АМБРАЗУРАМИ)
            // =================================================================
            this._buildPillbox(-30, -60, addBox, bunkerMat, darkSteelMat, 0x4ade80);
            this._buildPillbox( 30, -60, addBox, bunkerMat, darkSteelMat, 0x4ade80);
            this._buildPillbox(-36,  42, addBox, bunkerMat, darkSteelMat, 0x38bdf8);
            this._buildPillbox( 36,  42, addBox, bunkerMat, darkSteelMat, 0x38bdf8);

            // =================================================================
            // 4. NORTH OVERPASS, TRENCHES & WRECKED APCs (OPEN BHOP LANES PRESERVED!)
            // =================================================================
            // Elevated North Overpass Bridge (Z = -50, Y = 4.0) with 2 ramps
            addBox(0, 3.7, -50, 76, 0.6, 6.5, bridgeMat, { jumpable: true, accent: 0x38bdf8, navSolid: false });
            addBox(-18, 4.55, -52.8, 10, 1.1, 0.7, bunkerMat, { jumpable: true, accent: 0x38bdf8, navSolid: false });
            addBox( 18, 4.55, -52.8, 10, 1.1, 0.7, bunkerMat, { jumpable: true, accent: 0x38bdf8, navSolid: false });
            addRamp(-45.5, -50, 6.4, 15, 0, 4.0, 'E', 0x38bdf8);
            addRamp( 45.5, -50, 6.4, 15, 0, 4.0, 'W', 0x38bdf8);
            [-24, 0, 24].forEach(bx => {
                addBlock(bx, -50, 2.2, 3.4, 2.2, darkSteelMat, false, 0x38bdf8, true);
            });

            // Forward tactical low cover (leaving wide lanes around X=-38, X=0, X=+38 for BHop!)
            addBlock(-19, -74, 7.0, 1.65, 2.2, crateMat, true, 0x4ade80, true);
            addBlock( 19, -74, 7.0, 1.65, 2.2, crateMat, true, 0x4ade80, true);
            addBlock(-57, -70, 7.2, 1.8, 2.2, crateMat, true, 0xf59e0b, true);
            addBlock( 57, -70, 7.2, 1.8, 2.2, crateMat, true, 0xf59e0b, true);

            // Wrecked Hover-APCs in wide side lanes
            this._buildArmoredAPC(-58, -38, 0.25, darkSteelMat, structMat);
            this._buildArmoredAPC( 58, -38, -0.25, darkSteelMat, structMat);

            // =================================================================
            // 5. WEST BIO-LAB & CRYO COMPLEX (X: -94..-48, Z: -40..40)
            // =================================================================
            addBlock(-50, -34, 2.0, 7.8, 10, structMat, false, 0x22c55e, true);
            addBlock(-50, -12, 2.0, 7.8, 10, structMat, false, 0x22c55e, true);
            addBlock(-50,  12, 2.0, 7.8, 10, structMat, false, 0x22c55e, true);
            addBlock(-50,  34, 2.0, 7.8, 10, structMat, false, 0x22c55e, true);

            // West Mezzanine (y = 4.0m) + 2nd Floor Cover + Ramp to North-South
            addBox(-83, 3.7, 0, 16, 0.6, 52, bridgeMat, { jumpable: true, accent: 0x34d399, navSolid: false });
            addBox(-75.5, 4.55, 0, 0.8, 1.1, 14, structMat, { jumpable: true, accent: 0x34d399, navSolid: false });
            addRamp(-83, -33, 7.5, 14, 0, 4.0, 'S', 0x34d399);
            addRamp(-83,  33, 7.5, 14, 0, 4.0, 'N', 0x34d399);

            [[-63, -24], [-63, 24], [-70, -10], [-70, 10]].forEach(([tx, tz]) => {
                this._buildCryoTank(tx, tz, addBlock, darkSteelMat);
            });
            addBlock(-58, 0, 4.5, 1.55, 7.5, crateMat, true, 0x22c55e, true);

            // =================================================================
            // 6. EAST CARGO HANGAR & MECH REPAIR BAY (X: 48..94, Z: -40..40)
            // =================================================================
            addBlock(50, -34, 2.0, 7.8, 10, structMat, false, 0xf59e0b, true);
            addBlock(50, -12, 2.0, 7.8, 10, structMat, false, 0xf59e0b, true);
            addBlock(50,  12, 2.0, 7.8, 10, structMat, false, 0xf59e0b, true);
            addBlock(50,  34, 2.0, 7.8, 10, structMat, false, 0xf59e0b, true);

            addBlock(64, -24, 6.0, 2.4, 10.5, cargoMat, true, 0xf59e0b, true);
            addBox(64, 3.6, -26, 5.4, 2.4, 5.8, cargoMat, { jumpable: true, accent: 0xfacc15, navSolid: false });
            addRamp(64, -12, 5.4, 13, 0, 2.4, 'N', 0xf59e0b);

            addBlock(64, 24, 6.0, 2.4, 10.5, cargoMat, true, 0xf59e0b, true);
            addBox(64, 3.6, 26, 5.4, 2.4, 5.8, cargoMat, { jumpable: true, accent: 0xfacc15, navSolid: false });
            addRamp(64, 12, 5.4, 13, 0, 2.4, 'S', 0xf59e0b);

            addBox(84, 3.7, 0, 16, 0.6, 54, bridgeMat, { jumpable: true, accent: 0xf59e0b, navSolid: false });
            addBox(76.5, 4.55, 0, 0.8, 1.1, 14, structMat, { jumpable: true, accent: 0xf59e0b, navSolid: false });
            addRamp(84, -33.5, 7.5, 13, 0, 4.0, 'S', 0xf59e0b);
            addRamp(84,  33.5, 7.5, 13, 0, 4.0, 'N', 0xf59e0b);
            this._buildRepairMech(72, 0, darkSteelMat, cargoMat);

            // =================================================================
            // 6B. TACTICAL WALLS, PEEK-CORNERS, L-BUNKERS & DODGE CORRIDORS
            // (Preserves 3 BHop Highways: West X=-38, Center X=0, East X=+38!)
            // =================================================================
            const wallDefs = [
                // Foreground & South-West / South-East tactical cover walls (fixes empty spawn flanks!)
                { x: -24, z: 54, w: 9.0, h: 3.4, d: 1.2, accent: 0x4ade80, slit: true },
                { x:  24, z: 54, w: 9.0, h: 3.4, d: 1.2, accent: 0x4ade80, slit: true },
                { x: -50, z: 60, w: 1.4, h: 3.5, d: 11.0, accent: 0x34d399, lwing: [4.2, 1.4, 5.2] },
                { x:  50, z: 60, w: 1.4, h: 3.5, d: 11.0, accent: 0x34d399, lwing: [-4.2, 1.4, 5.2] },
                { x: -64, z: 42, w: 10.5, h: 3.4, d: 1.3, accent: 0x22c55e, slit: true },
                { x:  64, z: 42, w: 10.5, h: 3.4, d: 1.3, accent: 0x22c55e, slit: true },
                { x: -58, z: 74, w: 7.5, h: 2.8, d: 1.2, accent: 0x4ade80 },
                { x:  58, z: 74, w: 7.5, h: 2.8, d: 1.2, accent: 0x4ade80 },

                // Mid-Arena Dodge Pillars & Peek T-Walls (between outer lanes and central citadel)
                { x: -28, z: -38, w: 8.4, h: 3.4, d: 1.3, accent: 0x38bdf8, slit: true },
                { x:  28, z: -38, w: 8.4, h: 3.4, d: 1.3, accent: 0x38bdf8, slit: true },
                { x: -29, z: -12, w: 1.4, h: 3.6, d: 9.5, accent: 0x4ade80 },
                { x:  29, z: -12, w: 1.4, h: 3.6, d: 9.5, accent: 0x4ade80 },
                { x: -29, z:  12, w: 1.4, h: 3.6, d: 9.5, accent: 0x4ade80 },
                { x:  29, z:  12, w: 1.4, h: 3.6, d: 9.5, accent: 0x4ade80 },
                { x: -26, z:  34, w: 8.0, h: 3.3, d: 1.3, accent: 0x38bdf8, slit: true },
                { x:  26, z:  34, w: 8.0, h: 3.3, d: 1.3, accent: 0x38bdf8, slit: true },

                // Outer West & East Flank Zig-Zag Blast Walls & Sniper Shields (X = -76..+76)
                { x: -72, z:  52, w: 8.5, h: 3.5, d: 1.4, accent: 0x34d399 },
                { x:  72, z:  52, w: 8.5, h: 3.5, d: 1.4, accent: 0xf59e0b },
                { x: -64, z: -60, w: 10.0, h: 3.5, d: 1.4, accent: 0x22c55e, slit: true },
                { x:  64, z: -60, w: 10.0, h: 3.5, d: 1.4, accent: 0xf59e0b, slit: true },
                { x: -46, z: -68, w: 1.4, h: 3.6, d: 9.0, accent: 0x38bdf8 },
                { x:  46, z: -68, w: 1.4, h: 3.6, d: 9.0, accent: 0x38bdf8 },
                { x:   0, z: -72, w: 11.5, h: 3.4, d: 1.4, accent: 0x4ade80, slit: true }
            ];

            wallDefs.forEach(wd => {
                if (wd.slit) {
                    // Perforated Embrasure Bunker Wall: waist-high shield + flanking pillars + upper visor beam!
                    addBlock(wd.x, wd.z, wd.w, 1.35, wd.d, bunkerMat, true, wd.accent, true);
                    addBox(wd.x - wd.w * 0.42, 2.35, wd.z, wd.w * 0.16, 2.0, wd.d, darkSteelMat, { jumpable: false, navSolid: true });
                    addBox(wd.x + wd.w * 0.42, 2.35, wd.z, wd.w * 0.16, 2.0, wd.d, darkSteelMat, { jumpable: false, navSolid: true });
                    addBox(wd.x, 3.05, wd.z, wd.w, 0.7, wd.d, bunkerMat, { jumpable: true, accent: wd.accent, navSolid: false });
                } else {
                    addBlock(wd.x, wd.z, wd.w, wd.h, wd.d, structMat, false, wd.accent, true);
                    // Buttress rib columns on wall ends for layered silhouettes
                    const endOffX = wd.w > wd.d ? wd.w * 0.48 : 0;
                    const endOffZ = wd.d >= wd.w ? wd.d * 0.48 : 0;
                    addBlock(wd.x - endOffX, wd.z - endOffZ, 1.65, wd.h + 0.35, 1.65, darkSteelMat, false, wd.accent, true);
                    addBlock(wd.x + endOffX, wd.z + endOffZ, 1.65, wd.h + 0.35, 1.65, darkSteelMat, false, wd.accent, true);
                    if (wd.lwing) {
                        addBlock(wd.x + wd.lwing[0], wd.z + wd.lwing[2], 7.4, wd.h, 1.35, bunkerMat, false, wd.accent, true);
                    }
                }
            });

            // Stepped Peek Pillars & Jump-Vault Chest Barriers along North-to-South Lanes (keeping X=±38 & X=0 BHop highways clear!)
            [
                [-14, -40], [14, -40],
                [-14,  28], [14,  28],
                [-30,  50], [30,  50],
                [-76, -24], [76, -24],
                [-76,  24], [76,  24],
                [-20,  70], [20,  70]
            ].forEach(([px, pz]) => {
                addBlock(px, pz, 2.6, 3.2, 2.6, darkSteelMat, true, 0x4ade80, true);
            });

            // =================================================================
            // 7. SOUTH COMMAND BASTION, SNIPER TOWERS, ARMORY & WAVE TRIGGERS
            // =================================================================
            addBlock(-16, 66, 5.4, 2.6, 2.8, structMat, true, 0x34d399, true);
            addBlock( 16, 66, 5.4, 2.6, 2.8, structMat, true, 0x34d399, true);

            [[-72, 72, 'E'], [72, 72, 'W']].forEach(([tx, tz, rDir]) => {
                addBox(tx, 3.9, tz, 14, 0.6, 14, bridgeMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
                addBlock(tx - 5.8, tz - 5.8, 2.0, 4.0, 2.0, darkSteelMat, false, null, true);
                addBlock(tx + 5.8, tz - 5.8, 2.0, 4.0, 2.0, darkSteelMat, false, null, true);
                addBlock(tx - 5.8, tz + 5.8, 2.0, 4.0, 2.0, darkSteelMat, false, null, true);
                addBlock(tx + 5.8, tz + 5.8, 2.0, 4.0, 2.0, darkSteelMat, false, null, true);
                addBox(tx, 4.9, tz - 6.3, 12.6, 1.35, 0.9, bunkerMat, { jumpable: true, accent: 0x4ade80, navSolid: false });
                const rampX = rDir === 'E' ? tx + 13.5 : tx - 13.5;
                addRamp(rampX, tz, 6.2, 13, 0, 4.2, rDir === 'E' ? 'W' : 'E', 0x4ade80);
            });

            this._buildArmoryTerminal(0, 84, darkSteelMat);

            // TWO SHOOTABLE 3D WAVE TRIGGER BUTTONS (South Bastion + Central 2nd Floor!)
            this._buildWaveTriggerButton(0, 0, 58, darkSteelMat);
            this._buildWaveTriggerButton(0, 4.0, 22, darkSteelMat);

            // =================================================================
            // 8. 10 GRAV-JUMP PADS (INCLUDING 3RD FLOOR LAUNCHERS!)
            // =================================================================
            const padCoords = [
                { x: -16, z:  15, launchY: 17.5, launchZ: -11, launchX: 0 },
                { x:  16, z:  15, launchY: 17.5, launchZ: -11, launchX: 0 },
                { x: -16, z: -15, launchY: 17.5, launchZ: -12, launchX: 0 },
                { x:  16, z: -15, launchY: 17.5, launchZ: -12, launchX: 0 },
                { x: -56, z:  48, launchY: 18.5, launchZ: -14, launchX: 4 },
                { x:  56, z:  48, launchY: 18.5, launchZ: -14, launchX: -4 },
                { x: -72, z: -48, launchY: 17.5, launchZ: 12,  launchX: 6 },
                { x:  72, z: -48, launchY: 17.5, launchZ: 12,  launchX: -6 },
                { x: -38, z: -10, launchY: 22.0, launchZ: -6,  launchX: 8 },
                { x:  38, z: -10, launchY: 22.0, launchZ: -6,  launchX: -8 }
            ];
            padCoords.forEach(jp => {
                const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.25, 0.3, 18), darkSteelMat);
                base.position.set(jp.x, 0.15, jp.z);
                const glow = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 28), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
                glow.rotation.x = Math.PI / 2;
                glow.position.set(jp.x, 0.34, jp.z);
                this.scene.add(base, glow);
                this.jumpPads.push({ ...jp, cooldown: 0, glow });
            });

            // =================================================================
            // 9. STATIC SUPPLY STATIONS & BARRELS
            // =================================================================
            [
                { x: -64, z:   0, type: 'medkit', color: 0x4ade80 },
                { x:  64, z:   0, type: 'boost',  color: 0x38bdf8 },
                { x:   0, z:  68, type: 'ammo',   color: 0xfacc15 },
                { x: -30, z: -60, type: 'ammo',   color: 0xfacc15 },
                { x:  30, z: -60, type: 'shield', color: 0x34d399 },
                { x: -72, z:  72, type: 'ammo',   color: 0xfacc15 },
                { x:  72, z:  72, type: 'ammo',   color: 0xfacc15 },
                { x:   0, z: -40, type: 'boost',  color: 0x38bdf8 }
            ].forEach(p => {
                const padRing = new THREE.Mesh(
                    new THREE.CylinderGeometry(1.25, 1.45, 0.16, 18),
                    new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.45 })
                );
                padRing.position.set(p.x, 0.08, p.z);
                this.scene.add(padRing);
                this.staticPads.push({ ...p, respawnTimer: 0, activePickup: null });
            });

            [
                { x: -30, z: -72, kind: 'fire' },
                { x:  30, z: -72, kind: 'fire' },
                { x: -10, z: -58, kind: 'cryo' },
                { x:  10, z: -58, kind: 'cryo' },
                { x: -58, z: -24, kind: 'cryo' },
                { x:  58, z: -24, kind: 'fire' },
                { x: -24, z:  -4, kind: 'fire' },
                { x:  24, z:  -4, kind: 'cryo' },
                { x: -58, z:  22, kind: 'fire' },
                { x:  58, z:  22, kind: 'cryo' },
                { x: -14, z:  42, kind: 'fire' },
                { x:  14, z:  42, kind: 'cryo' }
            ].forEach(bs => this._createBarrel(bs.x, bs.z, bs.kind));

            this._buildLightingAndSky();
            this._buildNavGrid();
        }

        /**
         * Builds a reinforced Combat Pillbox (БОЕВОЙ ДОТ) with roof, rear entrance,
         * side armor walls, and a North-facing horizontal firing embrasure slit.
         */
        _buildPillbox(x, z, addBox, bunkerMat, darkSteelMat, accent) {
            // Armored roof (jumpable top at y=3.6, open interior up to y=3.0!)
            addBox(x, 3.3, z, 10.6, 0.6, 8.6, bunkerMat, { jumpable: true, accent, navSolid: false });
            // Left & Right side walls
            addBox(x - 4.7, 1.5, z, 1.2, 3.0, 8.2, bunkerMat, { jumpable: false, navSolid: true });
            addBox(x + 4.7, 1.5, z, 1.2, 3.0, 8.2, bunkerMat, { jumpable: false, navSolid: true });
            // Rear framing (leaves 4.2m wide doorway in center back!)
            addBox(x - 3.3, 1.5, z + 3.7, 2.8, 3.0, 1.0, darkSteelMat, { jumpable: false, navSolid: true });
            addBox(x + 3.3, 1.5, z + 3.7, 2.8, 3.0, 1.0, darkSteelMat, { jumpable: false, navSolid: true });
            // North Front Firing Embrasure: chest-high lower wall (0..1.35m) + upper lintel (2.35..3.0m)
            addBox(x, 0.675, z - 3.7, 9.2, 1.35, 1.0, darkSteelMat, { jumpable: true, accent, navSolid: true });
            addBox(x, 2.675, z - 3.7, 9.2, 0.65, 1.0, darkSteelMat, { jumpable: false, navSolid: false });

            // Animated spinning tactical radar dish on bunker roof
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), darkSteelMat);
            mast.position.set(x, 4.1, z);
            const dish = new THREE.Mesh(
                new THREE.BoxGeometry(1.6, 0.45, 0.25),
                new THREE.MeshBasicMaterial({ color: accent })
            );
            dish.position.set(x, 4.7, z);
            this.scene.add(mast, dish);
            this.decorSpinners.push(dish);
        }

        _buildWaveTriggerButton(x, baseY, z, darkSteelMat) {
            const g = new THREE.Group();
            g.position.set(x, baseY, z);

            const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, 1.3, 10), darkSteelMat);
            ped.position.y = 0.65;
            ped.castShadow = true;

            const orbMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), orbMat);
            orb.position.y = 2.45;
            orb.userData.isWaveButton = true;

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(1.18, 0.08, 8, 24),
                new THREE.MeshBasicMaterial({ color: 0x4ade80 })
            );
            ring.position.y = 2.45;
            ring.userData.isWaveButton = true;

            const beaconBeam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.55, 22, 10),
                new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.22 })
            );
            beaconBeam.position.y = 12;

            // Generous invisible hit sphere around target button so shooting it from across room feels crisp!
            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(1.35, 10, 10),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
            );
            hitSphere.position.y = 2.45;
            hitSphere.userData.isWaveButton = true;

            g.add(ped, orb, ring, beaconBeam, hitSphere);
            g.visible = false; // Shown only during Intermission between waves!
            this.scene.add(g);

            this.waveButtons.push({ x, y: baseY, z, group: g, orb, ring, beaconBeam });
            this.waveButtonMeshes.push(orb, ring, hitSphere);
        }

        setWaveButtonsVisible(visible) {
            for (const wb of this.waveButtons) {
                wb.group.visible = visible;
            }
        }

        _buildArmoredAPC(x, z, rotY, darkSteelMat, structMat) {
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            g.rotation.y = rotY;

            const hull = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.9, 8.2), structMat);
            hull.position.y = 1.15;
            hull.castShadow = true;
            hull.receiveShadow = true;
            g.add(hull);

            const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.85, 4.4), darkSteelMat);
            canopy.position.set(0, 2.35, -0.4);
            g.add(canopy);

            // Roof spinning remote autocannon turret cupola
            const turret = new THREE.Group();
            turret.position.set(0, 2.95, 0.2);
            const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.45, 10), structMat);
            const tGun = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 8), darkSteelMat);
            tGun.rotation.x = Math.PI / 2;
            tGun.position.z = 1.1;
            const tOptic = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
            tOptic.position.set(0.45, 0.12, 0.35);
            turret.add(tBase, tGun, tOptic);
            g.add(turret);
            this.decorSpinners.push(turret);

            // Sloped frontal armor glacis + twin cyan slit headlights
            const frontShield = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.1, 0.5), darkSteelMat);
            frontShield.position.set(0, 1.1, 4.15);
            frontShield.rotation.x = -0.35;
            g.add(frontShield);
            [-1.5, 1.5].forEach(lx => {
                const hl = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.2), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
                hl.position.set(lx, 1.45, 4.15);
                g.add(hl);
            });

            [-2.35, 2.35].forEach(sx => {
                [-2.6, 2.4].forEach(sz => {
                    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, 1.6, 10), darkSteelMat);
                    pod.rotation.x = Math.PI / 2;
                    pod.position.set(sx, 0.75, sz);
                    g.add(pod);
                });
            });

            const vent = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 1.2), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
            vent.position.set(0, 2.15, 2.8);
            g.add(vent);

            g.traverse(c => {
                if (c.isMesh) {
                    c.userData.isCover = true;
                    this.coverMeshes.push(c);
                }
            });
            this.scene.add(g);

            this.boxes.push({
                minX: x - 3.4, maxX: x + 3.4,
                minY: 0, maxY: 2.3,
                minZ: z - 4.4, maxZ: z + 4.4,
                jumpable: true, navSolid: true
            });
        }

        _buildCryoTank(x, z, addBlock, darkSteelMat) {
            addBlock(x, z, 3.0, 0.85, 3.0, darkSteelMat, true, 0x38bdf8, true);

            const glass = new THREE.Mesh(
                new THREE.CylinderGeometry(1.05, 1.05, 4.4, 16),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.34 })
            );
            glass.position.set(x, 3.05, z);
            glass.userData.isCover = true;
            this.coverMeshes.push(glass);

            const specimen = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 1), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
            specimen.position.set(x, 3.1, z);

            const holoHalo = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.06, 6, 20), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
            holoHalo.position.set(x, 3.1, z);
            holoHalo.rotation.x = Math.PI / 2.2;

            const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.6, 16), darkSteelMat);
            cap.position.set(x, 5.45, z);

            this.scene.add(glass, specimen, holoHalo, cap);
            this.decorSpinners.push(specimen, holoHalo);
            this.boxes.push({
                minX: x - 1.35, maxX: x + 1.35,
                minY: 0, maxY: 5.8,
                minZ: z - 1.35, maxZ: z + 1.35,
                jumpable: false, navSolid: true
            });
        }

        _buildRepairMech(x, z, darkSteelMat, cargoMat) {
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            g.rotation.y = -Math.PI / 2;

            const legL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.2, 1.2), darkSteelMat);
            legL.position.set(-1.1, 1.6, 0);
            const legR = legL.clone();
            legR.position.set(1.1, 1.6, 0);
            const torso = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 2.4), cargoMat);
            torso.position.set(0, 4.4, 0);
            const visor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.3), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
            visor.position.set(0, 4.8, 1.25);

            // Articulated crane arms + glowing plasma weld emitters + spinning reactor ring
            [-2.05, 2.05].forEach(ax => {
                const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.6, 0.9), darkSteelMat);
                arm.position.set(ax, 3.7, 0.45);
                arm.rotation.x = -0.38;
                const weldTip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 6), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
                weldTip.position.set(ax, 2.35, 1.15);
                weldTip.rotation.x = Math.PI * 0.72;
                g.add(arm, weldTip);
            });
            const coreSpin = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
            coreSpin.position.set(0, 3.8, 1.28);
            this.decorSpinners.push(coreSpin);

            g.add(legL, legR, torso, visor, coreSpin);
            g.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.userData.isCover = true;
                    this.coverMeshes.push(c);
                }
            });
            this.scene.add(g);
            this.boxes.push({
                minX: x - 2.2, maxX: x + 2.2,
                minY: 0, maxY: 5.8,
                minZ: z - 2.2, maxZ: z + 2.2,
                jumpable: false, navSolid: true
            });
        }

        _buildArmoryTerminal(x, z, darkSteelMat) {
            const g = new THREE.Group();
            g.position.set(x, 0, z);

            const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.5, 8), darkSteelMat);
            base.position.y = 0.25;
            const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.1), darkSteelMat);
            pedestal.position.y = 1.1;

            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(1.5, 0.9),
                new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
            );
            screen.position.set(0, 1.85, -0.45);
            screen.rotation.x = -0.35;

            const holo = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.65, 0),
                new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true })
            );
            holo.position.set(0, 2.9, 0);
            this.decorSpinners.push(holo);

            const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.52;

            const light = new THREE.PointLight(0x4ade80, 1.8, 18);
            light.position.set(0, 3.2, 0);

            g.add(base, pedestal, screen, holo, ring, light);
            this.scene.add(g);

            this.boxes.push({
                minX: x - 1.1, maxX: x + 1.1,
                minY: 0, maxY: 2.0,
                minZ: z - 0.8, maxZ: z + 0.8,
                jumpable: false, navSolid: true
            });

            this.armoryTerminal = { x, z, radius: 5.8, holo };
        }

        _createBarrel(x, z, kind) {
            const color = kind === 'cryo' ? 0x38bdf8 : 0xef4444;
            const stripeColor = kind === 'cryo' ? 0xe0f2fe : 0xfacc15;
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.68, 0.72, 1.65, 12),
                new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 })
            );
            body.position.y = 0.825;
            body.castShadow = true;
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.73, 0.73, 0.32, 12), new THREE.MeshBasicMaterial({ color: stripeColor }));
            stripe.position.y = 0.85;
            const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.055, 6, 14), darkMatPlaceholder());
            topRim.rotation.x = Math.PI / 2;
            topRim.position.y = 1.65;
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 8), new THREE.MeshBasicMaterial({ color: stripeColor }));
            cap.position.set(0.32, 1.7, 0);
            group.add(body, stripe, topRim, cap);

            function darkMatPlaceholder() {
                return new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.85 });
            }

            const barrelObj = { x, z, kind, group, hp: 35, alive: true };
            group.traverse(c => {
                if (c.isMesh) c.userData.barrel = barrelObj;
            });

            this.scene.add(group);
            this.barrels.push(barrelObj);
        }

        resetBarrels() {
            for (const b of this.barrels) {
                b.alive = true;
                b.hp = 35;
                b.group.visible = true;
            }
        }

        _buildLightingAndSky() {
            this.scene.add(new THREE.HemisphereLight(0x9be7c4, 0x0a1a14, 0.88));

            const dirLight = new THREE.DirectionalLight(0xdfffe8, 1.25);
            dirLight.position.set(52, 84, 42);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.bias = -0.0004;
            dirLight.shadow.normalBias = 0.035;
            dirLight.shadow.camera.near = 10;
            dirLight.shadow.camera.far = 250;
            const d = 108;
            dirLight.shadow.camera.left = -d;
            dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d;
            dirLight.shadow.camera.bottom = -d;
            this.scene.add(dirLight);

            // Cool opposing rim/fill directional light to define 3D silhouettes on shadow sides
            const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.44);
            fillLight.position.set(-56, 38, -52);
            this.scene.add(fillLight);

            // Balanced elevated sector lights (high placement + controlled intensity prevent floor whiteouts)
            [
                { color: 0x34d399, x: 0, y: 14, z: 0, dist: 64, int: 1.45 },
                { color: 0x38bdf8, x: -64, y: 12, z: -6, dist: 62, int: 1.25 },
                { color: 0xf59e0b, x: 64, y: 12, z: -6, dist: 62, int: 1.25 },
                { color: 0xfb7185, x: -24, y: 12, z: -84, dist: 64, int: 1.2 },
                { color: 0xfb7185, x: 24, y: 12, z: -84, dist: 64, int: 1.2 },
                { color: 0x4ade80, x: 0, y: 11, z: 72, dist: 56, int: 1.2 },
                { color: 0x6ee7b7, x: -42, y: 8.5, z: -38, dist: 38, int: 0.9 },
                { color: 0xfbbf24, x: 42, y: 8.5, z: -38, dist: 38, int: 0.9 }
            ].forEach(l => {
                const pt = new THREE.PointLight(l.color, l.int, l.dist, 1.4);
                pt.position.set(l.x, l.y, l.z);
                this.scene.add(pt);
            });

            // Architectural illuminated sconces on perimeter walls & citadel corners
            const sconceMat = new THREE.MeshStandardMaterial({ color: 0x0b1612, roughness: 0.4, metalness: 0.8 });
            const emMint = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
            const emAmber = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
            const emRose = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
            [
                { x: -72, y: 9.2, z: -93.1, mat: emRose },
                { x: 0, y: 9.2, z: -93.1, mat: emRose },
                { x: 72, y: 9.2, z: -93.1, mat: emRose },
                { x: -60, y: 9.2, z: 93.1, mat: emMint },
                { x: 60, y: 9.2, z: 93.1, mat: emMint },
                { x: -93.1, y: 9.2, z: -46, mat: emMint, rotY: Math.PI / 2 },
                { x: -93.1, y: 9.2, z: 46, mat: emMint, rotY: Math.PI / 2 },
                { x: 93.1, y: 9.2, z: -46, mat: emAmber, rotY: Math.PI / 2 },
                { x: 93.1, y: 9.2, z: 46, mat: emAmber, rotY: Math.PI / 2 }
            ].forEach(sc => {
                const g = new THREE.Group();
                g.position.set(sc.x, sc.y, sc.z);
                if (sc.rotY) g.rotation.y = sc.rotY;
                const housing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 0.5), sconceMat);
                const bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 0.56), sc.mat);
                g.add(housing, bar);
                this.scene.add(g);
            });

            // Textured Atmospheric Sky Dome (aurora horizon + megastructure skyline + nebula)
            const skyTex = XB.Textures.createSkyDomeTexture();
            const skyDome = new THREE.Mesh(
                new THREE.SphereGeometry(320, 32, 24),
                new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
            );
            this.scene.add(skyDome);

            const starCount = 950;
            const starPos = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI * 0.44;
                const r = 215 + Math.random() * 55;
                starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                starPos[i * 3 + 1] = r * Math.cos(phi) + 16;
                starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            }
            const starGeo = new THREE.BufferGeometry();
            starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
            this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd1fae5, size: 0.95, fog: false })));

            const planetTex = XB.Textures.createPlanetTexture();
            const planet = new THREE.Mesh(
                new THREE.SphereGeometry(31, 32, 32),
                new THREE.MeshBasicMaterial({ map: planetTex, fog: false })
            );
            planet.position.set(-96, 78, -172);
            this.scene.add(planet);

            const planetRing = new THREE.Mesh(
                new THREE.RingGeometry(37, 54, 56),
                new THREE.MeshBasicMaterial({ color: 0x6ee7b7, side: THREE.DoubleSide, transparent: true, opacity: 0.28, fog: false })
            );
            planetRing.position.copy(planet.position);
            planetRing.rotation.set(Math.PI / 2.35, 0.32, 0.18);
            this.scene.add(planetRing);

            const planetOuterRing = new THREE.Mesh(
                new THREE.RingGeometry(56, 62, 56),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.16, fog: false })
            );
            planetOuterRing.position.copy(planet.position);
            planetOuterRing.rotation.copy(planetRing.rotation);
            this.scene.add(planetOuterRing);
        }

        _buildNavGrid() {
            this.navBlocked.fill(0);
            const pad = 0.75;
            for (let gz = 0; gz < this.NAV_DIM; gz++) {
                const wz = -this.NAV_HALF + (gz + 0.5) * this.NAV_CELL;
                for (let gx = 0; gx < this.NAV_DIM; gx++) {
                    const wx = -this.NAV_HALF + (gx + 0.5) * this.NAV_CELL;
                    if (Math.abs(wx) > 91 || Math.abs(wz) > 91) {
                        this.navBlocked[gz * this.NAV_DIM + gx] = 1;
                        continue;
                    }
                    for (const b of this.boxes) {
                        if (!b.navSolid) continue;
                        if (wx >= b.minX - pad && wx <= b.maxX + pad &&
                            wz >= b.minZ - pad && wz <= b.maxZ + pad) {
                            this.navBlocked[gz * this.NAV_DIM + gx] = 1;
                            break;
                        }
                    }
                }
            }
        }

        worldToNav(wx, wz) {
            const gx = Math.max(0, Math.min(this.NAV_DIM - 1, Math.floor((wx + this.NAV_HALF) / this.NAV_CELL)));
            const gz = Math.max(0, Math.min(this.NAV_DIM - 1, Math.floor((wz + this.NAV_HALF) / this.NAV_CELL)));
            return { gx, gz };
        }

        computeFlowField(targetX, targetZ) {
            const dim = this.NAV_DIM;
            this.flowDist.fill(-1);
            this.flowDirX.fill(0);
            this.flowDirZ.fill(0);

            let { gx, gz } = this.worldToNav(targetX, targetZ);
            if (this.navBlocked[gz * dim + gx]) {
                let found = false;
                for (let r = 1; r <= 4 && !found; r++) {
                    for (let dz = -r; dz <= r && !found; dz++) {
                        for (let dx = -r; dx <= r && !found; dx++) {
                            const nx = gx + dx;
                            const nz = gz + dz;
                            if (nx >= 0 && nx < dim && nz >= 0 && nz < dim && !this.navBlocked[nz * dim + nx]) {
                                gx = nx; gz = nz; found = true;
                            }
                        }
                    }
                }
            }

            const startIdx = gz * dim + gx;
            this.flowDist[startIdx] = 0;
            let head = 0;
            let tail = 0;
            this._bfsQueue[tail++] = startIdx;

            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
            while (head < tail) {
                const idx = this._bfsQueue[head++];
                const cx = idx % dim;
                const cz = (idx / dim) | 0;
                const baseD = this.flowDist[idx];
                for (let d = 0; d < 8; d++) {
                    const ox = dirs[d][0];
                    const oz = dirs[d][1];
                    const nx = cx + ox;
                    const nz = cz + oz;
                    if (nx < 0 || nx >= dim || nz < 0 || nz >= dim) continue;
                    const nIdx = nz * dim + nx;
                    if (this.navBlocked[nIdx] || this.flowDist[nIdx] !== -1) continue;
                    if (ox !== 0 && oz !== 0) {
                        if (this.navBlocked[cz * dim + nx] || this.navBlocked[nz * dim + cx]) continue;
                    }
                    this.flowDist[nIdx] = baseD + (ox !== 0 && oz !== 0 ? 14 : 10);
                    this._bfsQueue[tail++] = nIdx;
                }
            }

            for (let z = 0; z < dim; z++) {
                for (let x = 0; x < dim; x++) {
                    const idx = z * dim + x;
                    const curD = this.flowDist[idx];
                    if (curD <= 0) continue;
                    let bestD = curD;
                    let vx = 0, vz = 0;
                    for (let d = 0; d < 8; d++) {
                        const nx = x + dirs[d][0];
                        const nz = z + dirs[d][1];
                        if (nx < 0 || nx >= dim || nz < 0 || nz >= dim) continue;
                        const nd = this.flowDist[nz * dim + nx];
                        if (nd !== -1 && nd < bestD) {
                            bestD = nd; vx = dirs[d][0]; vz = dirs[d][1];
                        }
                    }
                    const len = Math.hypot(vx, vz);
                    if (len > 0) {
                        this.flowDirX[idx] = vx / len;
                        this.flowDirZ[idx] = vz / len;
                    }
                }
            }
        }

        sampleFlowDirection(wx, wz, outVec) {
            const { gx, gz } = this.worldToNav(wx, wz);
            const idx = gz * this.NAV_DIM + gx;
            const fx = this.flowDirX[idx];
            const fz = this.flowDirZ[idx];
            if (fx !== 0 || fz !== 0) {
                outVec.set(fx, 0, fz);
                return true;
            }
            return false;
        }

        hasLineOfSight(ax, ay, az, bx, by, bz, checkEnemyShieldsOnly = false) {
            return !this.segmentHitsObstacle(ax, ay, az, bx, by, bz, {
                checkEnemyBlock: true,
                includeShieldScreens: checkEnemyShieldsOnly
            }).hit;
        }

        _segmentHitsAABB(ax, ay, az, dx, dy, dz, b, expand = 0) {
            let tmin = 0.0;
            let tmax = 1.0;

            const minX = b.minX - expand;
            const maxX = b.maxX + expand;
            const minY = b.minY - expand;
            const maxY = b.maxY + expand;
            const minZ = b.minZ - expand;
            const maxZ = b.maxZ + expand;

            if (Math.abs(dx) < 1e-7) {
                if (ax < minX || ax > maxX) return -1;
            } else {
                let t1 = (minX - ax) / dx;
                let t2 = (maxX - ax) / dx;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tmin = Math.max(tmin, t1);
                tmax = Math.min(tmax, t2);
                if (tmin > tmax) return -1;
            }

            if (Math.abs(dy) < 1e-7) {
                if (ay < minY || ay > maxY) return -1;
            } else {
                let t1 = (minY - ay) / dy;
                let t2 = (maxY - ay) / dy;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tmin = Math.max(tmin, t1);
                tmax = Math.min(tmax, t2);
                if (tmin > tmax) return -1;
            }

            if (Math.abs(dz) < 1e-7) {
                if (az < minZ || az > maxZ) return -1;
            } else {
                let t1 = (minZ - az) / dz;
                let t2 = (maxZ - az) / dz;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tmin = Math.max(tmin, t1);
                tmax = Math.min(tmax, t2);
                if (tmin > tmax) return -1;
            }

            return (tmin >= 0 && tmin <= 1) ? tmin : -1;
        }

        /**
         * Exact Continuous Collision Detection (CCD) segment intersection against ALL static & dynamic
         * walls, buildings, bunkers, and ramps. Prevents bullet tunneling & wall shooting!
         */
        segmentHitsObstacle(ax, ay, az, bx, by, bz, opts = {}) {
            const {
                expand = 0,
                isEnemyProjectile = false,
                checkEnemyBlock = false,
                includeShieldScreens = isEnemyProjectile
            } = opts;

            const dx = bx - ax;
            const dy = by - ay;
            const dz = bz - az;

            let bestT = 2.0;
            let bestBox = null;

            const testBoxList = (list) => {
                for (const b of list) {
                    if (b.playerOnly || b.isTurretBox) continue;
                    if (b.playerPassable && !checkEnemyBlock && !isEnemyProjectile) continue;
                    if (b.isShieldScreen) {
                        if (!includeShieldScreens) continue;
                    }
                    const t = this._segmentHitsAABB(ax, ay, az, dx, dy, dz, b, expand);
                    if (t >= 0 && t < bestT) {
                        bestT = t;
                        bestBox = b;
                    }
                }
            };

            testBoxList(this.boxes);
            testBoxList(this.dynamicBoxes);

            // Check Ramps via fine samples (ramps are diagonal prisms)
            const dist = Math.hypot(dx, dy, dz);
            const steps = Math.max(3, Math.ceil(dist / 0.8));
            const allRamps = this.dynamicRamps.length > 0 ? this.ramps.concat(this.dynamicRamps) : this.ramps;
            for (const r of allRamps) {
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    if (t >= bestT) break;
                    const px = ax + dx * t;
                    const py = ay + dy * t;
                    const pz = az + dz * t;
                    if (px >= r.minX && px <= r.maxX && pz >= r.minZ && pz <= r.maxZ) {
                        const rt = r.axis === 'z'
                            ? (pz - r.minZ) / (r.maxZ - r.minZ)
                            : (px - r.minX) / (r.maxX - r.minX);
                        const surfY = r.yAtMin + (r.yAtMax - r.yAtMin) * Math.max(0, Math.min(1, rt));
                        if (py <= surfY + expand && py >= (r.yBase || 0) - 0.15) {
                            bestT = t;
                            bestBox = r;
                            break;
                        }
                    }
                }
            }

            if (bestT <= 1.0) {
                return {
                    hit: true,
                    t: bestT,
                    box: bestBox,
                    point: new THREE.Vector3(ax + dx * bestT, ay + dy * bestT, az + dz * bestT)
                };
            }
            return { hit: false, t: 1.0, box: null, point: null };
        }

        pointInsideObstacle(p, opts = {}) {
            const { includeShieldScreens = false } = opts;
            const checkBoxes = (list) => {
                for (const b of list) {
                    if (b.playerOnly || b.playerPassable || b.isTurretBox) continue;
                    if (b.isShieldScreen && !includeShieldScreens) continue;
                    if (p.x >= b.minX && p.x <= b.maxX &&
                        p.y >= b.minY && p.y <= b.maxY &&
                        p.z >= b.minZ && p.z <= b.maxZ) {
                        return true;
                    }
                }
                return false;
            };
            if (checkBoxes(this.boxes) || checkBoxes(this.dynamicBoxes)) return true;

            const allRamps = this.dynamicRamps.length > 0 ? this.ramps.concat(this.dynamicRamps) : this.ramps;
            for (const r of allRamps) {
                if (p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ) {
                    const t = r.axis === 'z'
                        ? (p.z - r.minZ) / (r.maxZ - r.minZ)
                        : (p.x - r.minX) / (r.maxX - r.minX);
                    const surfaceY = r.yAtMin + (r.yAtMax - r.yAtMin) * Math.max(0, Math.min(1, t));
                    if (p.y <= surfaceY && p.y >= (r.yBase || 0)) return true;
                }
            }
            return false;
        }

        getFloorHeightAt(x, z, currentY) {
            let floorY = 0;
            const checkRamps = (list) => {
                for (const r of list) {
                    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
                        const t = r.axis === 'z'
                            ? (z - r.minZ) / (r.maxZ - r.minZ)
                            : (x - r.minX) / (r.maxX - r.minX);
                        const ry = r.yAtMin + (r.yAtMax - r.yAtMin) * Math.max(0, Math.min(1, t));
                        if (ry <= currentY + 0.85 && ry > floorY) {
                            floorY = ry;
                        }
                    }
                }
            };
            checkRamps(this.ramps);
            checkRamps(this.dynamicRamps);

            const checkBoxes = (list) => {
                for (const b of list) {
                    if (b.jumpable && !b.isShieldScreen && x >= b.minX - 0.35 && x <= b.maxX + 0.35 && z >= b.minZ - 0.35 && z <= b.maxZ + 0.35) {
                        if (currentY >= b.maxY - 0.55 && b.maxY > floorY) {
                            floorY = b.maxY;
                        }
                    }
                }
            };
            checkBoxes(this.boxes);
            checkBoxes(this.dynamicBoxes);
            return floorY;
        }

        clearDynamicStructures() {
            this.dynamicBoxes = [];
            this.dynamicRamps = [];
            this.dynamicCoverMeshes = [];
            this._buildNavGrid();
        }

        refreshNavWithDynamics() {
            this._buildNavGrid();
            const pad = 0.65;
            for (const b of this.dynamicBoxes) {
                if (!b.navSolid) continue;
                const minGx = Math.max(0, Math.floor((b.minX - pad + this.NAV_HALF) / this.NAV_CELL));
                const maxGx = Math.min(this.NAV_DIM - 1, Math.floor((b.maxX + pad + this.NAV_HALF) / this.NAV_CELL));
                const minGz = Math.max(0, Math.floor((b.minZ - pad + this.NAV_HALF) / this.NAV_CELL));
                const maxGz = Math.min(this.NAV_DIM - 1, Math.floor((b.maxZ + pad + this.NAV_HALF) / this.NAV_CELL));
                for (let gz = minGz; gz <= maxGz; gz++) {
                    for (let gx = minGx; gx <= maxGx; gx++) {
                        this.navBlocked[gz * this.NAV_DIM + gx] = 1;
                    }
                }
            }
        }
    }

    XB.MapBuilder = MapBuilder;
})(window);
