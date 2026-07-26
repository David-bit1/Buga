(function () {
    class PlayerEventEmitter {
        constructor() {
            this.listeners = new Map();
        }

        on(eventName, callback) {
            if (typeof callback !== 'function') {
                return;
            }

            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, new Set());
            }

            this.listeners.get(eventName).add(callback);
        }

        off(eventName, callback) {
            const callbacks = this.listeners.get(eventName);
            if (!callbacks) {
                return;
            }

            if (callback) {
                callbacks.delete(callback);
            } else {
                callbacks.clear();
            }
        }

        emit(eventName, payload) {
            const callbacks = this.listeners.get(eventName);
            if (!callbacks) {
                return;
            }

            callbacks.forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[PlayerEventEmitter] listener for "${eventName}" failed`, error);
                }
            });
        }

        clear() {
            this.listeners.clear();
        }
    }

    class BasePlayerAdapter {
        constructor(capabilities = {}) {
            this.capabilities = {
                controllable: true,
                seekable: true,
                volume: true,
                fullscreen: true,
                timeline: true,
                ...capabilities
            };

            this.events = new PlayerEventEmitter();
        }

        on(eventName, callback) {
            this.events.on(eventName, callback);
        }

        off(eventName, callback) {
            this.events.off(eventName, callback);
        }

        emit(eventName, payload) {
            this.events.emit(eventName, payload);
        }

        play() {
            throw new Error('Not implemented');
        }

        pause() {
            throw new Error('Not implemented');
        }

        mute() {
            throw new Error('Not implemented');
        }

        unmute() {
            throw new Error('Not implemented');
        }

        setVolume() {
            throw new Error('Not implemented');
        }

        seek() {
            throw new Error('Not implemented');
        }

        getCurrentTime() {
            throw new Error('Not implemented');
        }

        getDuration() {
            throw new Error('Not implemented');
        }

        destroy() {
            this.events.clear();
        }
    }

    window.BugaPlayerBase = {
        PlayerEventEmitter,
        BasePlayerAdapter
    };
})();
