(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    function _makeRng(seed) {
        let s = (seed >>> 0) || 1337;
        return () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function _createCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        return { c, ctx };
    }

    function _configTex(canvas, repeatX, repeatY, isColor, maxAniso) {
        const tex = new THREE.CanvasTexture(canvas);
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
        return tex;
    }

    function _drawBrushedGrain(ctx, w, h, rng, intensity, vertical) {
        for (let i = 0; i < intensity; i++) {
            const bright = rng() > 0.5;
            const alpha = (0.018 + rng() * 0.04).toFixed(3);
            ctx.fillStyle = bright ? `rgba(220,255,235,${alpha})` : `rgba(2,8,6,${alpha})`;
            if (vertical) {
                const x = rng() * w;
                const y = rng() * h;
                const len = 18 + rng() * 90;
                ctx.fillRect(x, y, 1, len);
            } else {
                const x = rng() * w;
                const y = rng() * h;
                const len = 24 + rng() * 110;
                ctx.fillRect(x, y, len, 1);
            }
        }
    }

    function _drawRivet(ctx, x, y, radius, bumpCtx) {
        ctx.fillStyle = '#050d0a';
        ctx.beginPath();
        ctx.arc(x, y, radius + 1.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2d4a3d';
        ctx.beginPath();
        ctx.arc(x - 0.4, y - 0.4, radius * 0.72, 0, Math.PI * 2);
        ctx.fill();

        if (bumpCtx) {
            bumpCtx.fillStyle = '#181818';
            bumpCtx.beginPath();
            bumpCtx.arc(x, y, radius + 1.1, 0, Math.PI * 2);
            bumpCtx.fill();

            bumpCtx.fillStyle = '#ececec';
            bumpCtx.beginPath();
            bumpCtx.arc(x, y, radius * 0.68, 0, Math.PI * 2);
            bumpCtx.fill();
        }
    }

    function _drawBevelRect(ctx, bumpCtx, x, y, w, h, hiAlpha, loAlpha) {
        ctx.strokeStyle = `rgba(180,255,215,${hiAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();

        ctx.strokeStyle = `rgba(2,7,5,${loAlpha})`;
        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.stroke();

        if (bumpCtx) {
            bumpCtx.strokeStyle = '#d8d8d8';
            bumpCtx.lineWidth = 2;
            bumpCtx.beginPath();
            bumpCtx.moveTo(x + 1, y + h - 1);
            bumpCtx.lineTo(x + 1, y + 1);
            bumpCtx.lineTo(x + w - 1, y + 1);
            bumpCtx.stroke();

            bumpCtx.strokeStyle = '#1c1c1c';
            bumpCtx.lineWidth = 3;
            bumpCtx.strokeRect(x, y, w, h);
        }
    }

    XB.Textures = {
        /**
         * High-detail industrial titanium deck floor with diamond-plate centers,
         * chamfered panel seams, bolted joints, subtle conduit glow, and matched PBR maps.
         */
        createFloorMaps(maxAniso = 4) {
            const size = 512;
            const { c: diffC, ctx: d } = _createCanvas(size, size);
            const { c: bumpC, ctx: b } = _createCanvas(size, size);
            const { c: roughC, ctx: r } = _createCanvas(size, size);
            const { c: emitC, ctx: e } = _createCanvas(size, size);
            const rng = _makeRng(90421);

            d.fillStyle = '#0b1713';
            d.fillRect(0, 0, size, size);
            b.fillStyle = '#808080';
            b.fillRect(0, 0, size, size);
            r.fillStyle = '#929292';
            r.fillRect(0, 0, size, size);
            e.fillStyle = '#000000';
            e.fillRect(0, 0, size, size);

            const tile = 128;
            for (let gx = 0; gx < 4; gx++) {
                for (let gy = 0; gy < 4; gy++) {
                    const px = gx * tile;
                    const py = gy * tile;
                    const shade = ((gx + gy) % 2 === 0) ? '#10201a' : '#0d1a15';
                    d.fillStyle = shade;
                    d.fillRect(px + 2, py + 2, tile - 4, tile - 4);

                    // Brushed metal variance inside tile
                    r.fillStyle = ((gx + gy) % 2 === 0) ? '#7a7a7a' : '#8a8a8a';
                    r.fillRect(px + 3, py + 3, tile - 6, tile - 6);

                    // Recessed inner deck inset plate
                    const isConduitTile = (gx === 1 && gy === 1) || (gx === 3 && gy === 3);
                    if (isConduitTile) {
                        d.fillStyle = '#07110d';
                        d.fillRect(px + 18, py + 18, tile - 36, tile - 36);
                        b.fillStyle = '#505050';
                        b.fillRect(px + 18, py + 18, tile - 36, tile - 36);
                        r.fillStyle = '#b4b4b4';
                        r.fillRect(px + 18, py + 18, tile - 36, tile - 36);

                        // Ribbed cable conduit cover bars
                        for (let bar = 24; bar < tile - 24; bar += 10) {
                            d.fillStyle = '#172c24';
                            d.fillRect(px + 22, py + bar, tile - 44, 5);
                            b.fillStyle = '#b8b8b8';
                            b.fillRect(px + 22, py + bar, tile - 44, 5);
                            r.fillStyle = '#606060';
                            r.fillRect(px + 22, py + bar, tile - 44, 5);
                        }

                        // Subtle recessed bio-LED indicator strip
                        d.fillStyle = '#22c55e';
                        d.fillRect(px + 24, py + tile / 2 - 2, tile - 48, 3);
                        e.fillStyle = '#1b5e36';
                        e.fillRect(px + 24, py + tile / 2 - 2, tile - 48, 3);
                    } else {
                        // Raised tread diamond lug pattern
                        d.fillStyle = '#14261f';
                        for (let tx = 26; tx < tile - 22; tx += 16) {
                            for (let ty = 26; ty < tile - 22; ty += 16) {
                                const off = ((tx + ty) / 16) % 2 === 0;
                                d.save();
                                d.translate(px + tx, py + ty);
                                d.rotate(off ? Math.PI * 0.25 : -Math.PI * 0.25);
                                d.fillRect(-4, -1.5, 8, 3);
                                d.restore();

                                b.save();
                                b.translate(px + tx, py + ty);
                                b.rotate(off ? Math.PI * 0.25 : -Math.PI * 0.25);
                                b.fillStyle = '#c4c4c4';
                                b.fillRect(-4, -1.5, 8, 3);
                                b.restore();
                            }
                        }
                    }

                    // Beveled panel seam + grime along border
                    _drawBevelRect(d, b, px + 2, py + 2, tile - 4, tile - 4, 0.08, 0.55);
                    r.strokeStyle = '#cfcfcf';
                    r.lineWidth = 4;
                    r.strokeRect(px + 1, py + 1, tile - 2, tile - 2);

                    // Corner anchor rivets
                    _drawRivet(d, px + 10, py + 10, 2.2, b);
                    _drawRivet(d, px + tile - 10, py + 10, 2.2, b);
                    _drawRivet(d, px + 10, py + tile - 10, 2.2, b);
                    _drawRivet(d, px + tile - 10, py + tile - 10, 2.2, b);
                }
            }

            // Fine tactical lane stripe & micro intersection nodes (controlled brightness!)
            d.fillStyle = 'rgba(74,222,128,0.16)';
            d.fillRect(0, 254, size, 3);
            d.fillRect(254, 0, 3, size);
            e.fillStyle = '#0f3320';
            e.fillRect(0, 255, size, 2);
            e.fillRect(255, 0, 2, size);

            e.fillStyle = '#2d7a4c';
            e.fillRect(252, 252, 7, 7);

            // Surface scratches & industrial foot-traffic wear
            _drawBrushedGrain(d, size, size, rng, 650, false);
            _drawBrushedGrain(b, size, size, rng, 380, false);
            for (let s = 0; s < 55; s++) {
                const sx = rng() * size;
                const sy = rng() * size;
                const ang = rng() * Math.PI * 2;
                const len = 10 + rng() * 34;
                d.strokeStyle = rng() > 0.35 ? 'rgba(130,210,170,0.065)' : 'rgba(2,5,4,0.22)';
                d.lineWidth = 1;
                d.beginPath();
                d.moveTo(sx, sy);
                d.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
                d.stroke();

                b.strokeStyle = '#5c5c5c';
                b.beginPath();
                b.moveTo(sx, sy);
                b.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
                b.stroke();

                r.strokeStyle = '#505050';
                r.beginPath();
                r.moveTo(sx, sy);
                r.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
                r.stroke();
            }

            return {
                map: _configTex(diffC, 42, 42, true, maxAniso),
                bumpMap: _configTex(bumpC, 42, 42, false, maxAniso),
                roughnessMap: _configTex(roughC, 42, 42, false, maxAniso),
                emissiveMap: _configTex(emitC, 42, 42, true, maxAniso)
            };
        },

        createFloorTexture() {
            return this.createFloorMaps(4).map;
        },

        /**
         * Heavy fortified perimeter bulkhead panels with structural I-beams,
         * maintenance vents, floor soot weathering gradient, and emissive conduit seams.
         */
        createWallMaps(maxAniso = 4) {
            const size = 512;
            const { c: diffC, ctx: d } = _createCanvas(size, size);
            const { c: bumpC, ctx: b } = _createCanvas(size, size);
            const { c: roughC, ctx: r } = _createCanvas(size, size);
            const { c: emitC, ctx: e } = _createCanvas(size, size);
            const rng = _makeRng(51907);

            const bgGrad = d.createLinearGradient(0, 0, 0, size);
            bgGrad.addColorStop(0, '#183026');
            bgGrad.addColorStop(0.55, '#11231b');
            bgGrad.addColorStop(1, '#08110e');
            d.fillStyle = bgGrad;
            d.fillRect(0, 0, size, size);

            b.fillStyle = '#808080';
            b.fillRect(0, 0, size, size);
            r.fillStyle = '#8c8c8c';
            r.fillRect(0, 0, size, size);
            e.fillStyle = '#000000';
            e.fillRect(0, 0, size, size);

            // Vertical armored buttress pilasters & recessed bays
            for (let x = 0; x < size; x += 128) {
                d.fillStyle = '#1d382d';
                d.fillRect(x, 0, 22, size);
                b.fillStyle = '#c8c8c8';
                b.fillRect(x, 0, 22, size);
                r.fillStyle = '#666666';
                r.fillRect(x, 0, 22, size);
                _drawBevelRect(d, b, x, 0, 22, size, 0.14, 0.65);

                // Recessed bay interior panels
                d.fillStyle = '#0e1d17';
                d.fillRect(x + 28, 36, 94, 190);
                d.fillRect(x + 28, 250, 94, 210);
                _drawBevelRect(d, b, x + 28, 36, 94, 190, 0.08, 0.55);
                _drawBevelRect(d, b, x + 28, 250, 94, 210, 0.08, 0.55);

                // Cooling Louver Vents inside lower bay
                for (let vy = 278; vy < 354; vy += 14) {
                    d.fillStyle = '#060d0a';
                    d.fillRect(x + 42, vy, 66, 6);
                    b.fillStyle = '#222222';
                    b.fillRect(x + 42, vy, 66, 6);
                    r.fillStyle = '#cfcfcf';
                    r.fillRect(x + 42, vy, 66, 6);
                }

                // Rivets up pilasters
                for (let ry = 24; ry < size; ry += 64) {
                    _drawRivet(d, x + 11, ry, 2.6, b);
                }
            }

            // Horizontal reinforcement girder + emerald status conduit band
            d.fillStyle = '#0a1511';
            d.fillRect(0, 228, size, 18);
            b.fillStyle = '#484848';
            b.fillRect(0, 228, size, 18);

            d.fillStyle = '#22c55e';
            d.fillRect(0, 234, size, 4);
            e.fillStyle = '#1f7a44';
            e.fillRect(0, 234, size, 4);

            // Baseboard tactical hazard scuff band
            for (let hx = 0; hx < size; hx += 32) {
                d.fillStyle = (hx / 32) % 2 === 0 ? 'rgba(245,158,11,0.28)' : 'rgba(6,13,10,0.45)';
                d.fillRect(hx, size - 26, 22, 16);
            }

            // Bottom grime & vertical brushed streaks
            const sootGrad = r.createLinearGradient(0, size * 0.68, 0, size);
            sootGrad.addColorStop(0, 'rgba(210,210,210,0)');
            sootGrad.addColorStop(1, 'rgba(235,235,235,0.45)');
            r.fillStyle = sootGrad;
            r.fillRect(0, size * 0.68, size, size * 0.32);

            _drawBrushedGrain(d, size, size, rng, 550, true);
            _drawBrushedGrain(b, size, size, rng, 320, true);

            return {
                map: _configTex(diffC, 12, 1, true, maxAniso),
                bumpMap: _configTex(bumpC, 12, 1, false, maxAniso),
                roughnessMap: _configTex(roughC, 12, 1, false, maxAniso),
                emissiveMap: _configTex(emitC, 12, 1, true, maxAniso)
            };
        },

        createWallTexture() {
            return this.createWallMaps(4).map;
        },

        /**
         * Modular armor plating maps for buildings, pillars, bunkers, and dark steel trim.
         */
        createSteelPanelMaps(baseHex, trimHex, accentHex, repeatX = 2, repeatY = 2, maxAniso = 4) {
            const size = 256;
            const { c: diffC, ctx: d } = _createCanvas(size, size);
            const { c: bumpC, ctx: b } = _createCanvas(size, size);
            const { c: roughC, ctx: r } = _createCanvas(size, size);
            const rng = _makeRng(baseHex.length * 7919 + repeatX * 97);

            d.fillStyle = baseHex;
            d.fillRect(0, 0, size, size);
            b.fillStyle = '#848484';
            b.fillRect(0, 0, size, size);
            r.fillStyle = '#808080';
            r.fillRect(0, 0, size, size);

            // Asymmetric armor plate blocks (modular industrial look)
            const plates = [
                { x: 4, y: 4, w: 120, h: 120, c: trimHex, ro: '#727272' },
                { x: 130, y: 4, w: 122, h: 74, c: baseHex, ro: '#8c8c8c' },
                { x: 130, y: 84, w: 122, h: 168, c: trimHex, ro: '#6a6a6a' },
                { x: 4, y: 130, w: 120, h: 122, c: baseHex, ro: '#909090' }
            ];
            for (const p of plates) {
                d.fillStyle = p.c;
                d.fillRect(p.x, p.y, p.w, p.h);
                r.fillStyle = p.ro;
                r.fillRect(p.x, p.y, p.w, p.h);
                _drawBevelRect(d, b, p.x, p.y, p.w, p.h, 0.12, 0.55);

                _drawRivet(d, p.x + 8, p.y + 8, 2, b);
                _drawRivet(d, p.x + p.w - 8, p.y + 8, 2, b);
                _drawRivet(d, p.x + 8, p.y + p.h - 8, 2, b);
                _drawRivet(d, p.x + p.w - 8, p.y + p.h - 8, 2, b);
            }

            // Structural horizontal rib & subtle tech stencil stripe
            d.fillStyle = accentHex;
            d.fillRect(14, 110, 42, 4);
            d.fillRect(142, 160, 26, 3);
            d.fillStyle = 'rgba(255,255,255,0.06)';
            d.fillRect(14, 22, 64, 8);

            _drawBrushedGrain(d, size, size, rng, 340, false);
            _drawBrushedGrain(b, size, size, rng, 200, false);

            return {
                map: _configTex(diffC, repeatX, repeatY, true, maxAniso),
                bumpMap: _configTex(bumpC, repeatX, repeatY, false, maxAniso),
                roughnessMap: _configTex(roughC, repeatX, repeatY, false, maxAniso)
            };
        },

        /**
         * Armored military crate with stamped ribs, diagonal structural braces,
         * glowing status cell, and edge-wear scratches.
         */
        createCrateMaps(accent = '#4ade80', maxAniso = 4) {
            const size = 256;
            const { c: diffC, ctx: d } = _createCanvas(size, size);
            const { c: bumpC, ctx: b } = _createCanvas(size, size);
            const { c: roughC, ctx: r } = _createCanvas(size, size);
            const { c: emitC, ctx: e } = _createCanvas(size, size);
            const rng = _makeRng(accent === '#4ade80' ? 4040 : 8080);

            d.fillStyle = '#152821';
            d.fillRect(0, 0, size, size);
            b.fillStyle = '#888888';
            b.fillRect(0, 0, size, size);
            r.fillStyle = '#7c7c7c';
            r.fillRect(0, 0, size, size);
            e.fillStyle = '#000000';
            e.fillRect(0, 0, size, size);

            // Outer heavy steel bumper frame
            d.strokeStyle = '#244236';
            d.lineWidth = 22;
            d.strokeRect(11, 11, size - 22, size - 22);
            b.strokeStyle = '#d4d4d4';
            b.lineWidth = 22;
            b.strokeRect(11, 11, size - 22, size - 22);
            r.strokeStyle = '#5c5c5c';
            r.lineWidth = 22;
            r.strokeRect(11, 11, size - 22, size - 22);

            // Recessed inner bay with horizontal armor ribs
            d.fillStyle = '#0c1814';
            d.fillRect(32, 32, size - 64, size - 64);
            b.fillStyle = '#484848';
            b.fillRect(32, 32, size - 64, size - 64);
            r.fillStyle = '#9c9c9c';
            r.fillRect(32, 32, size - 64, size - 64);

            for (let y = 48; y <= 200; y += 30) {
                d.fillStyle = '#1b352b';
                d.fillRect(42, y, size - 84, 16);
                b.fillStyle = '#b4b4b4';
                b.fillRect(42, y, size - 84, 16);
                r.fillStyle = '#6c6c6c';
                r.fillRect(42, y, size - 84, 16);
                _drawBevelRect(d, b, 42, y, size - 84, 16, 0.1, 0.5);
            }

            // Diagonal brace & center power core latch
            d.strokeStyle = '#203d31';
            d.lineWidth = 14;
            d.beginPath();
            d.moveTo(30, 30);
            d.lineTo(size - 30, size - 30);
            d.stroke();
            b.strokeStyle = '#c8c8c8';
            b.lineWidth = 14;
            b.beginPath();
            b.moveTo(30, 30);
            b.lineTo(size - 30, size - 30);
            b.stroke();

            d.fillStyle = accent;
            d.fillRect(102, 118, 52, 20);
            d.fillStyle = '#07100c';
            d.fillRect(110, 123, 36, 10);
            d.fillStyle = accent;
            d.fillRect(113, 125, 30, 6);

            e.fillStyle = accent;
            e.fillRect(113, 125, 30, 6);

            // Corner bolts
            [18, size - 18].forEach(cx => {
                [18, size - 18].forEach(cy => {
                    _drawRivet(d, cx, cy, 3.2, b);
                });
            });

            _drawBrushedGrain(d, size, size, rng, 280, false);

            return {
                map: _configTex(diffC, 1, 1, true, maxAniso),
                bumpMap: _configTex(bumpC, 1, 1, false, maxAniso),
                roughnessMap: _configTex(roughC, 1, 1, false, maxAniso),
                emissiveMap: _configTex(emitC, 1, 1, true, maxAniso)
            };
        },

        createCrateTexture(accent = '#4ade80') {
            return this.createCrateMaps(accent, 4).map;
        },

        /**
         * Non-slip ramp deck with weathered amber hazard stripes and metallic tread bars.
         */
        createHazardMaps(maxAniso = 4) {
            const size = 256;
            const { c: diffC, ctx: d } = _createCanvas(size, size);
            const { c: bumpC, ctx: b } = _createCanvas(size, size);
            const { c: roughC, ctx: r } = _createCanvas(size, size);
            const rng = _makeRng(6512);

            d.fillStyle = '#121b17';
            d.fillRect(0, 0, size, size);
            b.fillStyle = '#707070';
            b.fillRect(0, 0, size, size);
            r.fillStyle = '#8e8e8e';
            r.fillRect(0, 0, size, size);

            // Side safety chevron trim bands
            d.fillStyle = '#ca8a04';
            for (let i = -size; i < size * 2; i += 34) {
                d.beginPath();
                d.moveTo(i, 0);
                d.lineTo(i + 17, 0);
                d.lineTo(i - 18, 42);
                d.lineTo(i - 35, 42);
                d.closePath();
                d.fill();

                d.beginPath();
                d.moveTo(i, size - 42);
                d.lineTo(i + 17, size - 42);
                d.lineTo(i - 18, size);
                d.lineTo(i - 35, size);
                d.closePath();
                d.fill();
            }

            // Center steel traction tread bars
            for (let x = 8; x < size; x += 24) {
                d.fillStyle = '#22362d';
                d.fillRect(x, 48, 12, size - 96);
                b.fillStyle = '#d4d4d4';
                b.fillRect(x, 48, 12, size - 96);
                r.fillStyle = '#5e5e5e';
                r.fillRect(x, 48, 12, size - 96);
            }

            _drawBrushedGrain(d, size, size, rng, 280, false);

            return {
                map: _configTex(diffC, 4, 1, true, maxAniso),
                bumpMap: _configTex(bumpC, 4, 1, false, maxAniso),
                roughnessMap: _configTex(roughC, 4, 1, false, maxAniso)
            };
        },

        createHazardTexture() {
            return this.createHazardMaps(4).map;
        },

        /**
         * Industrial perforated steel catwalk / bridge deck with structural flanges and wear.
         */
        createGratingMaps(maxAniso = 4) {
            const size = 256;
            const { c: diffC, ctx: d } = _createCanvas(size, size);
            const { c: bumpC, ctx: b } = _createCanvas(size, size);
            const { c: roughC, ctx: r } = _createCanvas(size, size);

            d.fillStyle = '#070f0c';
            d.fillRect(0, 0, size, size);
            b.fillStyle = '#262626';
            b.fillRect(0, 0, size, size);
            r.fillStyle = '#b0b0b0';
            r.fillRect(0, 0, size, size);

            // Crossed catwalk bars
            for (let i = 0; i < size; i += 24) {
                d.fillStyle = '#264437';
                d.fillRect(i, 0, 7, size);
                d.fillRect(0, i, size, 7);

                b.fillStyle = '#cecece';
                b.fillRect(i, 0, 7, size);
                b.fillRect(0, i, size, 7);

                r.fillStyle = '#565656';
                r.fillRect(i, 0, 7, size);
                r.fillRect(0, i, size, 7);
            }

            // Outer flange rail trim
            d.fillStyle = '#335948';
            d.fillRect(0, 0, size, 16);
            d.fillRect(0, size - 16, size, 16);
            b.fillStyle = '#efefef';
            b.fillRect(0, 0, size, 16);
            b.fillRect(0, size - 16, size, 16);

            return {
                map: _configTex(diffC, 6, 2, true, maxAniso),
                bumpMap: _configTex(bumpC, 6, 2, false, maxAniso),
                roughnessMap: _configTex(roughC, 6, 2, false, maxAniso)
            };
        },

        createGratingTexture() {
            return this.createGratingMaps(4).map;
        },

        /**
         * Rich atmospheric sky dome texture with twilight forest-aurora horizon band,
         * distant megastructure silhouette ridge, and layered nebula clouds.
         */
        createSkyDomeTexture() {
            const w = 1024;
            const h = 512;
            const { c, ctx } = _createCanvas(w, h);
            const rng = _makeRng(2026);

            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0.0, '#020605');
            grad.addColorStop(0.42, '#040e0a');
            grad.addColorStop(0.58, '#0b261c');
            grad.addColorStop(0.68, '#133d2e');
            grad.addColorStop(0.76, '#091b14');
            grad.addColorStop(1.0, '#030806');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Subtle emerald & teal aurora nebula sweeps
            const nebulae = [
                { x: 260, y: 210, r: 210, c0: 'rgba(52,211,153,0.14)', c1: 'rgba(16,185,129,0)' },
                { x: 740, y: 185, r: 240, c0: 'rgba(56,189,248,0.11)', c1: 'rgba(14,116,144,0)' },
                { x: 520, y: 260, r: 190, c0: 'rgba(245,158,11,0.08)', c1: 'rgba(217,119,6,0)' }
            ];
            for (const n of nebulae) {
                const rg = ctx.createRadialGradient(n.x, n.y, 12, n.x, n.y, n.r);
                rg.addColorStop(0, n.c0);
                rg.addColorStop(1, n.c1);
                ctx.fillStyle = rg;
                ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
            }

            // Distant fortress & spire skyline around the lower horizon
            const horizonY = Math.round(h * 0.72);
            ctx.fillStyle = '#06120d';
            for (let sx = 0; sx < w; sx += 26) {
                const bh = 16 + Math.floor(rng() * 58);
                ctx.fillRect(sx, horizonY - bh, 22, bh + 32);
                if (rng() > 0.52) {
                    ctx.fillStyle = rng() > 0.7 ? 'rgba(250,204,21,0.28)' : 'rgba(74,222,128,0.34)';
                    ctx.fillRect(sx + 6, horizonY - bh + 8, 6, 3);
                    ctx.fillStyle = '#06120d';
                }
            }

            // Subtle upper stars baked cleanly into skybox
            for (let i = 0; i < 420; i++) {
                const x = rng() * w;
                const y = rng() * (h * 0.62);
                const sz = rng() > 0.85 ? 2 : 1;
                ctx.fillStyle = `rgba(215,255,235,${(0.2 + rng() * 0.65).toFixed(2)})`;
                ctx.fillRect(x, y, sz, sz);
            }

            return _configTex(c, 1, 1, true, 1);
        },

        /**
         * Banded gas-giant exoplanet surface map with subtle emerald/teal atmosphere storms.
         */
        createPlanetTexture() {
            const w = 512;
            const h = 256;
            const { c, ctx } = _createCanvas(w, h);
            const rng = _makeRng(8831);

            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, '#072a1e');
            bg.addColorStop(0.25, '#0f4c36');
            bg.addColorStop(0.5, '#196f50');
            bg.addColorStop(0.72, '#0c3f2d');
            bg.addColorStop(1, '#041a12');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            for (let y = 12; y < h - 12; y += 9) {
                const alpha = (0.08 + rng() * 0.16).toFixed(2);
                ctx.fillStyle = rng() > 0.45 ? `rgba(110,231,183,${alpha})` : `rgba(4,24,18,${alpha})`;
                ctx.fillRect(0, y, w, 3 + rng() * 6);
            }

            // Atmospheric terminator vignette
            const sh = ctx.createLinearGradient(0, 0, w, 0);
            sh.addColorStop(0, 'rgba(3,10,7,0.82)');
            sh.addColorStop(0.45, 'rgba(3,10,7,0.18)');
            sh.addColorStop(1, 'rgba(134,239,172,0.12)');
            ctx.fillStyle = sh;
            ctx.fillRect(0, 0, w, h);

            return _configTex(c, 1, 1, true, 2);
        }
    };
})(window);
