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
            document.querySelectorAll('.shop-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.activeShopTab = btn.dataset.tab;
                    document.querySelectorAll('.shop-tab-btn').forEach(b => {
                        b.dataset.active = (b === btn) ? 'true' : 'false';
                    });
                    this.renderShop();
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
        renderShop() {
            const g = this.game;
            this.elShopCoins.textContent = g.coins;
            this.elShopCrystals.textContent = g.crystals;
            const qf = document.getElementById('btn-shop-quickfill');
            if (qf) qf.disabled = g.coins < 50;

            if (this.activeShopTab === 'armor') this._renderArmorTab();
            else if (this.activeShopTab === 'glove') this._renderGloveTab();
            else if (this.activeShopTab === 'weapons') this._renderWeaponsTab();
            else if (this.activeShopTab === 'attachments') this._renderAttachmentsTab();
            else this._renderCraftTab();
        }

        _renderArmorTab() {
            const g = this.game;
            let html = '<div class="shop-grid">';
            XB.ARMORS.forEach((a, idx) => {
                const unlocked = g.unlockedArmors.has(idx);
                const equipped = g.armorIndex === idx;
                const canAfford = g.crystals >= a.costCrystals;
                html += `
                    <div class="shop-card ${equipped ? 'equipped' : ''}">
                        <div>
                            <div class="shop-card-top">
                                <span class="shop-cat" style="color:${a.accentColor}">${a.category}</span>
                                <span class="font-mono" style="font-size:11px; color:var(--crystal-cyan)">${a.costCrystals} КР</span>
                            </div>
                            <h3 class="shop-card-title" style="margin:8px 0 6px;">${a.name}</h3>
                            <p class="shop-card-desc">${a.summary}</p>
                        </div>
                        <div class="shop-stats-mini font-mono">
                            <span>ОЗ: ${a.maxHp + g.armorPlateLvl * 25}</span>
                            <span>ЩИТ: ${a.maxShield + g.armorCapLvl * 25}</span>
                            <span>БРОНЯ: ${Math.round(a.damageReduction * 100)}%</span>
                            <span>БХОП: ${a.bhopMaxSpeed} м/с</span>
                            <span>СКОР: ${Math.round(a.speedMult * 100)}%</span>
                            <span>СТРЕЙФ: ${Math.round(a.airAccelMult * 100)}%</span>
                        </div>
                        <button class="shop-action-btn" data-armor-idx="${idx}" ${(!unlocked && !canAfford) || equipped ? 'disabled' : ''}>
                            ${equipped ? 'ЭКИПИРОВАНО' : (unlocked ? 'НАДЕТЬ БРОНЮ' : `КУПИТЬ (${a.costCrystals} КР)`)}
                        </button>
                    </div>
                `;
            });
            html += '</div>';

            const plateCost = 6 + g.armorPlateLvl * 5;
            const capCost = 6 + g.armorCapLvl * 5;
            const servoCost = 8 + g.armorServoLvl * 6;
            html += `
                <div class="shop-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
                    <div class="shop-card">
                        <div>
                            <span class="shop-cat">Модуль брони • Ур. ${g.armorPlateLvl}</span>
                            <h3 class="shop-card-title" style="margin:6px 0;">ТИТАНОВЫЕ ПЛАСТИНЫ</h3>
                            <p class="shop-card-desc">+25 к макс. Здоровью на любой надетой броне.</p>
                        </div>
                        <button class="shop-action-btn" data-core="plate" ${g.crystals < plateCost ? 'disabled' : ''}>УЛУЧШИТЬ (${plateCost} КР)</button>
                    </div>
                    <div class="shop-card">
                        <div>
                            <span class="shop-cat">Модуль щита • Ур. ${g.armorCapLvl}</span>
                            <h3 class="shop-card-title" style="margin:6px 0;">КВАНТ-КОНДЕНСАТОР</h3>
                            <p class="shop-card-desc">+25 к макс. Энергощиту и +10% скорости регена.</p>
                        </div>
                        <button class="shop-action-btn" data-core="cap" ${g.crystals < capCost ? 'disabled' : ''}>УЛУЧШИТЬ (${capCost} КР)</button>
                    </div>
                    <div class="shop-card">
                        <div>
                            <span class="shop-cat">Модуль приводов • Ур. ${g.armorServoLvl}</span>
                            <h3 class="shop-card-title" style="margin:6px 0;">ГИРО-СЕРВОПРИВОДЫ</h3>
                            <p class="shop-card-desc">+4% к скорости бега, эйр-стрейфа и потолку БХОП.</p>
                        </div>
                        <button class="shop-action-btn" data-core="servo" ${g.crystals < servoCost ? 'disabled' : ''}>УЛУЧШИТЬ (${servoCost} КР)</button>
                    </div>
                </div>
            `;

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

            let html = '<div class="loadout-strip">';
            html += '<span class="shop-cat">ЦЕЛЕВАЯ ЯЧЕЙКА (6 ЯЧЕЕК ПЕРЧАТКИ):</span>';
            c.equippedGloveSlots.forEach((pIdx, sIdx) => {
                const p = XB.GLOVE_POWERS[pIdx];
                const meta = XB.GLOVE_SLOT_META[sIdx];
                const isTgt = sIdx === this.selectedGloveTargetSlot;
                html += `<button class="shop-dock-btn ${isTgt ? 'target' : ''}" data-gdock="${sIdx}" style="border-color:${isTgt ? 'var(--coin-gold)' : p.color}; color:${p.color}">${meta.keyHint}: ${p.shortName}</button>`;
            });
            html += '</div><div class="shop-grid">';

            XB.GLOVE_POWERS.forEach((p, idx) => {
                const unlocked = c.unlockedPowers.has(idx);
                const equippedSlot = c.equippedGloveSlots.indexOf(idx);
                const upg = c.gloveUpgrades[idx];

                const costPow = 5 + upg.power * 4;
                const costArea = 5 + upg.area * 4;
                const costEff = 5 + upg.efficiency * 4;

                html += `
                    <div class="shop-card ${equippedSlot !== -1 ? 'equipped' : ''}">
                        <div>
                            <div class="shop-card-top">
                                <span class="shop-cat" style="color:${p.color}">${equippedSlot !== -1 ? `ЯЧЕЙКА ${XB.GLOVE_SLOT_META[equippedSlot].keyHint}` : 'В ЗАПАСЕ'}</span>
                                <span class="font-mono" style="font-size:11px; color:var(--crystal-cyan)">${unlocked ? 'ОТКРЫТО' : `${p.costCrystals} КР`}</span>
                            </div>
                            <h3 class="shop-card-title" style="margin:6px 0;">${p.name}</h3>
                            <p class="shop-card-desc">${p.desc}</p>
                        </div>
                        ${!unlocked ? `
                            <button class="shop-action-btn" data-unlock-power="${idx}" ${g.crystals < p.costCrystals ? 'disabled' : ''}>
                                РАЗБЛОКИРОВАТЬ (${p.costCrystals} КР)
                            </button>
                        ` : `
                            <button class="shop-action-btn" data-assign-power="${idx}" data-slot="${this.selectedGloveTargetSlot}">
                                ${equippedSlot === this.selectedGloveTargetSlot ? `ЭКИПИРОВАНО В [${XB.GLOVE_SLOT_META[this.selectedGloveTargetSlot].wheelKeyHint}]` : `ПОСТАВИТЬ В ЯЧЕЙКУ [${XB.GLOVE_SLOT_META[this.selectedGloveTargetSlot].wheelKeyHint}]`}
                            </button>
                            <div class="slot-assign-row">
                                ${XB.GLOVE_SLOT_META.map((m, sIdx) => `
                                    <button class="slot-mini-btn ${equippedSlot === sIdx ? 'active' : ''}" data-assign-power="${idx}" data-slot="${sIdx}" title="Установить в ячейку ${m.keyHint}">
                                        ${m.wheelKeyHint}
                                    </button>
                                `).join('')}
                            </div>
                            <div class="sub-upg-list">
                                <button class="sub-upg-btn" data-gupg="${idx}:power" ${upg.power >= 6 || g.crystals < costPow ? 'disabled' : ''}>
                                    <span>Сила Ур.${upg.power}/6</span>
                                    <span>${upg.power >= 6 ? 'МАКС' : `${costPow} КР`}</span>
                                </button>
                                <button class="sub-upg-btn" data-gupg="${idx}:area" ${upg.area >= 6 || g.crystals < costArea ? 'disabled' : ''}>
                                    <span>Радиус/Длит. Ур.${upg.area}/6</span>
                                    <span>${upg.area >= 6 ? 'МАКС' : `${costArea} КР`}</span>
                                </button>
                                <button class="sub-upg-btn" data-gupg="${idx}:efficiency" ${upg.efficiency >= 6 || g.crystals < costEff ? 'disabled' : ''}>
                                    <span>КД/Энергия Ур.${upg.efficiency}/6</span>
                                    <span>${upg.efficiency >= 6 ? 'МАКС' : `${costEff} КР`}</span>
                                </button>
                            </div>
                        `}
                    </div>
                `;
            });

            const polyCost = 8 + Math.floor((c.maxPolymerEnergy - 100) / 25) * 7;
            html += `
                <div class="shop-card">
                    <div>
                        <span class="shop-cat">Реактор перчатки и Гелиоса</span>
                        <h3 class="shop-card-title" style="margin:6px 0;">РЕЗЕРВУАР ПОЛИМЕРА</h3>
                        <p class="shop-card-desc">+25 макс. Полимера (сейчас ${c.maxPolymerEnergy}). Усиливает перчатку, сферу «Гелиоса» и турели!</p>
                    </div>
                    <button class="shop-action-btn" id="btn-upgrade-poly" ${g.crystals < polyCost ? 'disabled' : ''}>РАСШИРИТЬ (${polyCost} КР)</button>
                </div>
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

            let html = '<div class="loadout-strip">';
            html += '<span class="shop-cat">ВЫБЕРИТЕ СЛОТ (6 СЛОТОВ ОРУЖИЯ):</span>';
            g.equippedWeaponSlots.forEach((wIdx, sIdx) => {
                const isTgt = sIdx === this.selectedWeaponTargetSlot;
                html += `<button class="shop-dock-btn ${isTgt ? 'target' : ''}" data-wdock="${sIdx}">[${sIdx + 1}] ${XB.WEAPONS[wIdx].shortName}</button>`;
            });
            html += '</div><div class="shop-grid">';

            XB.WEAPONS.forEach((w, idx) => {
                const unlocked = g.unlockedWeapons.has(idx);
                const equippedSlot = g.equippedWeaponSlots.indexOf(idx);
                const lvl = g.weaponLevels[idx];
                const maxed = lvl >= 8;
                const upgCost = 35 + lvl * 35;
                const stats = g.combat.getWeaponStats(idx, lvl, g.equippedAttachments[idx]);
                const needCrys = w.costCrystals || 0;
                const canBuy = g.coins >= w.costCoins && g.crystals >= needCrys;
                const priceTxt = needCrys > 0 ? `${w.costCoins}М + ${needCrys}КР` : `${w.costCoins} МОН`;

                html += `
                    <div class="shop-card ${equippedSlot !== -1 ? 'equipped' : ''}">
                        <div>
                            <div class="shop-card-top">
                                <span class="shop-cat">${equippedSlot !== -1 ? `СЛОТ ${equippedSlot + 1}` : 'АРСЕНАЛ'} • УР.${lvl}/8</span>
                                <span class="font-mono" style="font-size:11px; color:var(--coin-gold)">${unlocked ? 'ДОСТУПНО' : priceTxt}</span>
                            </div>
                            <h3 class="shop-card-title" style="margin:6px 0;">${w.name}</h3>
                            <p class="shop-card-desc">${w.note}</p>
                        </div>
                        <div class="shop-stats-mini font-mono">
                            <span>УРОН: ${stats.damage}</span>
                            <span>ОБОЙМА: ${w.usesPolymer ? 'БЕСКОН. ПОЛИМЕР' : stats.maxAmmo}</span>
                        </div>
                        ${!unlocked ? `
                            <button class="shop-action-btn" data-buy-weapon="${idx}" ${!canBuy ? 'disabled' : ''}>
                                ${w.craftable ? `СКРАФТИТЬ (${priceTxt})` : `КУПИТЬ (${priceTxt})`}
                            </button>
                        ` : `
                            <button class="shop-action-btn" data-assign-weapon="${idx}" data-slot="${this.selectedWeaponTargetSlot}" style="background:rgba(56,189,248,0.16); border-color:var(--crystal-cyan);">
                                ${equippedSlot === this.selectedWeaponTargetSlot ? `ЭКИПИРОВАНО В СЛОТ [${this.selectedWeaponTargetSlot + 1}]` : `В СЛОТ [${this.selectedWeaponTargetSlot + 1}]`}
                            </button>
                            <div class="slot-assign-row">
                                ${[0, 1, 2, 3, 4, 5].map(sIdx => `
                                    <button class="slot-mini-btn ${equippedSlot === sIdx ? 'active' : ''}" data-assign-weapon="${idx}" data-slot="${sIdx}">
                                        ${sIdx + 1}
                                    </button>
                                `).join('')}
                            </div>
                            <button class="shop-action-btn" data-weapon-upg="${idx}" ${maxed || g.coins < upgCost ? 'disabled' : ''}>
                                ${maxed ? 'МАКС. УРОВЕНЬ' : `ПРОКАЧАТЬ УРОН+ОБОЙМУ (${upgCost} МОН)`}
                            </button>
                        `}
                    </div>
                `;
            });
            html += '</div>';
            this.elShopContent.innerHTML = html;

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

            // Weapon selector pills
            let html = '<div class="loadout-strip" style="flex-wrap:wrap;">';
            XB.WEAPONS.forEach((wp, idx) => {
                if (!g.unlockedWeapons.has(idx)) return;
                html += `<button class="slot-mini-btn ${idx === wIdx ? 'active' : ''}" style="padding:5px 11px;" data-mod-weapon="${idx}">${wp.shortName}</button>`;
            });
            html += '</div>';

            const stats = g.combat.getWeaponStats(wIdx, g.weaponLevels[wIdx], eqMap);
            html += `
                <div class="loadout-strip" style="margin-bottom:14px;">
                    <span class="shop-cat">${w.name}</span>
                    <span class="font-mono" style="font-size:12px;">Урон: ${stats.damage} • Обойма: ${w.usesPolymer ? 'ПОЛИМЕР' : stats.maxAmmo} • Разброс: ${(stats.spread * 100).toFixed(1)}% • Перезарядка: ${stats.reloadTime.toFixed(2)}с</span>
                </div>
                <div class="shop-grid">
            `;

            const slotTitles = { barrel: 'Ствол', mag: 'Магазин', optic: 'Оптика', core: 'Ядро / Боеприпас' };
            for (const slot of ['barrel', 'mag', 'optic', 'core']) {
                for (const att of XB.ATTACHMENTS[slot]) {
                    const key = `${slot}:${att.id}`;
                    const owned = ownedSet.has(key);
                    const equipped = eqMap[slot] === att.id;
                    html += `
                        <div class="shop-card ${equipped ? 'equipped' : ''}">
                            <div>
                                <div class="shop-card-top">
                                    <span class="shop-cat">${slotTitles[slot]}</span>
                                    <span class="font-mono" style="font-size:11px; color:var(--coin-gold)">${owned ? 'КУПЛЕНО' : `${att.costCoins} МОН`}</span>
                                </div>
                                <h3 class="shop-card-title" style="margin:6px 0;">${att.name}</h3>
                                <p class="shop-card-desc">${att.desc}</p>
                            </div>
                            <button class="shop-action-btn" data-att-buy="${wIdx}:${slot}:${att.id}" ${!owned && g.coins < att.costCoins ? 'disabled' : ''}>
                                ${equipped ? 'СНЯТЬ ОБВЕС' : (owned ? 'УСТАНОВИТЬ' : `КУПИТЬ (${att.costCoins} МОН)`)}
                            </button>
                        </div>
                    `;
                }
            }

            // Field Supplies
            html += `
                <div class="shop-card">
                    <div>
                        <span class="shop-cat">Припас</span>
                        <h3 class="shop-card-title" style="margin:6px 0;">ПОЛЕВАЯ АПТЕЧКА [X]</h3>
                        <p class="shop-card-desc">Восстанавливает ОЗ и Щит. В наличии: ${g.medkitCount}/${g.maxMedkits}</p>
                    </div>
                    <button class="shop-action-btn" data-supply="medkit" ${g.coins < 35 || g.medkitCount >= g.maxMedkits ? 'disabled' : ''}>КУПИТЬ (35 МОН)</button>
                </div>
                <div class="shop-card">
                    <div>
                        <span class="shop-cat">Припас</span>
                        <h3 class="shop-card-title" style="margin:6px 0;">БУСТЕР СКОРОСТИ [Z]</h3>
                        <p class="shop-card-desc">Овердрайв +48% скорости. В наличии: ${g.boostCharges}/${g.maxBoostCharges}</p>
                    </div>
                    <button class="shop-action-btn" data-supply="boost" ${g.coins < 40 || g.boostCharges >= g.maxBoostCharges ? 'disabled' : ''}>КУПИТЬ (40 МОН)</button>
                </div>
                <div class="shop-card">
                    <div>
                        <span class="shop-cat">Сервис</span>
                        <h3 class="shop-card-title" style="margin:6px 0;">ПОЛНЫЙ БОЕКОМПЛЕКТ</h3>
                        <p class="shop-card-desc">Заряжает все пушки и полностью чинит броню/щит.</p>
                    </div>
                    <button class="shop-action-btn" data-supply="full" ${g.coins < 50 ? 'disabled' : ''}>ВОССТАНОВИТЬ (50 МОН)</button>
                </div>
            `;

            html += '</div>';
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
                <div class="loadout-strip" style="justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <span class="shop-cat">ПОСТОЯННАЯ СТРОЙКА ЗА МОНЕТЫ [C] (АВТОРЕМОНТ ПОСЛЕ ВОЛНЫ) • ПОСТРОЕК: ${b.structures.length} • ТУРЕЛЕЙ: ${b.turrets.length}</span>
                </div>
                <div class="shop-grid">
            `;

            XB.BUILD_BLUEPRINTS.forEach((bp, bpIdx) => {
                const isSel = b.selectedBlueprintIdx === bpIdx;
                const costLabel = bp.costCoins > 0 ? `${bp.costCoins} МОН` : `${bp.costPoly} ПОЛИМ`;
                html += `
                    <div class="shop-card ${isSel ? 'equipped' : ''}">
                        <div>
                            <div class="shop-card-top">
                                <span class="shop-cat">${bp.permanent ? 'Постоянно (∞)' : 'Полимер (38с)'} • [${bpIdx + 1}]</span>
                                <span class="font-mono" style="font-size:11px; color:var(--coin-gold)">${costLabel}</span>
                            </div>
                            <h3 class="shop-card-title" style="margin:6px 0;">${bp.name}</h3>
                            <p class="shop-card-desc">${bp.desc}</p>
                        </div>
                        <button class="shop-action-btn" data-select-bp="${bpIdx}">
                            ${isSel ? 'ВЫБРАНО ДЛЯ [C]' : `ВЫБРАТЬ ЧЕРТЁЖ [${bpIdx + 1}]`}
                        </button>
                    </div>
                `;
            });

            XB.WALL_ATTACHMENTS.forEach(att => {
                const unlocked = b.unlockedWallAttachments.has(att.id);
                const selected = b.selectedAttachmentId === att.id;
                html += `
                    <div class="shop-card ${selected ? 'equipped' : ''}">
                        <div>
                            <div class="shop-card-top">
                                <span class="shop-cat" style="color:${att.color}">Обвес стены [U]</span>
                                <span class="font-mono" style="font-size:11px; color:var(--coin-gold)">${unlocked ? `${att.applyCoins}М за стену` : `${att.unlockCoins} МОН`}</span>
                            </div>
                            <h3 class="shop-card-title" style="margin:6px 0;">${att.name}</h3>
                            <p class="shop-card-desc">${att.desc}</p>
                        </div>
                        <button class="shop-action-btn" data-watt="${att.id}" ${!unlocked && g.coins < att.unlockCoins ? 'disabled' : ''}>
                            ${unlocked ? (selected ? 'ВЫБРАНО ДЛЯ [U]' : 'ВЫБРАТЬ ДЛЯ [U]') : `ОТКРЫТЬ ЧЕРТЁЖ (${att.unlockCoins} МОН)`}
                        </button>
                    </div>
                `;
            });

            if (vulcan) {
                const canCraft = g.coins >= vulcan.costCoins && g.crystals >= (vulcan.costCrystals || 0);
                html += `
                    <div class="shop-card ${vulcanUnlocked ? 'equipped' : ''}">
                        <div>
                            <div class="shop-card-top">
                                <span class="shop-cat" style="color:#f97316">Крафт Оружия</span>
                                <span class="font-mono" style="font-size:11px; color:var(--coin-gold)">${vulcanUnlocked ? 'СКРАФЧЕНО' : `${vulcan.costCoins}М + ${vulcan.costCrystals}КР`}</span>
                            </div>
                            <h3 class="shop-card-title" style="margin:6px 0;">${vulcan.name}</h3>
                            <p class="shop-card-desc">${vulcan.note}</p>
                        </div>
                        <button class="shop-action-btn" data-craft-vulcan="1" ${vulcanUnlocked || !canCraft ? 'disabled' : ''}>
                            ${vulcanUnlocked ? 'В АРСЕНАЛЕ (ВКЛАДКА ОРУЖИЕ)' : `СООРУДИТЬ ГАТЛИНГ (${vulcan.costCoins}М + ${vulcan.costCrystals}КР)`}
                        </button>
                    </div>
                `;
            }

            html += `
                <div class="shop-card">
                    <div>
                        <span class="shop-cat">Инженерия • Ур.${b.wallHpLvl}</span>
                        <h3 class="shop-card-title" style="margin:6px 0;">УКРЕПЛЕНИЕ ФОРТ-СТЕН</h3>
                        <p class="shop-card-desc">+22% к прочности всех стен, бойниц и рамп при постройке.</p>
                    </div>
                    <button class="shop-action-btn" data-bing="wall" ${g.crystals < wallCost ? 'disabled' : ''}>УСИЛИТЬ (${wallCost} КР)</button>
                </div>
                <div class="shop-card">
                    <div>
                        <span class="shop-cat">Оборона • Макс. ${b.maxTurrets}</span>
                        <h3 class="shop-card-title" style="margin:6px 0;">КОНТРОЛЛЕР ТУРЕЛЕЙ</h3>
                        <p class="shop-card-desc">+1 к лимиту одновременно активных Полимерных и Гатлинг-турелей.</p>
                    </div>
                    <button class="shop-action-btn" data-bing="turret" ${b.maxTurrets >= 8 || g.crystals < turretCost ? 'disabled' : ''}>${b.maxTurrets >= 8 ? 'МАКС' : `РАСШИРИТЬ (${turretCost} КР)`}</button>
                </div>
            `;
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
