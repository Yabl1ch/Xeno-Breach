/**
 * External CC0 / MIT Asset Registry & Async Normalizer for XENO-BREACH 3D.
 * Handles GLB weapons, rigged animated robots, turrets, and Poly Haven PBR textures
 * with synchronous procedural fallbacks and structured logging (never blocks startup).
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    const logWarn = (scope, msg, err) => {
        if (XB.log && typeof XB.log.warn === 'function') {
            XB.log.warn(scope, msg, err);
        }
    };

    const WEAPON_MODELS = {
        rifle: {
            path: 'assets/models/weapons/AR_1.glb',
            targetLength: 0.92,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.34]
        },
        shotgun: {
            path: 'assets/models/weapons/Shotgun_1.glb',
            targetLength: 0.98,
            yaw: Math.PI / 2,
            offset: [0, -0.01, -0.36]
        },
        polymer_beam: {
            path: 'assets/models/weapons/Grenade_2.glb',
            targetLength: 0.94,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.36]
        },
        nova: {
            path: 'assets/models/weapons/Crossbow_1.glb',
            targetLength: 0.88,
            yaw: Math.PI / 2,
            offset: [0, -0.01, -0.34]
        },
        smg: {
            path: 'assets/models/weapons/SMG_2.glb',
            targetLength: 0.82,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.30]
        },
        flamer: {
            path: 'assets/models/weapons/Grenade_1.glb',
            targetLength: 0.95,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.35]
        },
        railgun: {
            path: 'assets/models/weapons/AR_4.glb',
            targetLength: 1.02,
            yaw: Math.PI / 2,
            offset: [0, -0.01, -0.38]
        },
        tesla: {
            path: 'assets/models/weapons/AR_3.glb',
            targetLength: 0.92,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.34]
        },
        cryo_launcher: {
            path: 'assets/models/weapons/Grenade_3.glb',
            targetLength: 0.96,
            yaw: -Math.PI / 2,
            offset: [0, -0.02, -0.35]
        },
        hydra: {
            path: 'assets/models/weapons/AR_2.glb',
            targetLength: 0.96,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.35]
        },
        scar_h: {
            path: 'assets/models/weapons/AR_6.glb',
            targetLength: 0.98,
            yaw: Math.PI / 2,
            offset: [0, -0.02, -0.36]
        },
        vss_vintorez: {
            path: 'assets/models/weapons/Sniper_1.glb',
            targetLength: 1.06,
            yaw: Math.PI / 2,
            offset: [0, -0.01, -0.40]
        },
        awp_arctic: {
            path: 'assets/models/weapons/Sniper_3.glb',
            targetLength: 1.18,
            yaw: Math.PI / 2,
            offset: [0, -0.01, -0.44]
        },
        barrett_m82: {
            path: 'assets/models/weapons/Sniper_2.glb',
            targetLength: 1.24,
            yaw: Math.PI / 2,
            offset: [0, -0.01, -0.48]
        }
    };

    const ENEMY_MODELS = {
        scout: {
            path: 'assets/models/enemies/Enemy_2Legs.glb',
            targetMaxDim: 1.95,
            yHover: 0.0,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Run', 'CharacterArmature|Walk'],
                attack: ['CharacterArmature|Attack'],
                death: ['CharacterArmature|Death']
            }
        },
        leaper: {
            path: 'assets/models/enemies/Enemy_Flying.glb',
            targetMaxDim: 1.95,
            yHover: 0.95,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Run', 'CharacterArmature|Walk'],
                attack: ['CharacterArmature|Attack'],
                death: ['CharacterArmature|Dead', 'CharacterArmature|Death']
            }
        },
        shieldbearer: {
            path: 'assets/models/enemies/RobotExpressive.glb',
            targetHeight: 2.15,
            yHover: 0.0,
            yaw: 0,
            clips: {
                idle: ['Idle'],
                move: ['Walking', 'Running'],
                attack: ['Punch'],
                death: ['Death']
            }
        },
        spitter: {
            path: 'assets/models/enemies/Enemy_2Legs_Gun.glb',
            targetMaxDim: 2.10,
            yHover: 0.0,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Walk', 'CharacterArmature|Run'],
                attack: ['CharacterArmature|Shoot', 'CharacterArmature|Attack'],
                death: ['CharacterArmature|Death']
            }
        },
        sniper: {
            path: 'assets/models/enemies/Enemy_Flying_Gun.glb',
            targetMaxDim: 2.05,
            yHover: 1.05,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Run', 'CharacterArmature|Walk'],
                attack: ['CharacterArmature|Shoot', 'CharacterArmature|Attack'],
                death: ['CharacterArmature|Dead', 'CharacterArmature|Death']
            }
        },
        grenadier: {
            path: 'assets/models/enemies/Enemy_Large_Gun.glb',
            targetHeight: 1.75,
            yHover: 0.0,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Walk', 'CharacterArmature|Run'],
                attack: ['CharacterArmature|Shoot', 'CharacterArmature|Attack'],
                death: ['CharacterArmature|Death']
            }
        },
        brute: {
            path: 'assets/models/enemies/Enemy_Large.glb',
            targetHeight: 1.55,
            yHover: 0.0,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Run', 'CharacterArmature|Walk'],
                attack: ['CharacterArmature|Attack', 'CharacterArmature|Attack.001'],
                death: ['CharacterArmature|Death']
            }
        },
        overlord: {
            path: 'assets/models/enemies/Enemy_Large_Gun.glb',
            targetHeight: 1.65,
            yHover: 0.0,
            yaw: 0,
            clips: {
                idle: ['CharacterArmature|Idle'],
                move: ['CharacterArmature|Walk', 'CharacterArmature|Run'],
                attack: ['CharacterArmature|Attack.001', 'CharacterArmature|Shoot'],
                death: ['CharacterArmature|Death']
            }
        }
    };

    const TURRET_MODELS = {
        gatling: {
            path: 'assets/models/turrets/Turret_GunDouble.glb',
            baseNode: 'Turret_GunDouble_Base',
            topNode: 'Turret_GunDouble_Top',
            targetSize: 1.65
        },
        polymer: {
            path: 'assets/models/turrets/Turret_Cannon.glb',
            baseNode: 'Turret_Cannon_Base',
            topNode: 'Turret_Cannon_Top',
            targetSize: 1.60
        }
    };

    const PBR_TEXTURES = {
        floor: {
            diff: 'assets/textures/floor/diff.jpg',
            nor: 'assets/textures/floor/nor.jpg',
            rough: 'assets/textures/floor/rough.jpg'
        },
        wall: {
            diff: 'assets/textures/wall/diff.jpg',
            nor: 'assets/textures/wall/nor.jpg',
            rough: 'assets/textures/wall/rough.jpg'
        },
        struct: {
            diff: 'assets/textures/struct/diff.jpg',
            nor: 'assets/textures/struct/nor.jpg',
            rough: 'assets/textures/struct/rough.jpg'
        },
        bunker: {
            diff: 'assets/textures/bunker/diff.jpg',
            nor: 'assets/textures/bunker/nor.jpg',
            rough: 'assets/textures/bunker/rough.jpg'
        },
        grate: {
            diff: 'assets/textures/grate/diff.jpg',
            nor: 'assets/textures/grate/nor.jpg',
            rough: 'assets/textures/grate/rough.jpg'
        }
    };

    const _gltfCache = new Map();
    const _texCache = new Map();
    let _gltfLoader = null;
    let _texLoader = null;

    function isGltfSupported() {
        return typeof THREE !== 'undefined' &&
               typeof THREE.GLTFLoader === 'function' &&
               typeof global.fetch === 'function';
    }

    function isTextureLoaderSupported() {
        return typeof THREE !== 'undefined' &&
               typeof THREE.TextureLoader === 'function' &&
               typeof global.document !== 'undefined';
    }

    function _getGltfLoader() {
        if (!_gltfLoader && isGltfSupported()) {
            _gltfLoader = new THREE.GLTFLoader();
        }
        return _gltfLoader;
    }

    function _getTexLoader() {
        if (!_texLoader && isTextureLoaderSupported()) {
            _texLoader = new THREE.TextureLoader();
        }
        return _texLoader;
    }

    function loadGltf(path) {
        if (!path || !isGltfSupported()) {
            return Promise.resolve(null);
        }
        if (_gltfCache.has(path)) {
            return _gltfCache.get(path);
        }
        const loader = _getGltfLoader();
        const promise = new Promise((resolve) => {
            try {
                loader.load(
                    path,
                    (gltf) => resolve(gltf),
                    undefined,
                    (err) => {
                        logWarn('Assets', `Failed to load GLB "${path}", using procedural fallback`, err);
                        resolve(null);
                    }
                );
            } catch (err) {
                logWarn('Assets', `Sync error starting GLB load "${path}"`, err);
                resolve(null);
            }
        });
        _gltfCache.set(path, promise);
        return promise;
    }

    function _loadTextureCached(path, repeatX, repeatY, isColor, maxAniso) {
        const key = `${path}|${repeatX}|${repeatY}|${isColor ? 1 : 0}`;
        if (_texCache.has(key)) return _texCache.get(key);
        const loader = _getTexLoader();
        if (!loader) return Promise.resolve(null);

        const promise = new Promise((resolve) => {
            try {
                loader.load(
                    path,
                    (tex) => {
                        tex.wrapS = THREE.RepeatWrapping;
                        tex.wrapT = THREE.RepeatWrapping;
                        if (repeatX !== undefined && repeatY !== undefined) {
                            tex.repeat.set(repeatX, repeatY);
                        }
                        if (isColor && typeof THREE.sRGBEncoding !== 'undefined') {
                            tex.encoding = THREE.sRGBEncoding;
                        }
                        if (maxAniso && typeof tex.anisotropy !== 'undefined') {
                            tex.anisotropy = maxAniso;
                        }
                        tex.needsUpdate = true;
                        resolve(tex);
                    },
                    undefined,
                    (err) => {
                        logWarn('Assets', `Failed to load texture "${path}", keeping procedural map`, err);
                        resolve(null);
                    }
                );
            } catch (err) {
                logWarn('Assets', `Sync error loading texture "${path}"`, err);
                resolve(null);
            }
        });
        _texCache.set(key, promise);
        return promise;
    }

    function _cloneWithUniqueMaterials(root) {
        const clone = (typeof THREE.SkeletonUtils === 'object' && typeof THREE.SkeletonUtils.clone === 'function')
            ? THREE.SkeletonUtils.clone(root)
            : root.clone(true);
        const clonedMats = [];
        clone.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.isSkinnedMesh) {
                // Prevent r128 frustum culling from hiding SkinnedMeshes whose unscaled bind boundingSphere is tiny
                node.frustumCulled = false;
            }
            if (Array.isArray(node.material)) {
                node.material = node.material.map((m) => {
                    const c = m && typeof m.clone === 'function' ? m.clone() : m;
                    if (c) clonedMats.push(c);
                    return c;
                });
            } else if (node.material && typeof node.material.clone === 'function') {
                node.material = node.material.clone();
                clonedMats.push(node.material);
            }
        });
        return { clone, materials: clonedMats };
    }

    /**
     * Scales, rotates, and centers/grounds an imported 3D root inside a clean outer Group.
     */
    function normalizeModel(rawRoot, opts = {}) {
        const pivot = new THREE.Group();
        const wrapper = new THREE.Group();
        wrapper.add(rawRoot);
        if (opts.yaw) wrapper.rotation.y = opts.yaw;
        pivot.add(wrapper);
        pivot.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(pivot);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        let scale = 1;
        if (opts.targetLength && size.z > 0.0001) {
            scale = opts.targetLength / size.z;
        } else if (opts.targetHeight && size.y > 0.0001) {
            scale = opts.targetHeight / size.y;
        } else if (opts.targetMaxDim) {
            const maxD = Math.max(size.x, size.y, size.z);
            if (maxD > 0.0001) scale = opts.targetMaxDim / maxD;
        }
        if (!Number.isFinite(scale) || scale <= 0) scale = 1;
        wrapper.scale.setScalar(scale);

        if (opts.centerXZ !== false) {
            wrapper.position.x = -center.x * scale;
            wrapper.position.z = -center.z * scale;
        }
        if (opts.alignBottom) {
            wrapper.position.y = -box.min.y * scale + (opts.yHover || 0);
        } else if (opts.centerY) {
            wrapper.position.y = -center.y * scale;
        }

        pivot.updateMatrixWorld(true);
        return pivot;
    }

    async function instantiateWeapon(weaponId) {
        const spec = WEAPON_MODELS[weaponId];
        if (!spec) return null;
        const gltf = await loadGltf(spec.path);
        if (!gltf || !gltf.scene) return null;

        const { clone, materials } = _cloneWithUniqueMaterials(gltf.scene);
        materials.forEach((m) => {
            if ('metalness' in m && m.metalness < 0.25) m.metalness = 0.55;
            if ('roughness' in m && m.roughness > 0.65) m.roughness = 0.36;
        });

        const pivot = normalizeModel(clone, {
            targetLength: spec.targetLength,
            yaw: spec.yaw,
            centerXZ: true,
            centerY: true
        });
        if (spec.offset) {
            pivot.position.set(spec.offset[0], spec.offset[1], spec.offset[2]);
        }
        return pivot;
    }

    async function instantiateEnemy(type) {
        const spec = ENEMY_MODELS[type];
        if (!spec) return null;
        const gltf = await loadGltf(spec.path);
        if (!gltf || !gltf.scene) return null;

        const { clone, materials } = _cloneWithUniqueMaterials(gltf.scene);
        const pivot = normalizeModel(clone, {
            targetHeight: spec.targetHeight,
            targetMaxDim: spec.targetMaxDim,
            yaw: spec.yaw || 0,
            centerXZ: true,
            alignBottom: true,
            yHover: spec.yHover || 0
        });

        const baseEmissives = materials.map((m) => ({
            mat: m,
            emissiveHex: m.emissive ? m.emissive.getHex() : 0x000000,
            emissiveIntensity: m.emissiveIntensity || 0
        }));

        return {
            visualRoot: pivot,
            animations: gltf.animations || [],
            clipMap: spec.clips || {},
            materialStates: baseEmissives
        };
    }

    async function instantiateTurret(kind) {
        const spec = TURRET_MODELS[kind];
        if (!spec) return null;
        const gltf = await loadGltf(spec.path);
        if (!gltf || !gltf.scene) return null;

        const { clone, materials } = _cloneWithUniqueMaterials(gltf.scene);
        materials.forEach((m) => {
            if ('metalness' in m && m.metalness < 0.3) m.metalness = 0.65;
            if ('roughness' in m && m.roughness > 0.65) m.roughness = 0.35;
        });

        clone.updateMatrixWorld(true);
        const fullBox = new THREE.Box3().setFromObject(clone);
        const fullSize = new THREE.Vector3();
        fullBox.getSize(fullSize);
        const maxD = Math.max(fullSize.x, fullSize.z, 0.001);
        const scale = spec.targetSize / maxD;

        const baseSrc = clone.getObjectByName(spec.baseNode);
        const topSrc = clone.getObjectByName(spec.topNode);
        if (!baseSrc || !topSrc) {
            const unified = normalizeModel(clone, {
                targetMaxDim: spec.targetSize,
                centerXZ: true,
                alignBottom: true
            });
            return { baseObj: unified, topObj: null };
        }

        const baseWrap = new THREE.Group();
        baseWrap.add(baseSrc);
        baseWrap.scale.setScalar(scale);
        baseWrap.position.y = -fullBox.min.y * scale;

        const topWrap = new THREE.Group();
        topWrap.add(topSrc);
        topWrap.scale.setScalar(scale);
        topWrap.position.y = -fullBox.min.y * scale;

        return { baseObj: baseWrap, topObj: topWrap };
    }

    function applyExternalPBRToMaterial(mat, setKey, repeatX, repeatY, opts = {}) {
        const spec = PBR_TEXTURES[setKey];
        if (!spec || !mat || !isTextureLoaderSupported()) return;

        const maxAniso = opts.maxAniso || 4;
        Promise.all([
            _loadTextureCached(spec.diff, repeatX, repeatY, true, maxAniso),
            _loadTextureCached(spec.nor, repeatX, repeatY, false, maxAniso),
            _loadTextureCached(spec.rough, repeatX, repeatY, false, maxAniso)
        ]).then(([diffTex, norTex, roughTex]) => {
            if (!diffTex && !norTex && !roughTex) return;
            if (diffTex) mat.map = diffTex;
            if (norTex) {
                mat.bumpMap = null;
                mat.normalMap = norTex;
                if (mat.normalScale && typeof mat.normalScale.set === 'function') {
                    const ns = opts.normalScale !== undefined ? opts.normalScale : 1.0;
                    mat.normalScale.set(ns, ns);
                }
            }
            if (roughTex) mat.roughnessMap = roughTex;
            if (opts.tintHex !== undefined && mat.color && typeof mat.color.setHex === 'function') {
                mat.color.setHex(opts.tintHex);
            }
            mat.needsUpdate = true;
        }).catch((err) => {
            logWarn('Assets', `Failed applying PBR maps for "${setKey}"`, err);
        });
    }

    function preloadAll() {
        if (!isGltfSupported()) return;
        const uniquePaths = new Set();
        Object.values(WEAPON_MODELS).forEach(s => uniquePaths.add(s.path));
        Object.values(ENEMY_MODELS).forEach(s => uniquePaths.add(s.path));
        Object.values(TURRET_MODELS).forEach(s => uniquePaths.add(s.path));
        uniquePaths.forEach(p => { loadGltf(p); });
    }

    XB.Assets = {
        WEAPON_MODELS,
        ENEMY_MODELS,
        TURRET_MODELS,
        PBR_TEXTURES,
        isGltfSupported,
        isTextureLoaderSupported,
        loadGltf,
        normalizeModel,
        instantiateWeapon,
        instantiateEnemy,
        instantiateTurret,
        applyExternalPBRToMaterial,
        preloadAll
    };
})(window);
