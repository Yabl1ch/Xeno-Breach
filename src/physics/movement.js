/**
 * Deterministic Fixed-Timestep (120Hz) Kinematic Character Controller.
 * Implements authentic Quake/Source Air-Strafing, frictionless landing BHop,
 * Slide + Super-Jump, Tactical Dash, Wall-Sliding (ClipVelocity), Walkable Ramps,
 * Multi-Level Bridges, Grav-Jump Pads, and Armor Weight/Agility Modifiers.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    class PlayerController {
        constructor(mapBuilder, soundEngine) {
            this.map = mapBuilder;
            this.sound = soundEngine;

            this.FIXED_DT = 1 / 120;
            this.MAX_FRAME_DT = 0.12;
            this.GRAVITY = 26.2;
            this.PLAYER_RADIUS = 0.82;
            this.EYE_STAND = 2.08;
            this.EYE_SLIDE = 1.06;

            this.accumulator = 0;
            this.simTime = 0;

            this.prevPos = new THREE.Vector3(0, 0, 74);
            this.pos = new THREE.Vector3(0, 0, 74);
            this.renderPos = new THREE.Vector3(0, 0, 74);
            this.vel = new THREE.Vector3();

            this.yaw = 0;
            this.pitch = 0;
            this.currentEyeHeight = this.EYE_STAND;
            this.cameraRoll = 0;
            this.cameraShake = 0;
            this.bobTime = 0;

            this.onGround = true;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            this.jumpJustPressed = false;
            this.manualJumpTimestamp = -10;
            this.canDoubleJump = false;
            this.bhopStreak = 0;
            this.bhopResetTimer = 0;
            this.airStrafeGain = 0;
            this.airStrafeDisplayTimer = 0;

            this.slideTimer = 0;
            this.slideCooldown = 0;
            this.slideDir = new THREE.Vector3();

            this.dashCooldown = 0;
            this.dashActiveTimer = 0;

            this.moveTag = '';
            this.moveTagTimer = 0;

            // Reusable scratch vectors (avoid GC churn)
            this._fwd = new THREE.Vector3();
            this._right = new THREE.Vector3();
            this._wishDir = new THREE.Vector3();
            this._airWish = new THREE.Vector3();
        }

        reset() {
            this.accumulator = 0;
            this.simTime = 0;
            this.pos.set(0, 0, 74);
            this.prevPos.copy(this.pos);
            this.renderPos.copy(this.pos);
            this.vel.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0;
            this.currentEyeHeight = this.EYE_STAND;
            this.cameraRoll = 0;
            this.cameraShake = 0;
            this.bobTime = 0;
            this.onGround = true;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            this.jumpJustPressed = false;
            this.manualJumpTimestamp = -10;
            this.canDoubleJump = false;
            this.bhopStreak = 0;
            this.bhopResetTimer = 0;
            this.airStrafeGain = 0;
            this.airStrafeDisplayTimer = 0;
            this.slideTimer = 0;
            this.slideCooldown = 0;
            this.dashCooldown = 0;
            this.dashActiveTimer = 0;
            this.moveTag = '';
            this.moveTagTimer = 0;
        }

        queueJump() {
            this.jumpBufferTimer = 0.145;
            this.jumpJustPressed = true;
            this.manualJumpTimestamp = this.simTime;
        }

        tryStartSlide(armor, boostActive) {
            if (!this.onGround || this.slideTimer > 0 || this.slideCooldown > 0) return false;
            const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
            if (horizSpeed < 4.5) return false;

            this.slideTimer = 0.68;
            this.slideCooldown = 0.78;
            this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();

            const speedMult = (armor ? armor.speedMult : 1.0) * (boostActive ? 1.32 : 1.0);
            const slideSpd = Math.min(
                (armor ? armor.bhopMaxSpeed : 27) * (boostActive ? 1.2 : 1.0),
                Math.max(horizSpeed + 7.5, 19.2 * speedMult)
            );
            this.vel.x = this.slideDir.x * slideSpd;
            this.vel.z = this.slideDir.z * slideSpd;
            this.sound.playSlide();
            this.setMoveTag('ПОДКАТ', 0.75);
            return true;
        }

        tryDash(keys, joyInput, weapon, armor, boostActive) {
            if (this.dashCooldown > 0) return false;

            let f = 0;
            let r = 0;
            if (keys['KeyW'] || keys['ArrowUp']) f += 1;
            if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) r += 1;
            if (keys['KeyA'] || keys['ArrowLeft']) r -= 1;
            if (Math.abs(joyInput.x) > 0.1 || Math.abs(joyInput.y) > 0.1) {
                r += joyInput.x;
                f -= joyInput.y;
            }
            if (f === 0 && r === 0) f = 1;

            this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
            this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
            const dir = this._wishDir.set(0, 0, 0).addScaledVector(this._fwd, f).addScaledVector(this._right, r).normalize();

            const rawWeight = weapon.moveMult || 1.0;
            const mitigation = armor ? armor.heavyPenaltyMitigation : 0;
            const effWeight = rawWeight + (1.0 - rawWeight) * mitigation;
            const armorSpd = armor ? armor.speedMult : 1.0;

            const dashPower = (boostActive ? 29.5 : 24.0) * armorSpd * (0.7 + 0.3 * effWeight);
            // Preserve existing high speed if dashing in same direction
            const curInDir = Math.max(0, this.vel.x * dir.x + this.vel.z * dir.z);
            const finalDash = Math.max(dashPower, curInDir + 7.5);
            const cap = (armor ? armor.bhopMaxSpeed : 27) * (boostActive ? 1.25 : 1.05);
            const clampedDash = Math.min(cap, finalDash);

            this.vel.x = dir.x * clampedDash;
            this.vel.z = dir.z * clampedDash;
            if (!this.onGround && this.vel.y < 3.4) {
                this.vel.y = 3.4;
            }

            const cdMult = (armor ? armor.dashCdMult : 1.0) * (boostActive ? 0.65 : 1.0);
            this.dashCooldown = 2.0 * cdMult;
            this.dashActiveTimer = 0.22;
            this.sound.playDash();
            this.setMoveTag('ТАКТИЧЕСКИЙ РЫВОК', 0.65);
            return true;
        }

        setMoveTag(text, duration = 0.8) {
            this.moveTag = text;
            this.moveTagTimer = duration;
        }

        /**
         * Advances deterministic physics using an accumulator and returns interpolation alpha [0..1].
         */
        stepSimulation(frameDt, inputState) {
            const clampedDt = Math.min(frameDt, this.MAX_FRAME_DT);
            this.accumulator += clampedDt;

            while (this.accumulator >= this.FIXED_DT) {
                this.prevPos.copy(this.pos);
                this._fixedStep(this.FIXED_DT, inputState);
                this.simTime += this.FIXED_DT;
                this.accumulator -= this.FIXED_DT;
                this.jumpJustPressed = false;
            }

            const alpha = this.accumulator / this.FIXED_DT;
            this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);

            // Smooth camera roll, eye height (Standing vs Slide vs Hold-Ctrl Crouch!) & bob at render rate
            const moveRight = inputState.moveRight;
            const holdingCtrl = Boolean(inputState.keys && inputState.keys['ControlLeft']);
            this.isCrouching = holdingCtrl;
            const targetEye = (this.slideTimer > 0 || holdingCtrl) ? this.EYE_SLIDE : this.EYE_STAND;
            this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1, clampedDt * 15);

            const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
            if (this.onGround && this.slideTimer <= 0 && horizSpeed > 1.2) {
                this.bobTime += clampedDt * Math.min(19, horizSpeed * 0.88);
            }

            const targetRoll = -moveRight * 0.036 + (this.slideTimer > 0 ? 0.072 : 0) + (this.airStrafeDisplayTimer > 0 ? -moveRight * 0.02 : 0);
            this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, clampedDt * 11);
            this.cameraShake = Math.max(0, this.cameraShake - clampedDt * 1.6);

            if (this.moveTagTimer > 0) {
                this.moveTagTimer = Math.max(0, this.moveTagTimer - clampedDt);
                if (this.moveTagTimer <= 0) this.moveTag = '';
            }
            if (this.airStrafeDisplayTimer > 0) {
                this.airStrafeDisplayTimer = Math.max(0, this.airStrafeDisplayTimer - clampedDt);
                if (this.airStrafeDisplayTimer <= 0) this.airStrafeGain = 0;
            }

            return alpha;
        }

        _fixedStep(dt, input) {
            const { keys, joyInput, weapon, armor, boostActive } = input;

            let moveForward = 0;
            let moveRight = 0;
            if (keys['KeyW'] || keys['ArrowUp']) moveForward += 1;
            if (keys['KeyS'] || keys['ArrowDown']) moveForward -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) moveRight += 1;
            if (keys['KeyA'] || keys['ArrowLeft']) moveRight -= 1;
            if (Math.abs(joyInput.x) > 0.05 || Math.abs(joyInput.y) > 0.05) {
                moveRight += joyInput.x;
                moveForward -= joyInput.y;
            }
            input.moveRight = Math.max(-1, Math.min(1, moveRight));

            this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
            this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

            this._wishDir.set(0, 0, 0)
                .addScaledVector(this._fwd, moveForward)
                .addScaledVector(this._right, moveRight);
            const hasWish = this._wishDir.lengthSq() > 0.001;
            if (hasWish) this._wishDir.normalize();

            // Armor + Weapon Weight + Boost calculations
            const rawWeight = weapon.moveMult || 1.0;
            const mitigation = armor ? armor.heavyPenaltyMitigation : 0;
            const effWeight = rawWeight + (1.0 - rawWeight) * mitigation;
            const armorSpd = armor ? armor.speedMult : 1.0;
            const airMult = armor ? armor.airAccelMult : 1.0;
            const boostMult = boostActive ? 1.48 : 1.0;
            const baseMaxSpeed = 13.6 * effWeight * armorSpd * boostMult;
            const maxBhopCap = (armor ? armor.bhopMaxSpeed : 27.0) * (boostActive ? 1.22 : 1.0);

            if (this.coyoteTimer > 0) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
            if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
            if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);
            if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
            if (this.dashActiveTimer > 0) this.dashActiveTimer = Math.max(0, this.dashActiveTimer - dt);

            const holdingJump = Boolean(keys['Space']);

            // 1. Evaluate Jump BEFORE ground friction so buffered/held BHop loses ZERO speed!
            const canNormalJump = (this.onGround || this.coyoteTimer > 0);
            const wantsJump = (this.jumpBufferTimer > 0 || (this.onGround && holdingJump));

            if (wantsJump && canNormalJump) {
                this._executeGroundJump(armor, effWeight, boostActive, maxBhopCap);
            } else if (this.jumpJustPressed && !this.onGround && this.coyoteTimer <= 0 && this.canDoubleJump) {
                // Exo-Quantum Double Jump!
                this.canDoubleJump = false;
                this.jumpBufferTimer = 0;
                const jumpVel = 10.6 * (armor ? armor.jumpMult : 1.0) * (boostActive ? 1.12 : 1.0);
                this.vel.y = Math.max(this.vel.y * 0.35 + jumpVel * 0.9, jumpVel);
                if (hasWish) {
                    const hSpd = Math.hypot(this.vel.x, this.vel.z);
                    const targetSpd = Math.max(hSpd, baseMaxSpeed * 1.1);
                    this.vel.x = this.vel.x * 0.45 + this._wishDir.x * targetSpd * 0.55;
                    this.vel.z = this.vel.z * 0.45 + this._wishDir.z * targetSpd * 0.55;
                }
                this.sound.playJump(true);
                this.setMoveTag('КВАНТ-ПРЫЖОК x2', 0.75);
            }

            // 2. Horizontal Acceleration (Ground vs Slide vs True Quake/Source Air-Strafe)
            if (this.dashActiveTimer > 0) {
                // Preserve dash momentum cleanly
            } else if (this.slideTimer > 0) {
                this.slideTimer = Math.max(0, this.slideTimer - dt);
                const slideFriction = Math.exp(-1.35 * dt);
                this.vel.x *= slideFriction;
                this.vel.z *= slideFriction;
                if (hasWish) {
                    this.vel.x += this._wishDir.x * 8.0 * dt;
                    this.vel.z += this._wishDir.z * 8.0 * dt;
                }
            } else if (this.onGround) {
                // Standard Source ground friction (skipped on jump frame above!)
                const hSpd = Math.hypot(this.vel.x, this.vel.z);
                if (hSpd > 0.001) {
                    const stopSpeed = 4.6;
                    const friction = 7.4;
                    const control = hSpd < stopSpeed ? stopSpeed : hSpd;
                    const drop = control * friction * dt;
                    const newSpd = Math.max(0, hSpd - drop) / hSpd;
                    this.vel.x *= newSpd;
                    this.vel.z *= newSpd;
                }
                this.bhopResetTimer += dt;
                if (this.bhopResetTimer > 0.24 && this.bhopStreak > 0) {
                    this.bhopStreak = 0;
                }
                if (hasWish) {
                    const groundMax = (keys['ControlLeft'] && this.slideTimer <= 0) ? baseMaxSpeed * 0.62 : baseMaxSpeed;
                    const curInWish = this.vel.x * this._wishDir.x + this.vel.z * this._wishDir.z;
                    const addSpd = groundMax - curInWish;
                    if (addSpd > 0) {
                        const accelSpd = Math.min(addSpd, 10.5 * groundMax * dt);
                        this.vel.x += this._wishDir.x * accelSpd;
                        this.vel.z += this._wishDir.z * accelSpd;
                    }
                }
            } else {
                // TRUE QUAKE / SOURCE AIR-STRAFE PHYSICS
                const hSpd = Math.hypot(this.vel.x, this.vel.z);
                if (hasWish) {
                    // If moving fast in air and holding both W + A/D, soften forward bleed
                    // so curving works seamlessly whether player releases W or keeps holding W+A/D!
                    if (hSpd >= baseMaxSpeed * 0.85 && moveForward > 0 && Math.abs(moveRight) > 0.05) {
                        this._airWish.set(0, 0, 0)
                            .addScaledVector(this._fwd, moveForward * 0.26)
                            .addScaledVector(this._right, moveRight)
                            .normalize();
                    } else {
                        this._airWish.copy(this._wishDir);
                    }

                    // Low-speed platforming boost vs high-speed Air-Strafe cap
                    const isPurePlatforming = hSpd < baseMaxSpeed * 0.72 && Math.abs(moveRight) < 0.1;
                    const airWishCap = isPurePlatforming
                        ? baseMaxSpeed * 0.85
                        : 3.45 * airMult * boostMult;
                    const airAccelRate = isPurePlatforming ? 7.2 : 15.5 * airMult;

                    const curInWish = this.vel.x * this._airWish.x + this.vel.z * this._airWish.z;
                    const addSpd = airWishCap - curInWish;

                    if (addSpd > 0) {
                        const accelSpd = Math.min(addSpd, airAccelRate * baseMaxSpeed * dt);
                        const speedBefore = hSpd;
                        this.vel.x += this._airWish.x * accelSpd;
                        this.vel.z += this._airWish.z * accelSpd;
                        const speedAfter = Math.hypot(this.vel.x, this.vel.z);

                        // Softly bleed excess speed above armor's bhopMaxSpeed
                        if (speedAfter > maxBhopCap) {
                            const excess = speedAfter - maxBhopCap;
                            const damped = maxBhopCap + excess * Math.exp(-6.0 * dt);
                            const scale = damped / speedAfter;
                            this.vel.x *= scale;
                            this.vel.z *= scale;
                        }

                        // Detect genuine curved air-strafe gain for HUD feedback
                        if (!isPurePlatforming && Math.abs(moveRight) > 0.1 && speedAfter > speedBefore + 0.002 && speedBefore > 8.5) {
                            this.airStrafeGain += (speedAfter - speedBefore);
                            this.airStrafeDisplayTimer = 0.55;
                            if (this.airStrafeGain > 0.6 && this.bhopStreak === 0) {
                                this.setMoveTag(`ЭЙР-СТРЕЙФ +${this.airStrafeGain.toFixed(1)}`, 0.45);
                            }
                        }
                    }
                }
            }

            // 3. Gravity & Semi-Implicit Euler Position Integration
            // Gentle Apex Float near peak of jump for extra crisp platforming control
            const gravScale = (!this.onGround && Math.abs(this.vel.y) < 1.8) ? 0.76 : 1.0;
            this.vel.y -= this.GRAVITY * gravScale * dt;
            this.pos.addScaledVector(this.vel, dt);

            // 4. Collisions (Boxes, Bridges, Ramps, Auto-Step, ClipVelocity)
            this._resolveWorldCollisions();

            // 5. Grav-Jump Pads
            for (const jp of this.map.jumpPads) {
                if (jp.cooldown > 0) jp.cooldown = Math.max(0, jp.cooldown - dt);
                const d = Math.hypot(this.pos.x - jp.x, this.pos.z - jp.z);
                if (d < 2.25 && this.pos.y < 1.4 && jp.cooldown <= 0) {
                    jp.cooldown = 0.65;
                    this.onGround = false;
                    this.coyoteTimer = 0;
                    this.jumpBufferTimer = 0;
                    this.vel.y = jp.launchY;
                    this.vel.x += jp.launchX;
                    this.vel.z += jp.launchZ;
                    this.sound.playBoost();
                    this.setMoveTag('ГРАВИ-ТРАМПЛИН', 0.9);
                }
            }
        }

        _executeGroundJump(armor, effWeight, boostActive, maxBhopCap) {
            const wasSliding = this.slideTimer > 0;
            const isTimedTap = (this.simTime - this.manualJumpTimestamp) <= 0.175;
            this.slideTimer = 0;
            this.onGround = false;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            this.bhopResetTimer = 0;
            this.canDoubleJump = armor ? armor.doubleJump : false;

            const jumpMult = (armor ? armor.jumpMult : 1.0) * (boostActive ? 1.1 : 1.0) * (0.88 + 0.12 * effWeight);
            this.vel.y = 10.6 * jumpMult;

            const hSpd = Math.hypot(this.vel.x, this.vel.z);
            // Smoothly chain BHop both on timed Space taps AND continuous Space-hold auto-hops!
            if (wasSliding || hSpd > 8.8) {
                this.bhopStreak = Math.min(14, this.bhopStreak + 1);
                const bonus = wasSliding ? 3.4 : (isTimedTap ? 1.55 : 1.25);
                const newSpd = Math.min(maxBhopCap, hSpd + bonus);
                if (hSpd > 0.1) {
                    this.vel.x = (this.vel.x / hSpd) * newSpd;
                    this.vel.z = (this.vel.z / hSpd) * newSpd;
                }
                this.sound.playJump(true);
                this.setMoveTag(
                    wasSliding ? 'СУПЕР-ПРЫЖОК!' : `БХОП x${this.bhopStreak}`,
                    0.9
                );
            } else {
                this.sound.playJump(false);
            }
        }

        _clipVelocity(nx, nz) {
            const dot = this.vel.x * nx + this.vel.z * nz;
            if (dot < 0) {
                this.vel.x -= nx * dot;
                this.vel.z -= nz * dot;
            }
        }

        _resolveWorldCollisions() {
            const pos = this.pos;
            const radius = this.PLAYER_RADIUS;
            const playerHeight = (this.slideTimer > 0 ? this.EYE_SLIDE : this.EYE_STAND) + 0.25;

            // Clamp to arena outer boundaries and clip velocity cleanly
            if (pos.x < -this.map.ARENA_LIMIT_X) {
                pos.x = -this.map.ARENA_LIMIT_X;
                this._clipVelocity(1, 0);
            } else if (pos.x > this.map.ARENA_LIMIT_X) {
                pos.x = this.map.ARENA_LIMIT_X;
                this._clipVelocity(-1, 0);
            }
            if (pos.z < -this.map.ARENA_LIMIT_Z) {
                pos.z = -this.map.ARENA_LIMIT_Z;
                this._clipVelocity(0, 1);
            } else if (pos.z > this.map.ARENA_LIMIT_Z) {
                pos.z = this.map.ARENA_LIMIT_Z;
                this._clipVelocity(0, -1);
            }

            let floorHeight = 0;

            // Check Ramps first (supporting BOTH map ramps AND player-crafted Fortnite ramps!)
            const processRampList = (rampList) => {
                for (const r of rampList) {
                    const rBase = r.yBase || 0;
                    if (rBase > 0.35 && pos.y + playerHeight <= rBase + 0.08) {
                        continue; // Player is walking cleanly underneath an upper-floor ramp!
                    }
                    const clampedX = Math.max(r.minX, Math.min(pos.x, r.maxX));
                    const clampedZ = Math.max(r.minZ, Math.min(pos.z, r.maxZ));
                    const t = r.axis === 'z'
                        ? (clampedZ - r.minZ) / (r.maxZ - r.minZ)
                        : (clampedX - r.minX) / (r.maxX - r.minX);
                    const rampY = r.yAtMin + (r.yAtMax - r.yAtMin) * Math.max(0, Math.min(1, t));

                    const insideFootprint = pos.x >= r.minX - 0.38 && pos.x <= r.maxX + 0.38 &&
                                            pos.z >= r.minZ - 0.38 && pos.z <= r.maxZ + 0.38;

                    if (insideFootprint) {
                        if (pos.y >= rampY - 0.92 && pos.y >= rBase - 0.55) {
                            if (rampY > floorHeight) floorHeight = rampY;
                            continue;
                        }
                        if (rBase > 0.35 && pos.y < rBase && pos.y + playerHeight > rBase && this.vel.y > 0) {
                            pos.y = rBase - playerHeight;
                            this.vel.y = 0;
                            continue;
                        }
                    }

                    // Side wall collision against high parts of ramp
                    const dx = pos.x - clampedX;
                    const dz = pos.z - clampedZ;
                    const distSq = dx * dx + dz * dz;
                    if (distSq < radius * radius && pos.y < rampY - 0.58 && pos.y + playerHeight > rBase + 0.12) {
                        if (distSq > 0.00001) {
                            const dist = Math.sqrt(distSq);
                            const nx = dx / dist;
                            const nz = dz / dist;
                            pos.x += nx * (radius - dist);
                            pos.z += nz * (radius - dist);
                            this._clipVelocity(nx, nz);
                        }
                    }
                }
            };
            processRampList(this.map.ramps);
            if (this.map.dynamicRamps && this.map.dynamicRamps.length > 0) {
                processRampList(this.map.dynamicRamps);
            }

            // Check 3D Boxes (static + player-crafted walls, supporting underpasses & BHop auto step-up!)
            const processBoxList = (boxList) => {
                for (const b of boxList) {
                    if (b.isShieldScreen) continue;
                    const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
                    const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
                    const dx = pos.x - closestX;
                    const dz = pos.z - closestZ;
                    const distSq = dx * dx + dz * dz;

                    if (distSq >= radius * radius) continue;

                    // Standing on top of box/bridge
                    if (b.jumpable && pos.y >= b.maxY - 0.54 && this.vel.y <= 1.2) {
                        if (b.maxY > floorHeight) floorHeight = b.maxY;
                        continue;
                    }

                    // Smooth BHop Auto-Step onto small lips/curbs (<= 0.5m) without killing horizontal speed!
                    if (b.jumpable && b.maxY - pos.y <= 0.54 && pos.y >= b.minY - 0.1) {
                        if (b.maxY > floorHeight) floorHeight = b.maxY;
                        continue;
                    }

                    // Completely underneath elevated bridge
                    if (pos.y + playerHeight <= b.minY + 0.08) {
                        continue;
                    }

                    // Head bump against underside of elevated bridge
                    if (b.minY > 0.4 && pos.y < b.minY && pos.y + playerHeight > b.minY && this.vel.y > 0) {
                        if (pos.x >= b.minX && pos.x <= b.maxX && pos.z >= b.minZ && pos.z <= b.maxZ) {
                            pos.y = b.minY - playerHeight;
                            this.vel.y = 0;
                            continue;
                        }
                    }

                    // Horizontal push + ClipVelocity (smooth wall-slide!)
                    if (pos.y < b.maxY - 0.12 && pos.y + playerHeight > b.minY + 0.12) {
                        if (distSq > 0.00001) {
                            const dist = Math.sqrt(distSq);
                            const nx = dx / dist;
                            const nz = dz / dist;
                            pos.x += nx * (radius - dist);
                            pos.z += nz * (radius - dist);
                            this._clipVelocity(nx, nz);
                        } else {
                            const pushLeft = Math.abs(pos.x - b.minX);
                            const pushRight = Math.abs(b.maxX - pos.x);
                            const pushBack = Math.abs(pos.z - b.minZ);
                            const pushFront = Math.abs(b.maxZ - pos.z);
                            const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
                            if (m === pushLeft) { pos.x = b.minX - radius; this._clipVelocity(-1, 0); }
                            else if (m === pushRight) { pos.x = b.maxX + radius; this._clipVelocity(1, 0); }
                            else if (m === pushBack) { pos.z = b.minZ - radius; this._clipVelocity(0, -1); }
                            else { pos.z = b.maxZ + radius; this._clipVelocity(0, 1); }
                        }
                    }
                }
            };
            processBoxList(this.map.boxes);
            if (this.map.dynamicBoxes && this.map.dynamicBoxes.length > 0) {
                processBoxList(this.map.dynamicBoxes);
            }

            // Ground / Ramp / Platform landing & grounded ramp-hugging
            const wasOnGround = this.onGround;
            const snapWindow = wasOnGround ? 0.22 : 0.04;
            if (pos.y <= floorHeight + snapWindow && this.vel.y <= 0.5) {
                if (!wasOnGround && this.vel.y < -15.5) {
                    XB.events.emit('player:hardLand', {
                        pos: pos.clone(),
                        impactSpeed: Math.abs(this.vel.y)
                    });
                }
                pos.y = floorHeight;
                this.vel.y = 0;
                this.onGround = true;
                this.coyoteTimer = 0.12;
                this.canDoubleJump = false; // Reset cleanly via armor check when needed
            } else {
                this.onGround = false;
            }
        }
    }

    XB.PlayerController = PlayerController;
})(window);
