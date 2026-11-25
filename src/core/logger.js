/**
 * Structured logger and decoupled EventBus for XENO-BREACH.
 * Prevents silent error swallowing and decouples simulation from HUD/audio.
 */
(function (global) {
    'use strict';

    const XB = (global.XB = global.XB || {});

    const LOG_BUFFER_LIMIT = 150;
    const logHistory = [];

    function pushLog(level, scope, message, details) {
        const entry = {
            ts: new Date().toISOString(),
            level,
            scope,
            message,
            details: details !== undefined ? String(details) : ''
        };
        logHistory.push(entry);
        if (logHistory.length > LOG_BUFFER_LIMIT) {
            logHistory.shift();
        }
        if (level === 'error') {
            console.error(`[XB:${scope}] ${message}`, details || '');
        } else if (level === 'warn') {
            console.warn(`[XB:${scope}] ${message}`, details || '');
        }
    }

    XB.log = {
        info(scope, message, details) {
            pushLog('info', scope, message, details);
        },
        warn(scope, message, details) {
            pushLog('warn', scope, message, details);
        },
        error(scope, message, details) {
            pushLog('error', scope, message, details);
        },
        getHistory() {
            return logHistory.slice();
        }
    };

    class EventBus {
        constructor() {
            this.listeners = new Map();
        }

        on(event, handler) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(handler);
            return () => this.off(event, handler);
        }

        off(event, handler) {
            const set = this.listeners.get(event);
            if (set) set.delete(handler);
        }

        emit(event, payload) {
            const set = this.listeners.get(event);
            if (!set) return;
            for (const handler of set) {
                try {
                    handler(payload);
                } catch (err) {
                    XB.log.error('EventBus', `Listener failed for "${event}"`, err && err.stack ? err.stack : err);
                }
            }
        }
    }

    XB.events = new EventBus();
})(window);
