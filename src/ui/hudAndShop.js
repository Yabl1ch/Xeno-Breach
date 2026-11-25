/**
 * HUD Controller, Minimap Radar Renderer, Dynamic 6-Sector Atomic Heart Radial Wheel,
 * Dynamic 6-Slot Weapon & Glove Loadout Bars, Build Mode HUD, Intermission Banner,
 * and 5-Tab Ergonomic Armory Workshop (Armor, Glove, Weapons, Attachments, Craft & Turrets).
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    function makePowerSvg(id) {
        if (id === 'shield') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
        }
        if (id === 'freeze') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>';
        }
        if (id === 'fire') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2c1 4-2 6-2 9a4 4 0 0 0 8 0c0-3-2-5-2-7 3 2 5 6 5 9a9 9 0 1 1-18 0c0-4 3-7 9-11z"/></svg>';
        }
        if (id === 'timeslow' || id === 'timestop') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';
        }
        if (id === 'knockback') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
        }
        if (id === 'polymer_turret') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><rect x="6" y="7" width="12" height="6" rx="2"/><path d="M12 13v7M7 20h10M18 9h4M18 11h4"/></svg>';
        }
        if (id === 'shock_siphon') {
            return '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
        }
        return '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>';
    }

    class HudAndShopUI {
        constructor(game) {
            this.game = game;
            this.activeShopTab = 'armor';
            this.shopWeaponFilter = 'all';
            this.selectedModWeaponIdx = 0;
            this.selectedWeaponTargetSlot = 0;
            this.selectedGloveTargetSlot = 0;
            this.wheelOpen = false;
            this.wheelCursorX = 0;
            this.wheelCursorY = 0;
            this.wheelHoveredSlot = 0;

            this._cacheDOM();
            this.rebuildGloveUI();
            this.rebuildWeaponBar();
            this.rebuildBuildBar();
            this._bindShopEvents();
        }

        _cacheDOM() {
            this.hud = document.getElementById('hud');
            this.crosshair = document.getElementById('crosshair-wrapper');
            this.hitmarker = document.getElementById('hitmarker');
            this.screenFx = document.getElementById('screen-fx');
            this.speedlines = document.getElementById('speedlines');
            this.radarCanvas = document.getElementById('radar-canvas');
            this.radarCtx = this.radarCanvas.getContext('2d');

            this.elWave = document.getElementById('hud-wave');
            this.elEnemies = document.getElementById('hud-enemies');
            this.elCoins = document.getElementById('hud-coins');
            this.elCrystals = document.getElementById('hud-crystals');
            this.elScore = document.getElementById('hud-score');

            this.elArmorName = document.getElementById('hud-armor-name');
            this.elArmorCat = document.getElementById('hud-armor-cat');
            this.elHpFill = document.getElementById('hp-fill');
            this.elHpText = document.getElementById('hp-text');
            this.elShieldFill = document.getElementById('shield-fill');
            this.elShieldText = document.getElementById('shield-text');
            this.elPolyFill = document.getElementById('poly-fill');
            this.elPolyText = document.getElementById('poly-text');

            this.elWeaponName = document.getElementById('weapon-name');
            this.elWeaponNote = document.getElementById('weapon-note');
            this.elAmmoCur = document.getElementById('ammo-cur');
            this.elAmmoMax = document.getElementById('ammo-max');
            this.elWeaponSlots = document.getElementById('weapon-slots');
            this.elReload = document.getElementById('reload-indicator');
            this.elChargeWrap = document.getElementById('charge-bar-wrap');
            this.elChargeFill = document.getElementById('charge-bar-fill');

            this.elSpeedPill = document.getElementById('speed-pill');
            this.elDashPill = document.getElementById('dash-pill');
            this.elMoveTag = document.getElementById('move-tag');
            this.elBoostChip = document.getElementById('btn-boost-chip');
            this.elBoostLabel = document.getElementById('boost-label');
            this.elBoostCount = document.getElementById('boost-count');
            this.elMedkitChip = document.getElementById('btn-medkit-chip');
            this.elMedkitCount = document.getElementById('medkit-count');

            this.elBanner = document.getElementById('center-banner');
            this.elBannerTitle = document.getElementById('banner-title');
            this.elBannerSub = document.getElementById('banner-sub');
            this.elIntermissionBanner = document.getElementById('intermission-pill');
            this.elToast = document.getElementById('pickup-toast');
            this.elTerminalPrompt = document.getElementById('terminal-prompt');
            this.elWallAttachPrompt = document.getElementById('wall-attach-prompt');
            this.elBuildBar = document.getElementById('build-hud-bar');
            this.elPointerHint = document.getElementById('pointer-hint');

            this.elWheelOverlay = document.getElementById('glove-wheel-overlay');
            this.elWheelContainer = document.getElementById('wheel-container');
            this.elWheelCursor = document.getElementById('wheel-cursor-dot');
            this.elWheelCoreTitle = document.getElementById('wheel-core-title');
            this.elWheelCoreDesc = document.getElementById('wheel-core-desc');
            this.elGloveSlots = document.getElementById('glove-slots');

            this.startScreen = document.getElementById('start-screen');
            this.pauseScreen = document.getElementById('pause-screen');
            this.shopScreen = document.getElementById('shop-screen');
            this.gameoverScreen = document.getElementById('gameover-screen');
            this.touchControls = document.getElementById('touch-controls');
            this.btnShopHud = document.getElementById('btn-shop');

            this.elShopCoins = document.getElementById('shop-coins');
            this.elShopCrystals = document.getElementById('shop-crystals');
            this.elShopPolymer = document.getElementById('shop-polymer');
            this.elShopContent = document.getElementById('shop-content');

            this.gloveSlotEls = [];
            this.wheelSectorBtns = [];
            this.weaponSlotBtns = [];
        }

        /**
         * Rebuilds both the bottom Glove HUD Bar and the 5-sector Radial Wheel
         * whenever the player equips/swaps abilities in the 5 Active Glove Slots!
         */
        rebuildGloveUI() {
            const equipped = this.game.combat.equippedGloveSlots;
            this.elGloveSlots.innerHTML = '';
            this.gloveSlotEls = equipped.map((powerIdx, slotIdx) => {
                const p = XB.GLOVE_POWERS[powerIdx];
                const meta = XB.GLOVE_SLOT_META[slotIdx];
                const btn = document.createElement('button');
                btn.className = 'g-slot';
                btn.innerHTML = `
                    <span style="color:${p.color}">${makePowerSvg(p.id)}</span>
                    <span class="g-slot-key">${meta.keyHint}</span>
                    <span class="g-slot-name">${p.shortName}</span>
                    <span class="g-slot-cd" style="display:none;">0.0</span>
                `;
                btn.addEventListener('click', () => {
                    if (this.game.state === 'PLAYING') {
                        this.game.combat.castGloveSlot(slotIdx, this.game.getCombatContext());
                    }
                });
                this.elGloveSlots.appendChild(btn);
                return { btn, cdEl: btn.querySelector('.g-slot-cd'), powerIdx };
            });

            // Rebuild Radial Wheel Sectors
            this.wheelSectorBtns.forEach(s => s.btn.remove());
            this.wheelSectorBtns = [];
            const radius = 160;
            const cx = 220;
            const cy = 220;

            equipped.forEach((powerIdx, slotIdx) => {
                const p = XB.GLOVE_POWERS[powerIdx];
                const meta = XB.GLOVE_SLOT_META[slotIdx];
                const rad = (meta.angleDeg * Math.PI) / 180;
                const x = cx + Math.cos(rad) * radius;
                const y = cy + Math.sin(rad) * radius;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'wheel-sector-btn';
                btn.style.left = `${x}px`;
                btn.style.top = `${y}px`;
                btn.innerHTML = `
                    <span style="color:${p.color}">${makePowerSvg(p.id)}</span>
                    <span style="font-size:11.5px; font-weight:700;">${p.shortName}</span>
                    <span class="wheel-key-badge">${meta.wheelKeyHint} • ${p.energyCost} ЭН</span>
                `;
                btn.addEventListener('mouseenter', () => this.setWheelHover(slotIdx));
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.setWheelHover(slotIdx);
                    this.closeWheel(true);
                });
                this.elWheelContainer.appendChild(btn);
                this.wheelSectorBtns.push({ btn, rad, power: p, slotIdx });
            });
        }

        /**
         * Rebuilds the 6 Active Weapon Slots [1..6] on the HUD whenever loadout changes in Shop.
         */
        rebuildWeaponBar() {
            this.elWeaponSlots.innerHTML = '';
            this.weaponSlotBtns = this.game.equippedWeaponSlots.map((wIdx, slotIdx) => {
                const w = XB.WEAPONS[wIdx];
                const btn = document.createElement('button');
                btn.className = 'w-slot' + (slotIdx === this.game.activeWeaponSlot ? ' active' : '');
                btn.textContent = `${slotIdx + 1} ${w.shortName}`;
                btn.addEventListener('click', () => {
                    if (this.game.state === 'PLAYING') {
                        this.game.selectWeaponSlot(slotIdx);
                    }
                });
                this.elWeaponSlots.appendChild(btn);
                return btn;
            });
        }

        rebuildBuildBar() {
            if (!this.elBuildBar || !this.game.building) return;
            const b = this.game.building;
            const curAtt = XB.WALL_ATTACHMENTS.find(a => a.id === b.selectedAttachmentId);
            let html = '';
            XB.BUILD_BLUEPRINTS.forEach((bp, idx) => {
                const active = idx === b.selectedBlueprintIdx;
                const costTxt = bp.costCoins > 0 ? `${bp.costCoins}М` : `${bp.costPoly}П`;
                html += `
                    <button class="build-bp-btn ${active ? 'active' : ''}" data-bp="${idx}">
                        <span>[${idx + 1}] ${bp.shortName}</span>
                        <span class="font-mono" style="font-size:9px; opacity:0.85;">${costTxt}${bp.permanent ? ' • ∞' : ''}</span>
                    </button>
                `;
            });
            html += `
                <div style="font-size:10px; padding:0 8px; border-left:1px solid var(--glass-border); color:var(--text-secondary);">
                    <div>[ЛКМ] Построить • [R] Поворот • [C] Выход</div>
                    <div style="color:${curAtt ? curAtt.color : '#4ade80'}">[ПКМ] Обвес: ${curAtt ? curAtt.shortName : '-'} • [CTRL] Присед</div>
                </div>
            `;
            this.elBuildBar.innerHTML = html;
            this.elBuildBar.querySelectorAll('[data-bp]').forEach(btn => {
                btn.addEventListener('click', () => {
                    b.selectBlueprint(Number(btn.dataset.bp));
                    this.rebuildBuildBar();
                });
            });
        }

        _bindShopEvents() {
            const tabs = Array.from(document.querySelectorAll('.shop-tab-btn'));
            const selectTab = (btn) => {
                if (!btn) return;
                this.activeShopTab = btn.dataset.tab;
                tabs.forEach(b => {
                    const isSel = b === btn;
                    b.setAttribute('aria-selected', isSel ? 'true' : 'false');
                    if (typeof b.toggleAttribute === 'function') {
                        b.toggleAttribute('focusgroupstart', isSel);
                    }
                });
                if (this.elShopContent && btn.id) {
                    this.elShopContent.setAttribute('aria-labelledby', btn.id);
                }
                if (typeof btn.scrollIntoView === 'function') {
                    btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
                this.renderShop();
            };

            tabs.forEach((btn, idx) => {
                btn.addEventListener('click', () => selectTab(btn));
                btn.addEventListener('keydown', (e) => {
                    let nextIdx = -1;
                    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
                    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
                    else if (e.key === 'Home') nextIdx = 0;
                    else if (e.key === 'End') nextIdx = tabs.length - 1;
                    if (nextIdx !== -1) {
                        e.preventDefault();
                        tabs[nextIdx].focus();
                        selectTab(tabs[nextIdx]);
                    }
                });
            });
            document.getElementById('btn-shop-close').addEventListener('click', () => {
                this.game.closeShop();
            });
            const topClose = document.getElementById('btn-shop-close-top');
            if (topClose) {
                topClose.addEventListener('click', () => this.game.closeShop());
            }
            const quickFill = document.getElementById('btn-shop-quickfill');
            if (quickFill) {
                quickFill.addEventListener('click', () => {
                    this.game.buySupply('full');
                    this.renderShop();
                });
            }
        }

        openWheel() {
            if (this.wheelOpen) return;
            this.wheelOpen = true;
            this.wheelCursorX = 0;
            this.wheelCursorY = 0;
            this.wheelHoveredSlot = this.game.combat.activeSlotIndex;
            this.elWheelOverlay.classList.add('open');
            this.elWheelCursor.style.left = '220px';
            this.elWheelCursor.style.top = '220px';
            this.setWheelHover(this.wheelHoveredSlot);
            this.game.sound.playWheelOpen();
        }

        moveWheelCursor(dx, dy) {
            if (!this.wheelOpen) return;
            this.wheelCursorX += dx;
            this.wheelCursorY += dy;
            const dist = Math.hypot(this.wheelCursorX, this.wheelCursorY);
            if (dist > 155) {
                this.wheelCursorX = (this.wheelCursorX / dist) * 155;
                this.wheelCursorY = (this.wheelCursorY / dist) * 155;
            }
            this.elWheelCursor.style.left = `${220 + this.wheelCursorX}px`;
            this.elWheelCursor.style.top = `${220 + this.wheelCursorY}px`;

            if (dist > 26) {
                const cursorAngle = Math.atan2(this.wheelCursorY, this.wheelCursorX);
                let bestSlot = 0;
                let bestDiff = Infinity;
                this.wheelSectorBtns.forEach((s, idx) => {
                    let diff = Math.abs(cursorAngle - s.rad);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff < bestDiff) { bestDiff = diff; bestSlot = idx; }
                });
                if (bestSlot !== this.wheelHoveredSlot) {
                    this.setWheelHover(bestSlot);
                    this.game.sound.playWheelTick();
                }
            }
        }

        setWheelHover(slotIdx) {
            this.wheelHoveredSlot = slotIdx;
            const powerIdx = this.game.combat.equippedGloveSlots[slotIdx];
            const p = XB.GLOVE_POWERS[powerIdx];
            this.wheelSectorBtns.forEach((s, i) => s.btn.classList.toggle('hovered', i === slotIdx));
            if (p) {
                this.elWheelCoreTitle.textContent = p.name;
                this.elWheelCoreTitle.style.color = p.color;
                this.elWheelCoreDesc.textContent = p.desc;
            }
        }

        closeWheel(castSelected = true) {
            if (!this.wheelOpen) return;
            this.wheelOpen = false;
            this.elWheelOverlay.classList.remove('open');
            if (castSelected && this.game.state === 'PLAYING') {
                this.game.combat.castGloveSlot(this.wheelHoveredSlot, this.game.getCombatContext());
            }
        }

        // =====================================================================
        // 5-TAB ERGONOMIC ARMORY WORKSHOP
        // =====================================================================
        _sectionHead(svgPath, title, sub) {
            return `
                <div class="shop-section-head">
                    <span class="shop-section-title">
                        <svg class="svg-icon" viewBox="0 0 24 24">${svgPath}</svg>
                        <span>${title}</span>
                    </span>
                    <span class="shop-section-sub">${sub}</span>
                </div>
            `;
        }

        _computeTabAffordability() {
            const g = this.game;
            const c = g.combat;
            const b = g.building;

            const armorReady = XB.ARMORS.some((a, i) => !g.unlockedArmors.has(i) && g.crystals >= a.costCrystals)
                || g.crystals >= (6 + g.armorPlateLvl * 5)
                || g.crystals >= (6 + g.armorCapLvl * 5)
                || g.crystals >= (8 + g.armorServoLvl * 6);

            const gloveReady = XB.GLOVE_POWERS.some((p, i) => {
                if (!c.unlockedPowers.has(i)) return g.crystals >= p.costCrystals;
                const u = c.gloveUpgrades[i];
                return (u.power < 6 && g.crystals >= (5 + u.power * 4))
                    || (u.area < 6 && g.crystals >= (5 + u.area * 4))
                    || (u.efficiency < 6 && g.crystals >= (5 + u.efficiency * 4));
            }) || g.crystals >= (8 + Math.floor((c.maxPolymerEnergy - 100) / 25) * 7);

            const weaponsReady = XB.WEAPONS.some((w, i) => {
                if (!g.unlockedWeapons.has(i)) {
                    return g.coins >= w.costCoins && g.crystals >= (w.costCrystals || 0);
                }
                const lvl = g.weaponLevels[i];
                return lvl < 8 && g.coins >= (35 + lvl * 35);
            });

            let attReady = (g.coins >= 35 && g.medkitCount < g.maxMedkits) || (g.coins >= 40 && g.boostCharges < g.maxBoostCharges);
            if (!attReady) {
                for (const wi of g.unlockedWeapons) {
                    const owned = g.ownedAttachments[wi];
                    for (const slot of ['barrel', 'mag', 'optic', 'core']) {
                        for (const att of XB.ATTACHMENTS[slot]) {
                            if (!owned.has(`${slot}:${att.id}`) && g.coins >= att.costCoins) {
                                attReady = true;
                                break;
                            }
                        }
                        if (attReady) break;
                    }
                    if (attReady) break;
                }
            }

            const craftReady = XB.WALL_ATTACHMENTS.some(a => !b.unlockedWallAttachments.has(a.id) && g.coins >= a.unlockCoins)
                || g.crystals >= (6 + b.wallHpLvl * 5)
                || (b.maxTurrets < 8 && g.crystals >= (10 + (b.maxTurrets - 4) * 8));

            return { armor: armorReady, glove: gloveReady, weapons: weaponsReady, attachments: attReady, craft: craftReady };
        }

        renderShop() {
            const g = this.game;
            this.elShopCoins.textContent = g.coins;
            this.elShopCrystals.textContent = g.crystals;
            if (this.elShopPolymer) {
                this.elShopPolymer.textContent = `${Math.floor(g.combat.polymerEnergy)}/${g.combat.maxPolymerEnergy}`;
            }
            const qf = document.getElementById('btn-shop-quickfill');
            if (qf) qf.disabled = g.coins < 50;

            const dots = this._computeTabAffordability();
            for (const key of ['armor', 'glove', 'weapons', 'attachments', 'craft']) {
                const el = document.getElementById(`tab-dot-${key}`);
                if (el) el.classList.toggle('has-ready', Boolean(dots[key]));
            }

            if (this.activeShopTab === 'armor') this._renderArmorTab();
            else if (this.activeShopTab === 'glove') this._renderGloveTab();
            else if (this.activeShopTab === 'weapons') this._renderWeaponsTab();
            else if (this.activeShopTab === 'attachments') this._renderAttachmentsTab();
            else this._renderCraftTab();
        }

        _renderArmorTab() {
            const g = this.game;
            const cur = g.getEffectiveArmor();
            const nextLockIdx = XB.ARMORS.findIndex((_, i) => !g.unlockedArmors.has(i));
            const nextArmor = nextLockIdx !== -1 ? XB.ARMORS[nextLockIdx] : null;

            let html = `
                <div class="shop-guide-banner">
                    <div>
                        <strong>ТЕКУЩАЯ БРОНЯ: ${cur.name}</strong>
                        <span> • ОЗ ${cur.maxHp} • Щит ${cur.maxShield} • Защита ${Math.round(cur.damageReduction * 100)}% • БХОП до ${cur.bhopMaxSpeed} м/с</span>
                    </div>
                    <span class="shop-status-pill ${nextArmor && g.crystals >= nextArmor.costCrystals ? 'price-ok' : ''}">
                        ${nextArmor ? `Следующий класс: ${nextArmor.name} (${nextArmor.costCrystals} КР)` : 'ВСЕ КЛАССЫ ОТКРЫТЫ'}
                    </span>
                </div>
            `;

            html += this._sectionHead(
                '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
                'КЛАССЫ ЭКЗОСКЕЛЕТОВ [8 МОДЕЛЕЙ]',
                'Более тяжёлая броня усиливает защиту и щит, но снижает потолок БХОП'
            );

            html += '<div class="shop-grid">';
            XB.ARMORS.forEach((a, idx) => {
                const unlocked = g.unlockedArmors.has(idx);
                const equipped = g.armorIndex === idx;
                const canAfford = !unlocked && g.crystals >= a.costCrystals;
                const needMore = Math.max(0, a.costCrystals - g.crystals);
                const effHp = a.maxHp + g.armorPlateLvl * 25;
                const effShield = a.maxShield + g.armorCapLvl * 25;
                const statusBadge = equipped
                    ? '<span class="shop-status-pill ready">НАДЕТО</span>'
                    : unlocked
                        ? '<span class="shop-status-pill">КУПЛЕНО</span>'
                        : `<span class="shop-status-pill ${canAfford ? 'price-ok' : ''}">${a.costCrystals} КР</span>`;

                html += `
                    <article class="shop-card ${equipped ? 'equipped' : (canAfford ? 'can-afford' : '')}">
                        <header class="shop-card-top">
                            <span class="shop-cat" style="color:${a.accentColor}">${a.category}</span>
                            ${statusBadge}
                        </header>
                        <div>
                            <h3 class="shop-card-title">${a.name}</h3>
                            <p class="shop-card-desc">${a.summary}</p>
                        </div>
                        <div class="shop-stats-mini font-mono">
                            <span>ОЗ: ${effHp}</span>
                            <span>ЩИТ: ${effShield}</span>
                            <span>БРОНЯ: ${Math.round(a.damageReduction * 100)}%</span>
                            <span>БХОП: ${a.bhopMaxSpeed} м/с</span>
                            <span>СКОР: ${Math.round(a.speedMult * 100)}%</span>
                            <span>СТРЕЙФ: ${Math.round(a.airAccelMult * 100)}%</span>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${canAfford ? 'primary-buy' : (unlocked && !equipped ? 'equip-btn' : '')}" data-armor-idx="${idx}" ${(!unlocked && !canAfford) || equipped ? 'disabled' : ''}>
                                ${equipped ? 'АКТИВНО СЕЙЧАС' : (unlocked ? 'НАДЕТЬ БРОНЮ' : (canAfford ? `КУПИТЬ (${a.costCrystals} КР)` : `НУЖНО ЕЩЁ +${needMore} КР`))}
                            </button>
                        </footer>
                    </article>
                `;
            });
            html += '</div>';

            const plateCost = 6 + g.armorPlateLvl * 5;
            const capCost = 6 + g.armorCapLvl * 5;
            const servoCost = 8 + g.armorServoLvl * 6;

            html += this._sectionHead(
                '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>',
                'ПОСТОЯННЫЕ ЯДРА КОСТЮМА',
                'Улучшения сохраняются и действуют на ЛЮБОЙ надетой броне'
            );

            const cores = [
                { id: 'plate', tag: 'Прочность корпуса', lvl: g.armorPlateLvl, title: 'ТИТАНОВЫЕ ПЛАСТИНЫ', desc: '+25 к макс. Здоровью на любой надетой броне.', cost: plateCost },
                { id: 'cap', tag: 'Ёмкость энергощита', lvl: g.armorCapLvl, title: 'КВАНТ-КОНДЕНСАТОР', desc: '+25 к макс. Энергощиту и +10% скорости регена.', cost: capCost },
                { id: 'servo', tag: 'Динамика и БХОП', lvl: g.armorServoLvl, title: 'ГИРО-СЕРВОПРИВОДЫ', desc: '+4% к скорости бега, эйр-стрейфа и потолку БХОП.', cost: servoCost }
            ];

            html += '<div class="shop-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">';
            cores.forEach(c => {
                const ok = g.crystals >= c.cost;
                html += `
                    <article class="shop-card ${ok ? 'can-afford' : ''}">
                        <header class="shop-card-top">
                            <span class="shop-cat">${c.tag}</span>
                            <span class="shop-status-pill ${ok ? 'price-ok' : ''}">Ур. ${c.lvl}</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">${c.title}</h3>
                            <p class="shop-card-desc">${c.desc}</p>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${ok ? 'primary-buy' : ''}" data-core="${c.id}" ${!ok ? 'disabled' : ''}>
                                ${ok ? `УЛУЧШИТЬ (+1) • ${c.cost} КР` : `НУЖНО ЕЩЁ +${c.cost - g.crystals} КР`}
                            </button>
                        </footer>
                    </article>
                `;
            });
            html += '</div>';

            this.elShopContent.innerHTML = html;
            this.elShopContent.querySelectorAll('[data-armor-idx]').forEach(btn => {
                btn.addEventListener('click', () => { g.buyOrEquipArmor(Number(btn.dataset.armorIdx)); this.renderShop(); });
            });
            this.elShopContent.querySelectorAll('[data-core]').forEach(btn => {
                btn.addEventListener('click', () => { g.upgradeArmorCore(btn.dataset.core); this.renderShop(); });
            });
        }

        _renderGloveTab() {
            const g = this.game;
            const c = g.combat;
            const tgtMeta = XB.GLOVE_SLOT_META[this.selectedGloveTargetSlot];

            let html = `
                <div class="shop-guide-banner">
                    <div>
                        <strong>ЦЕЛЕВАЯ ЯЧЕЙКА ПЕРЧАТКИ [${tgtMeta.keyHint}]</strong>
                        <span> — выберите ячейку ниже или жмите [Q E F T V Y] прямо на карточке способности</span>
                    </div>
                    <span class="shop-status-pill">Удерж. [Q] — радиальное кольцо</span>
                </div>
                <div class="loadout-strip">
                    <span class="shop-cat">6 АКТИВНЫХ ЯЧЕЕК:</span>
            `;
            c.equippedGloveSlots.forEach((pIdx, sIdx) => {
                const p = XB.GLOVE_POWERS[pIdx];
                const meta = XB.GLOVE_SLOT_META[sIdx];
                const isTgt = sIdx === this.selectedGloveTargetSlot;
                html += `<button type="button" class="shop-dock-btn ${isTgt ? 'target' : ''}" data-gdock="${sIdx}" style="border-color:${isTgt ? 'var(--coin-gold)' : p.color}; color:${p.color}">${meta.keyHint}: ${p.shortName}</button>`;
            });
            html += '</div>';

            html += this._sectionHead(
                '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
                'МОДУЛИ ПЕРЧАТКИ «ХРАНИТЕЛЬ» [9 СПОСОБНОСТЕЙ]',
                'Прокачивайте Силу, Радиус/Длительность и Расход энергии до 6 уровня'
            );

            html += '<div class="shop-grid">';
            const orderedIndices = [
                ...XB.GLOVE_POWERS.map((_, i) => i).filter(i => c.unlockedPowers.has(i)),
                ...XB.GLOVE_POWERS.map((_, i) => i).filter(i => !c.unlockedPowers.has(i))
            ];

            orderedIndices.forEach(idx => {
                const p = XB.GLOVE_POWERS[idx];
                const unlocked = c.unlockedPowers.has(idx);
                const equippedSlot = c.equippedGloveSlots.indexOf(idx);
                const upg = c.gloveUpgrades[idx];
                const canUnlock = !unlocked && g.crystals >= p.costCrystals;
                const needUnlock = Math.max(0, p.costCrystals - g.crystals);

                const costPow = 5 + upg.power * 4;
                const costArea = 5 + upg.area * 4;
                const costEff = 5 + upg.efficiency * 4;

                html += `
                    <article class="shop-card ${equippedSlot !== -1 ? 'equipped' : (canUnlock ? 'can-afford' : '')}">
                        <header class="shop-card-top">
                            <span class="shop-cat" style="color:${p.color}">${equippedSlot !== -1 ? `ЯЧЕЙКА [${XB.GLOVE_SLOT_META[equippedSlot].wheelKeyHint}]` : (unlocked ? 'В ЗАПАСЕ' : 'ЗАКРЫТО')}</span>
                            <span class="shop-status-pill ${equippedSlot !== -1 ? 'ready' : (canUnlock ? 'price-ok' : '')}">
                                ${unlocked ? `${p.energyCost} ПОЛ` : `${p.costCrystals} КР`}
                            </span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">${p.name}</h3>
                            <p class="shop-card-desc">${p.desc}</p>
                        </div>
                        <footer class="shop-card-footer">
                        ${!unlocked ? `
                            <button type="button" class="shop-action-btn ${canUnlock ? 'primary-buy' : ''}" data-unlock-power="${idx}" ${!canUnlock ? 'disabled' : ''}>
                                ${canUnlock ? `РАЗБЛОКИРОВАТЬ (${p.costCrystals} КР)` : `НУЖНО ЕЩЁ +${needUnlock} КР`}
                            </button>
                        ` : `
                            <button type="button" class="shop-action-btn equip-btn" data-assign-power="${idx}" data-slot="${this.selectedGloveTargetSlot}">
                                ${equippedSlot === this.selectedGloveTargetSlot ? `ЭКИПИРОВАНО В [${tgtMeta.wheelKeyHint}]` : `ПОСТАВИТЬ В ЯЧЕЙКУ [${tgtMeta.wheelKeyHint}]`}
                            </button>
                            <div class="slot-assign-row">
                                ${XB.GLOVE_SLOT_META.map((m, sIdx) => `
                                    <button type="button" class="slot-mini-btn ${equippedSlot === sIdx ? 'active' : ''}" data-assign-power="${idx}" data-slot="${sIdx}" title="Установить в ячейку ${m.keyHint}">
                                        ${m.wheelKeyHint}
                                    </button>
                                `).join('')}
                            </div>
                            <div class="sub-upg-list">
                                <button type="button" class="sub-upg-btn" data-gupg="${idx}:power" ${upg.power >= 6 || g.crystals < costPow ? 'disabled' : ''}>
                                    <span>Сила Ур.${upg.power}/6</span>
                                    <span>${upg.power >= 6 ? 'МАКС' : `${costPow} КР`}</span>
                                </button>
                                <button type="button" class="sub-upg-btn" data-gupg="${idx}:area" ${upg.area >= 6 || g.crystals < costArea ? 'disabled' : ''}>
                                    <span>Радиус/Длит. Ур.${upg.area}/6</span>
                                    <span>${upg.area >= 6 ? 'МАКС' : `${costArea} КР`}</span>
                                </button>
                                <button type="button" class="sub-upg-btn" data-gupg="${idx}:efficiency" ${upg.efficiency >= 6 || g.crystals < costEff ? 'disabled' : ''}>
                                    <span>КД/Энергия Ур.${upg.efficiency}/6</span>
                                    <span>${upg.efficiency >= 6 ? 'МАКС' : `${costEff} КР`}</span>
                                </button>
                            </div>
                        `}
                        </footer>
                    </article>
                `;
            });

            const polyCost = 8 + Math.floor((c.maxPolymerEnergy - 100) / 25) * 7;
            const polyOk = g.crystals >= polyCost;
            html += `
                <article class="shop-card ${polyOk ? 'can-afford' : ''}">
                    <header class="shop-card-top">
                        <span class="shop-cat">Реактор перчатки и Гелиоса</span>
                        <span class="shop-status-pill ${polyOk ? 'price-ok' : ''}">${c.maxPolymerEnergy} ПОЛ</span>
                    </header>
                    <div>
                        <h3 class="shop-card-title">РЕЗЕРВУАР ПОЛИМЕРА</h3>
                        <p class="shop-card-desc">+25 макс. Полимера и быстрее авто-реген. Усиливает перчатку, сферу «Гелиоса» и турели.</p>
                    </div>
                    <footer class="shop-card-footer">
                        <button type="button" class="shop-action-btn ${polyOk ? 'primary-buy' : ''}" id="btn-upgrade-poly" ${!polyOk ? 'disabled' : ''}>
                            ${polyOk ? `РАСШИРИТЬ (+25) • ${polyCost} КР` : `НУЖНО ЕЩЁ +${polyCost - g.crystals} КР`}
                        </button>
                    </footer>
                </article>
            `;
            html += '</div>';
            this.elShopContent.innerHTML = html;

            this.elShopContent.querySelectorAll('[data-gdock]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.selectedGloveTargetSlot = Number(btn.dataset.gdock);
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-unlock-power]').forEach(btn => {
                btn.addEventListener('click', () => { g.unlockGlovePower(Number(btn.dataset.unlockPower)); this.renderShop(); });
            });
            this.elShopContent.querySelectorAll('[data-assign-power]').forEach(btn => {
                btn.addEventListener('click', () => {
                    g.assignGloveToSlot(Number(btn.dataset.assignPower), Number(btn.dataset.slot));
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-gupg]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const [pIdx, track] = btn.dataset.gupg.split(':');
                    g.upgradeGloveTrack(Number(pIdx), track);
                    this.renderShop();
                });
            });
            const polyBtn = document.getElementById('btn-upgrade-poly');
            if (polyBtn) polyBtn.addEventListener('click', () => { g.upgradePolymerReserve(polyCost); this.renderShop(); });
        }

        _renderWeaponsTab() {
            const g = this.game;
            const filter = this.shopWeaponFilter || 'all';
            const tgtSlot = this.selectedWeaponTargetSlot + 1;

            let html = `
                <div class="shop-guide-banner">
                    <div>
                        <strong>ЦЕЛЕВОЙ СЛОТ ОРУЖИЯ [${tgtSlot}]</strong>
                        <span> — выберите слот ниже или нажмите [1–6] прямо на карточке пушки</span>
                    </div>
                    <span class="shop-status-pill">${g.unlockedWeapons.size}/${XB.WEAPONS.length} ОТКРЫТО</span>
                </div>
                <div class="loadout-strip">
                    <span class="shop-cat">6 АКТИВНЫХ СЛОТОВ:</span>
            `;
            g.equippedWeaponSlots.forEach((wIdx, sIdx) => {
                const isTgt = sIdx === this.selectedWeaponTargetSlot;
                html += `<button type="button" class="shop-dock-btn ${isTgt ? 'target' : ''}" data-wdock="${sIdx}">[${sIdx + 1}] ${XB.WEAPONS[wIdx].shortName}</button>`;
            });
            html += '</div>';

            const ownedCount = g.unlockedWeapons.size;
            const buyableCount = XB.WEAPONS.filter((w, i) => !g.unlockedWeapons.has(i) && g.coins >= w.costCoins && g.crystals >= (w.costCrystals || 0)).length;

            html += `
                <div class="shop-filter-row">
                    <button type="button" class="shop-filter-btn ${filter === 'all' ? 'active' : ''}" data-wfilter="all">Все модели (${XB.WEAPONS.length})</button>
                    <button type="button" class="shop-filter-btn ${filter === 'owned' ? 'active' : ''}" data-wfilter="owned">Купленные (${ownedCount})</button>
                    <button type="button" class="shop-filter-btn ${filter === 'buyable' ? 'active' : ''}" data-wfilter="buyable">Хватает на покупку (${buyableCount})</button>
                </div>
                <div class="shop-grid">
            `;

            const list = XB.WEAPONS.map((w, idx) => ({ w, idx })).filter(({ w, idx }) => {
                const unlocked = g.unlockedWeapons.has(idx);
                if (filter === 'owned') return unlocked;
                if (filter === 'buyable') return !unlocked && g.coins >= w.costCoins && g.crystals >= (w.costCrystals || 0);
                return true;
            });

            if (list.length === 0) {
                html += `<div class="shop-guide-banner" style="grid-column:1/-1;"><span>Нет оружия под выбранным фильтром. Переключите фильтр на «Все модели».</span></div>`;
            }

            list.forEach(({ w, idx }) => {
                const unlocked = g.unlockedWeapons.has(idx);
                const equippedSlot = g.equippedWeaponSlots.indexOf(idx);
                const lvl = g.weaponLevels[idx];
                const maxed = lvl >= 8;
                const upgCost = 35 + lvl * 35;
                const stats = g.combat.getWeaponStats(idx, lvl, g.equippedAttachments[idx]);
                const needCrys = w.costCrystals || 0;
                const canBuy = !unlocked && g.coins >= w.costCoins && g.crystals >= needCrys;
                const canUpg = unlocked && !maxed && g.coins >= upgCost;
                const priceTxt = needCrys > 0 ? `${w.costCoins}М + ${needCrys}КР` : `${w.costCoins} МОН`;
                const needCoins = Math.max(0, w.costCoins - g.coins);
                const needMoreCrys = Math.max(0, needCrys - g.crystals);
                const missingStr = needCoins > 0 && needMoreCrys > 0
                    ? `+${needCoins}М +${needMoreCrys}КР`
                    : needCoins > 0 ? `+${needCoins} МОН` : `+${needMoreCrys} КР`;

                const statusBadge = equippedSlot !== -1
                    ? `<span class="shop-status-pill ready">СЛОТ ${equippedSlot + 1}</span>`
                    : unlocked
                        ? `<span class="shop-status-pill">В ЗАПАСЕ</span>`
                        : `<span class="shop-status-pill ${canBuy ? 'coin-ok' : ''}">${priceTxt}</span>`;

                html += `
                    <article class="shop-card ${equippedSlot !== -1 ? 'equipped' : ((canBuy || canUpg) ? 'can-afford' : '')}">
                        <header class="shop-card-top">
                            <span class="shop-cat">${w.usesPolymer ? 'ПОЛИМЕР-ОРУЖИЕ' : 'АРСЕНАЛ'}</span>
                            ${statusBadge}
                        </header>
                        <div>
                            <h3 class="shop-card-title">${w.name}</h3>
                            <p class="shop-card-desc">${w.note}</p>
                        </div>
                        <div class="lvl-progress-wrap">
                            <span>УР.${lvl}/8</span>
                            <div class="lvl-track"><div class="lvl-fill" style="width:${(lvl / 8) * 100}%"></div></div>
                        </div>
                        <div class="shop-stats-mini font-mono">
                            <span>УРОН: ${stats.damage}${w.pellets > 1 ? ` x${w.pellets}` : ''}</span>
                            <span>ОБОЙМА: ${w.usesPolymer ? 'ПОЛИМЕР' : stats.maxAmmo}</span>
                            <span>ТЕМП: ${(1 / Math.max(0.04, stats.fireRate)).toFixed(1)}/с</span>
                            <span>ПЕРЕЗАР.: ${stats.reloadTime.toFixed(2)}с</span>
                        </div>
                        <footer class="shop-card-footer">
                        ${!unlocked ? `
                            <button type="button" class="shop-action-btn ${canBuy ? 'primary-buy' : ''}" data-buy-weapon="${idx}" ${!canBuy ? 'disabled' : ''}>
                                ${canBuy ? (w.craftable ? `СКРАФТИТЬ (${priceTxt})` : `КУПИТЬ (${priceTxt})`) : `НУЖНО ЕЩЁ ${missingStr}`}
                            </button>
                        ` : `
                            <button type="button" class="shop-action-btn equip-btn" data-assign-weapon="${idx}" data-slot="${this.selectedWeaponTargetSlot}">
                                ${equippedSlot === this.selectedWeaponTargetSlot ? `АКТИВНО В СЛОТЕ [${tgtSlot}]` : `ПОСТАВИТЬ В СЛОТ [${tgtSlot}]`}
                            </button>
                            <div class="slot-assign-row">
                                ${[0, 1, 2, 3, 4, 5].map(sIdx => `
                                    <button type="button" class="slot-mini-btn ${equippedSlot === sIdx ? 'active' : ''}" data-assign-weapon="${idx}" data-slot="${sIdx}">
                                        ${sIdx + 1}
                                    </button>
                                `).join('')}
                            </div>
                            <button type="button" class="shop-action-btn ${canUpg ? 'primary-buy' : ''}" data-weapon-upg="${idx}" ${maxed || !canUpg ? 'disabled' : ''}>
                                ${maxed ? 'МАКСИМАЛЬНЫЙ УРОВЕНЬ' : (canUpg ? `ПРОКАЧАТЬ +УРОН И ОБОЙМУ (${upgCost} МОН)` : `УР.+1: НУЖНО ЕЩЁ +${upgCost - g.coins} МОН`)}
                            </button>
                        `}
                        </footer>
                    </article>
                `;
            });
            html += '</div>';
            this.elShopContent.innerHTML = html;

            this.elShopContent.querySelectorAll('[data-wfilter]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.shopWeaponFilter = btn.dataset.wfilter;
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-wdock]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.selectedWeaponTargetSlot = Number(btn.dataset.wdock);
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-buy-weapon]').forEach(btn => {
                btn.addEventListener('click', () => { g.buyWeapon(Number(btn.dataset.buyWeapon)); this.renderShop(); });
            });
            this.elShopContent.querySelectorAll('[data-assign-weapon]').forEach(btn => {
                btn.addEventListener('click', () => {
                    g.assignWeaponToSlot(Number(btn.dataset.assignWeapon), Number(btn.dataset.slot));
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-weapon-upg]').forEach(btn => {
                btn.addEventListener('click', () => { g.upgradeWeapon(Number(btn.dataset.weaponUpg)); this.renderShop(); });
            });
        }

        _renderAttachmentsTab() {
            const g = this.game;
            if (!g.unlockedWeapons.has(this.selectedModWeaponIdx)) {
                this.selectedModWeaponIdx = g.getActiveWeaponIndex();
            }
            const wIdx = this.selectedModWeaponIdx;
            const w = XB.WEAPONS[wIdx];
            const ownedSet = g.ownedAttachments[wIdx];
            const eqMap = g.equippedAttachments[wIdx];

            let html = this._sectionHead(
                '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
                'ПОЛЕВЫЕ ПРИПАСЫ И ПОПОЛНЕНИЕ БК',
                'Мгновенная покупка за монеты перед следующей волной'
            );

            html += `
                <div class="shop-grid" style="grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));">
                    <article class="shop-card ${g.coins >= 35 && g.medkitCount < g.maxMedkits ? 'can-afford' : ''}">
                        <header class="shop-card-top">
                            <span class="shop-cat">Лечение [X]</span>
                            <span class="shop-status-pill">${g.medkitCount}/${g.maxMedkits}</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">ПОЛЕВАЯ АПТЕЧКА</h3>
                            <p class="shop-card-desc">Восстанавливает Здоровье и Щит прямо посреди боя.</p>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${g.coins >= 35 && g.medkitCount < g.maxMedkits ? 'primary-buy' : ''}" data-supply="medkit" ${g.coins < 35 || g.medkitCount >= g.maxMedkits ? 'disabled' : ''}>
                                ${g.medkitCount >= g.maxMedkits ? 'ПОЛНЫЙ ЗАПАС' : `КУПИТЬ (35 МОН)`}
                            </button>
                        </footer>
                    </article>
                    <article class="shop-card ${g.coins >= 40 && g.boostCharges < g.maxBoostCharges ? 'can-afford' : ''}">
                        <header class="shop-card-top">
                            <span class="shop-cat">Мобильность [Z]</span>
                            <span class="shop-status-pill">${g.boostCharges}/${g.maxBoostCharges}</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">БУСТЕР СКОРОСТИ</h3>
                            <p class="shop-card-desc">Овердрайв +48% к скорости и БХОП на короткое время.</p>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${g.coins >= 40 && g.boostCharges < g.maxBoostCharges ? 'primary-buy' : ''}" data-supply="boost" ${g.coins < 40 || g.boostCharges >= g.maxBoostCharges ? 'disabled' : ''}>
                                ${g.boostCharges >= g.maxBoostCharges ? 'ПОЛНЫЙ ЗАПАС' : `КУПИТЬ (40 МОН)`}
                            </button>
                        </footer>
                    </article>
                    <article class="shop-card ${g.coins >= 50 ? 'can-afford' : ''}">
                        <header class="shop-card-top">
                            <span class="shop-cat">Комплект</span>
                            <span class="shop-status-pill coin-ok">50 МОН</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">ПОЛНЫЙ БОЕКОМПЛЕКТ</h3>
                            <p class="shop-card-desc">Перезаряжает ВСЕ 12 пушек и чинит броню/щит до 100%.</p>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${g.coins >= 50 ? 'primary-buy' : ''}" data-supply="full" ${g.coins < 50 ? 'disabled' : ''}>
                                ВОССТАНОВИТЬ ВСЁ (50 МОН)
                            </button>
                        </footer>
                    </article>
                </div>
            `;

            html += this._sectionHead(
                '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
                'ТЮНИНГ ОРУЖИЯ (ОБВЕСЫ)',
                'Выберите пушку ниже и установите до 4 модификаций: Ствол, Магазин, Оптику и Ядро'
            );

            html += '<div class="loadout-strip">';
            XB.WEAPONS.forEach((wp, idx) => {
                const isUnlocked = g.unlockedWeapons.has(idx);
                if (!isUnlocked) {
                    html += `<button type="button" class="shop-dock-btn" disabled style="opacity:0.35; cursor:not-allowed;" title="Сначала купите оружие во вкладке Оружие">${wp.shortName}</button>`;
                } else {
                    html += `<button type="button" class="shop-dock-btn ${idx === wIdx ? 'target' : ''}" data-mod-weapon="${idx}">${wp.shortName}</button>`;
                }
            });
            html += '</div>';

            const stats = g.combat.getWeaponStats(wIdx, g.weaponLevels[wIdx], eqMap);
            html += `
                <div class="shop-guide-banner">
                    <div>
                        <strong>${w.name} (Ур. ${g.weaponLevels[wIdx]}/8)</strong>
                        <span class="font-mono"> • Урон ${stats.damage} • Обойма ${w.usesPolymer ? 'ПОЛИМЕР' : stats.maxAmmo} • Разброс ${(stats.spread * 100).toFixed(1)}% • Перезарядка ${stats.reloadTime.toFixed(2)}с</span>
                    </div>
                </div>
            `;

            const slotMeta = [
                { key: 'barrel', title: 'СТВОЛ', desc: 'Усиливает урон, точность и дульную баллистику' },
                { key: 'mag', title: 'МАГАЗИН / ПИТАНИЕ', desc: 'Расширяет боезапас и ускоряет перезарядку' },
                { key: 'optic', title: 'ОПТИКА И ПРИЦЕЛ', desc: 'Снижает разброс при стрейфах и БХОПе' },
                { key: 'core', title: 'ЯДРО / БОЕПРИПАС', desc: 'Добавляет пробитие, криты или энергоэффект' }
            ];

            for (const s of slotMeta) {
                html += `
                    <div class="shop-section-head" style="margin-top:10px;">
                        <span class="shop-section-title">${s.title}</span>
                        <span class="shop-section-sub">${s.desc}</span>
                    </div>
                    <div class="shop-grid">
                `;
                for (const att of XB.ATTACHMENTS[s.key]) {
                    const key = `${s.key}:${att.id}`;
                    const owned = ownedSet.has(key);
                    const equipped = eqMap[s.key] === att.id;
                    const canBuy = !owned && g.coins >= att.costCoins;
                    const needMore = Math.max(0, att.costCoins - g.coins);
                    html += `
                        <article class="shop-card ${equipped ? 'equipped' : (canBuy ? 'can-afford' : '')}">
                            <header class="shop-card-top">
                                <span class="shop-cat">${s.title}</span>
                                <span class="shop-status-pill ${equipped ? 'ready' : (canBuy ? 'coin-ok' : '')}">
                                    ${equipped ? 'УСТАНОВЛЕНО' : (owned ? 'КУПЛЕНО' : `${att.costCoins} МОН`)}
                                </span>
                            </header>
                            <div>
                                <h3 class="shop-card-title">${att.name}</h3>
                                <p class="shop-card-desc">${att.desc}</p>
                            </div>
                            <footer class="shop-card-footer">
                                <button type="button" class="shop-action-btn ${canBuy ? 'primary-buy' : (owned && !equipped ? 'equip-btn' : '')}" data-att-buy="${wIdx}:${s.key}:${att.id}" ${!owned && !canBuy ? 'disabled' : ''}>
                                    ${equipped ? 'СНЯТЬ ОБВЕС' : (owned ? 'УСТАНОВИТЬ НА ОРУЖИЕ' : (canBuy ? `КУПИТЬ И НАДЕТЬ (${att.costCoins} МОН)` : `НУЖНО ЕЩЁ +${needMore} МОН`))}
                                </button>
                            </footer>
                        </article>
                    `;
                }
                html += '</div>';
            }

            this.elShopContent.innerHTML = html;

            this.elShopContent.querySelectorAll('[data-mod-weapon]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.selectedModWeaponIdx = Number(btn.dataset.modWeapon);
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-att-buy]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const [wi, sl, aid] = btn.dataset.attBuy.split(':');
                    g.buyOrToggleAttachment(Number(wi), sl, aid);
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-supply]').forEach(btn => {
                btn.addEventListener('click', () => { g.buySupply(btn.dataset.supply); this.renderShop(); });
            });
        }

        _renderCraftTab() {
            const g = this.game;
            const b = g.building;
            const vulcanIdx = XB.WEAPONS.findIndex(w => w.id === 'vulcan_gatling');
            const vulcan = XB.WEAPONS[vulcanIdx];
            const vulcanUnlocked = g.unlockedWeapons.has(vulcanIdx);

            const wallCost = 6 + b.wallHpLvl * 5;
            const turretCost = 10 + (b.maxTurrets - 4) * 8;

            let html = `
                <div class="shop-guide-banner">
                    <div>
                        <strong>ИНЖЕНЕРНЫЙ ТЕРМИНАЛ БАЗЫ [C]</strong>
                        <span> • Построек на карте: ${b.structures.length} • Активных турелей: ${b.turrets.length}/${b.maxTurrets}</span>
                    </div>
                    <span class="shop-status-pill ready">ПОСТОЯННАЯ СТРОЙКА: АВТОРЕМОНТ МЕЖДУ ВОЛНАМИ</span>
                </div>
            `;

            html += this._sectionHead(
                '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>',
                'УКРЕПЛЕНИЕ БАЗЫ И КРАФТ ГАТЛИНГА',
                'Фундаментальные улучшения фортификаций (Кристаллы) и тяжёлый пулемёт'
            );

            html += '<div class="shop-grid" style="grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));">';
            html += `
                <article class="shop-card ${g.crystals >= wallCost ? 'can-afford' : ''}">
                    <header class="shop-card-top">
                        <span class="shop-cat">Прочность фортов</span>
                        <span class="shop-status-pill ${g.crystals >= wallCost ? 'price-ok' : ''}">Ур. ${b.wallHpLvl}</span>
                    </header>
                    <div>
                        <h3 class="shop-card-title">УКРЕПЛЕНИЕ ФОРТ-СТЕН</h3>
                        <p class="shop-card-desc">+22% к прочности всех стен, ДОТов и рамп при строительстве.</p>
                    </div>
                    <footer class="shop-card-footer">
                        <button type="button" class="shop-action-btn ${g.crystals >= wallCost ? 'primary-buy' : ''}" data-bing="wall" ${g.crystals < wallCost ? 'disabled' : ''}>
                            ${g.crystals >= wallCost ? `УСИЛИТЬ (${wallCost} КР)` : `НУЖНО ЕЩЁ +${wallCost - g.crystals} КР`}
                        </button>
                    </footer>
                </article>
                <article class="shop-card ${b.maxTurrets < 8 && g.crystals >= turretCost ? 'can-afford' : ''}">
                    <header class="shop-card-top">
                        <span class="shop-cat">Авто-оборона</span>
                        <span class="shop-status-pill ${b.maxTurrets < 8 && g.crystals >= turretCost ? 'price-ok' : ''}">Макс. ${b.maxTurrets}/8</span>
                    </header>
                    <div>
                        <h3 class="shop-card-title">КОНТРОЛЛЕР ТУРЕЛЕЙ</h3>
                        <p class="shop-card-desc">+1 к лимиту одновременно активных Полимерных и Гатлинг-турелей.</p>
                    </div>
                    <footer class="shop-card-footer">
                        <button type="button" class="shop-action-btn ${b.maxTurrets < 8 && g.crystals >= turretCost ? 'primary-buy' : ''}" data-bing="turret" ${b.maxTurrets >= 8 || g.crystals < turretCost ? 'disabled' : ''}>
                            ${b.maxTurrets >= 8 ? 'ДОСТИГНУТ МАКСИМУМ' : (g.crystals >= turretCost ? `РАСШИРИТЬ +1 (${turretCost} КР)` : `НУЖНО ЕЩЁ +${turretCost - g.crystals} КР`)}
                        </button>
                    </footer>
                </article>
            `;
            if (vulcan) {
                const canCraft = !vulcanUnlocked && g.coins >= vulcan.costCoins && g.crystals >= (vulcan.costCrystals || 0);
                html += `
                    <article class="shop-card ${vulcanUnlocked ? 'equipped' : (canCraft ? 'can-afford' : '')}">
                        <header class="shop-card-top">
                            <span class="shop-cat" style="color:#f97316">Крафт Оружия</span>
                            <span class="shop-status-pill ${vulcanUnlocked ? 'ready' : (canCraft ? 'coin-ok' : '')}">${vulcanUnlocked ? 'В АРСЕНАЛЕ' : `${vulcan.costCoins}М + ${vulcan.costCrystals}КР`}</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">${vulcan.name}</h3>
                            <p class="shop-card-desc">${vulcan.note}</p>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${canCraft ? 'primary-buy' : ''}" data-craft-vulcan="1" ${vulcanUnlocked || !canCraft ? 'disabled' : ''}>
                                ${vulcanUnlocked ? 'УЖЕ СКРАФЧЕНО (В ОРУЖИИ)' : `СООРУДИТЬ ГАТЛИНГ (${vulcan.costCoins}М + ${vulcan.costCrystals}КР)`}
                            </button>
                        </footer>
                    </article>
                `;
            }
            html += '</div>';

            html += this._sectionHead(
                '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
                'ЧЕРТЕЖИ СТРОЙКИ [КЛАВИША C В БОЮ]',
                'Постоянные конструкции за Монеты чинятся сами в конце каждой волны'
            );

            html += '<div class="shop-grid">';
            XB.BUILD_BLUEPRINTS.forEach((bp, bpIdx) => {
                const isSel = b.selectedBlueprintIdx === bpIdx;
                const costLabel = bp.costCoins > 0 ? `${bp.costCoins} МОН` : `${bp.costPoly} ПОЛИМ`;
                html += `
                    <article class="shop-card ${isSel ? 'equipped' : ''}">
                        <header class="shop-card-top">
                            <span class="shop-cat">${bp.permanent ? 'Постоянно (∞)' : 'Быстро (38с)'} • [${bpIdx + 1}]</span>
                            <span class="shop-status-pill ${isSel ? 'ready' : ''}">${costLabel}</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">${bp.name}</h3>
                            <p class="shop-card-desc">${bp.desc}</p>
                        </div>
                        <div class="shop-stats-mini font-mono">
                            <span>ПРОЧНОСТЬ: ${Math.round((bp.hp || 400) * (1 + b.wallHpLvl * 0.22))}</span>
                            <span>${bp.permanent ? 'АВТОРЕМОНТ: ДА' : 'ТИП: БАРЬЕР'}</span>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${isSel ? '' : 'equip-btn'}" data-select-bp="${bpIdx}">
                                ${isSel ? 'АКТИВНО ДЛЯ [C]' : `ВЫБРАТЬ ЧЕРТЁЖ [${bpIdx + 1}]`}
                            </button>
                        </footer>
                    </article>
                `;
            });
            html += '</div>';

            html += this._sectionHead(
                '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
                'МОДУЛИ НА СТЕНЫ [КЛАВИША U / ПКМ НАД СТЕНОЙ]',
                'Усиливайте уже построенные стены тесла-катушками, бронещитами и регенераторами'
            );

            html += '<div class="shop-grid">';
            XB.WALL_ATTACHMENTS.forEach(att => {
                const unlocked = b.unlockedWallAttachments.has(att.id);
                const selected = b.selectedAttachmentId === att.id;
                const canUnlock = !unlocked && g.coins >= att.unlockCoins;
                html += `
                    <article class="shop-card ${selected ? 'equipped' : (canUnlock ? 'can-afford' : '')}">
                        <header class="shop-card-top">
                            <span class="shop-cat" style="color:${att.color}">Модуль стены [U]</span>
                            <span class="shop-status-pill ${selected ? 'ready' : (canUnlock ? 'coin-ok' : '')}">${unlocked ? `${att.applyCoins}М / уст.` : `${att.unlockCoins} МОН`}</span>
                        </header>
                        <div>
                            <h3 class="shop-card-title">${att.name}</h3>
                            <p class="shop-card-desc">${att.desc}</p>
                        </div>
                        <footer class="shop-card-footer">
                            <button type="button" class="shop-action-btn ${canUnlock ? 'primary-buy' : (unlocked && !selected ? 'equip-btn' : '')}" data-watt="${att.id}" ${!unlocked && !canUnlock ? 'disabled' : ''}>
                                ${unlocked ? (selected ? 'ВЫБРАНО ДЛЯ [U]' : 'ВЫБРАТЬ ДЛЯ [U]') : (canUnlock ? `ОТКРЫТЬ ЧЕРТЁЖ (${att.unlockCoins} МОН)` : `НУЖНО ЕЩЁ +${att.unlockCoins - g.coins} МОН`)}
                            </button>
                        </footer>
                    </article>
                `;
            });
            html += '</div>';

            this.elShopContent.innerHTML = html;

            this.elShopContent.querySelectorAll('[data-select-bp]').forEach(btn => {
                btn.addEventListener('click', () => {
                    g.building.selectBlueprint(Number(btn.dataset.selectBp));
                    this.rebuildBuildBar();
                    g.showToast(`ЧЕРТЁЖ ВЫБРАН: Нажмите [C] для постройки!`, '#4ade80');
                    this.renderShop();
                });
            });
            this.elShopContent.querySelectorAll('[data-watt]').forEach(btn => {
                btn.addEventListener('click', () => {
                    g.unlockOrSelectWallAttachment(btn.dataset.watt);
                    this.renderShop();
                });
            });
            const craftBtn = this.elShopContent.querySelector('[data-craft-vulcan]');
            if (craftBtn && vulcanIdx !== -1) {
                craftBtn.addEventListener('click', () => {
                    g.buyWeapon(vulcanIdx);
                    this.renderShop();
                });
            }
            this.elShopContent.querySelectorAll('[data-bing]').forEach(btn => {
                btn.addEventListener('click', () => {
                    g.upgradeBuildingTech(btn.dataset.bing);
                    this.renderShop();
                });
            });
        }

        // =====================================================================
        // HUD SYNC & RADAR
        // =====================================================================
        syncHUD() {
            const g = this.game;
            const wIdx = g.getActiveWeaponIndex();
            const w = XB.WEAPONS[wIdx];
            const stats = g.combat.getWeaponStats(wIdx, g.weaponLevels[wIdx], g.equippedAttachments[wIdx]);
            const armor = g.getEffectiveArmor();

            this.elWave.textContent = g.wave;
            this.elEnemies.textContent = g.waveState === 'INTERMISSION' ? 'ПЕРЕРЫВ' : (g.enemies.getAliveCount() + g.enemiesToSpawn.length);
            this.elCoins.textContent = g.coins;
            this.elCrystals.textContent = g.crystals;
            this.elScore.textContent = g.score;

            this.elArmorName.textContent = armor.name;
            this.elArmorCat.textContent = armor.category;

            const hpPct = Math.max(0, Math.round((g.hp / armor.maxHp) * 100));
            const shPct = Math.max(0, Math.round((g.shield / armor.maxShield) * 100));
            const polyPct = Math.max(0, Math.round((g.combat.polymerEnergy / g.combat.maxPolymerEnergy) * 100));

            this.elHpFill.style.width = `${hpPct}%`;
            this.elHpText.textContent = `${Math.ceil(g.hp)} / ${armor.maxHp}`;
            this.elShieldFill.style.width = `${shPct}%`;
            this.elShieldText.textContent = `${Math.ceil(g.shield)} / ${armor.maxShield}`;
            this.elPolyFill.style.width = `${polyPct}%`;
            this.elPolyText.textContent = `${Math.floor(g.combat.polymerEnergy)} / ${g.combat.maxPolymerEnergy}`;

            const wLvl = g.weaponLevels[wIdx];
            this.elWeaponName.textContent = `${w.name} [УР.${wLvl}]`;
            this.elWeaponNote.textContent = w.note;

            if (w.usesPolymer) {
                this.elAmmoCur.textContent = Math.floor(g.combat.polymerEnergy);
                this.elAmmoMax.textContent = '/ ПОЛИМЕР';
            } else {
                this.elAmmoCur.textContent = g.ammo[wIdx];
                this.elAmmoMax.textContent = `/ ${stats.maxAmmo}`;
            }

            this.elBoostCount.textContent = g.boostCharges;
            this.elBoostChip.classList.toggle('active-boost', g.boostActiveTimer > 0);
            this.elBoostChip.classList.toggle('empty', g.boostCharges <= 0 && g.boostActiveTimer <= 0);
            this.elMedkitCount.textContent = g.medkitCount;
            this.elMedkitChip.classList.toggle('empty', g.medkitCount <= 0);

            if (this.elIntermissionBanner) {
                this.elIntermissionBanner.classList.toggle('show', g.waveState === 'INTERMISSION');
                if (g.waveState === 'INTERMISSION') {
                    this.elIntermissionBanner.textContent = `ПЕРЕРЫВ • [B] МАГАЗИН • ВЫСТРЕЛИТЕ В ЗОЛОТОЙ МАЯК ДЛЯ ВОЛНЫ ${g.wave + 1}`;
                }
            }

            if (this.elBuildBar) {
                this.elBuildBar.classList.toggle('show', Boolean(g.building && g.building.buildMode));
            }
            if (this.elWallAttachPrompt && g.building) {
                const st = g.building.hoveredStructure;
                const att = XB.WALL_ATTACHMENTS.find(a => a.id === g.building.selectedAttachmentId);
                this.elWallAttachPrompt.classList.toggle('show', Boolean(st));
                if (st && att) {
                    this.elWallAttachPrompt.textContent = `Укрепление (${Math.round(st.hp)}/${st.maxHp} ОЗ) • [U] Обвес: ${att.name} (${att.applyCoins} МОН)`;
                }
            }

            const nextArmor = XB.ARMORS.find((ar, idx) => !g.unlockedArmors.has(idx));
            this.btnShopHud.classList.toggle('shop-ready', Boolean(nextArmor && g.crystals >= nextArmor.costCrystals));

            this.gloveSlotEls.forEach((slot, sIdx) => {
                const pIdx = g.combat.equippedGloveSlots[sIdx];
                const cd = g.combat.gloveCooldowns[pIdx] || 0;
                slot.btn.classList.toggle('active', sIdx === g.combat.activeSlotIndex);
                slot.btn.classList.toggle('cooling', cd > 0);
                if (cd > 0) {
                    slot.cdEl.style.display = 'flex';
                    slot.cdEl.textContent = cd.toFixed(1);
                } else {
                    slot.cdEl.style.display = 'none';
                }
            });
        }

        renderRadar() {
            const g = this.game;
            const ctx = this.radarCtx;
            const size = this.radarCanvas.width;
            const cx = size / 2;
            const cy = size / 2;
            const range = 92;

            ctx.clearRect(0, 0, size, size);

            ctx.strokeStyle = 'rgba(74, 222, 128, 0.2)';
            ctx.lineWidth = 1;
            [0.33, 0.66, 0.96].forEach(r => {
                ctx.beginPath();
                ctx.arc(cx, cy, cx * r, 0, Math.PI * 2);
                ctx.stroke();
            });

            ctx.fillStyle = 'rgba(74, 222, 128, 0.14)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, cx * 0.94, -Math.PI * 0.72, -Math.PI * 0.28);
            ctx.closePath();
            ctx.fill();

            const cosY = Math.cos(g.player.yaw);
            const sinY = Math.sin(g.player.yaw);
            const pPos = g.player.pos;

            const toRadar = (wx, wz) => {
                const dx = wx - pPos.x;
                const dz = wz - pPos.z;
                const rx = dx * cosY - dz * sinY;
                const rz = dx * sinY + dz * cosY;
                let px = cx + (rx / range) * (cx - 6);
                let py = cy + (rz / range) * (cy - 6);
                const d = Math.hypot(px - cx, py - cy);
                const clamped = d > cx - 5;
                if (clamped) {
                    px = cx + ((px - cx) / d) * (cx - 5);
                    py = cy + ((py - cy) / d) * (cy - 5);
                }
                return { px, py, clamped };
            };

            if (g.map.armoryTerminal) {
                const { px, py } = toRadar(g.map.armoryTerminal.x, g.map.armoryTerminal.z);
                ctx.fillStyle = '#4ade80';
                ctx.fillRect(px - 3, py - 3, 6, 6);
            }

            // Show Shootable Wave Trigger Buttons on radar during Intermission!
            if (g.waveState === 'INTERMISSION') {
                ctx.fillStyle = '#facc15';
                for (const wb of g.map.waveButtons) {
                    const { px, py } = toRadar(wb.x, wb.z);
                    ctx.beginPath();
                    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
            for (const idx of g.activeDoorIndices) {
                const door = g.map.breachDoors[idx];
                const { px, py } = toRadar(door.x, -94);
                ctx.fillRect(px - 3, py - 3, 6, 6);
            }

            for (const a of g.enemies.aliens) {
                if (a.dying) continue;
                const { px, py } = toRadar(a.group.position.x, a.group.position.z);
                ctx.fillStyle = a.cfg.isBoss ? '#facc15' : (a.cfg.ranged ? '#38bdf8' : (a.cfg.role === 'tank' ? '#f97316' : '#fb7185'));
                ctx.beginPath();
                ctx.arc(px, py, a.cfg.isBoss ? 5.0 : (a.cfg.role === 'tank' ? 3.8 : 2.7), 0, Math.PI * 2);
                ctx.fill();
            }

            for (const pk of g.combat.pickups) {
                const { px, py, clamped } = toRadar(pk.mesh.position.x, pk.mesh.position.z);
                if (!clamped) {
                    ctx.fillStyle = pk.type === 'crystal' ? '#67e8f9' : (pk.type === 'coin' ? '#facc15' : '#4ade80');
                    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
                }
            }

            if (g.building) {
                ctx.fillStyle = 'rgba(103, 232, 249, 0.72)';
                for (const st of g.building.structures) {
                    const { px, py } = toRadar(st.x, st.z);
                    ctx.fillRect(px - 2, py - 2, 4, 4);
                }
                for (const t of g.building.turrets) {
                    const { px, py } = toRadar(t.x, t.z);
                    ctx.fillStyle = t.isGatling ? '#f97316' : '#4ade80';
                    ctx.beginPath();
                    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.fillStyle = '#ECFDF5';
            ctx.beginPath();
            ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    XB.HudAndShopUI = HudAndShopUI;
})(window);
