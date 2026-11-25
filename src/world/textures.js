/**
 * Procedural CanvasTextures for the expanded Orbital Complex & combat effects.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    function createFloorTexture() {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#091511';
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#143326';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 252);

        ctx.strokeStyle = 'rgba(74, 222, 128, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(128, 0); ctx.lineTo(128, 256);
        ctx.moveTo(0, 128); ctx.lineTo(256, 128);
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        [[14, 14], [242, 14], [14, 242], [242, 242]].forEach(([x, y]) => {
            ctx.fillRect(x - 3, y - 3, 6, 6);
        });

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    function createWallTexture() {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#0d1d17';
        ctx.fillRect(0, 0, 256, 256);

        ctx.fillStyle = '#152e24';
        ctx.fillRect(10, 14, 236, 98);
        ctx.fillRect(10, 134, 236, 108);

        ctx.fillStyle = '#22c55e';
        ctx.fillRect(0, 118, 256, 7);

        ctx.strokeStyle = '#264e3e';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 14, 236, 98);
        ctx.strokeRect(10, 134, 236, 108);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(14, 1);
        return tex;
    }

    function createCrateTexture(accent = '#4ade80') {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#162420';
        ctx.fillRect(0, 0, 128, 128);

        ctx.strokeStyle = accent;
        ctx.lineWidth = 5;
        ctx.strokeRect(6, 6, 116, 116);

        ctx.strokeStyle = '#2e4a40';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(14, 14); ctx.lineTo(114, 114);
        ctx.moveTo(114, 14); ctx.lineTo(14, 114);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(46, 46, 36, 36);
        ctx.strokeStyle = '#091511';
        ctx.lineWidth = 3;
        ctx.strokeRect(46, 46, 36, 36);

        return new THREE.CanvasTexture(c);
    }

    function createHazardTexture() {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#f59e0b';
        for (let i = -128; i < 256; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 16, 0);
            ctx.lineTo(i + 144, 128);
            ctx.lineTo(i + 128, 128);
            ctx.closePath();
            ctx.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    function createGratingTexture() {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#162822';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#2f5e4c';
        ctx.lineWidth = 3;
        for (let x = 0; x <= 128; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 128);
            ctx.stroke();
        }
        for (let y = 0; y <= 128; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(128, y);
            ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 2);
        return tex;
    }

    XB.Textures = {
        createFloorTexture,
        createWallTexture,
        createCrateTexture,
        createHazardTexture,
        createGratingTexture
    };
})(window);
