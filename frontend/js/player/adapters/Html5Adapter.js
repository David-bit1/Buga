(function () {
    const { BasePlayerAdapter } = window.BugaPlayerBase || {};
    const PlayerManager = window.BugaPlayerManager;

    if (!BasePlayerAdapter || !PlayerManager) {
        throw new Error('Player base and manager must be loaded before Html5Adapter');
    }

    class Html5PlayerAdapter extends BasePlayerAdapter {
        constructor(videoElement) {
            super({
                controllable: true,
                seekable: true,
                volume: true,
                mute: true,
                play: true,
                pause: true,
                seek: true,
                fullscreen: true,
                quality: false,
                subtitles: false,
                timeline: true
            });

            console.log('[Html5Adapter] Entrando Html5Adapter');
            this.videoElement = videoElement;
            console.log('[Html5Adapter] Video creado', this.videoElement);
            this.hls = null;
            this.boundHandlers = [];
            this.attachNativeListeners();
        }

        attachNativeListeners() {
            const bind = (eventName, handler) => {
                this.videoElement.addEventListener(eventName, handler);
                this.boundHandlers.push([eventName, handler]);
            };

            bind('loadedmetadata', () => {
                console.log('[Html5Adapter] loadedmetadata');
                this.emit('loadedmetadata');
            });
            bind('durationchange', () => this.emit('durationchange'));
            bind('timeupdate', () => this.emit('timeupdate'));
            bind('volumechange', () => {
                this.emit('volumechange', {
                    volume: this.videoElement.volume,
                    muted: this.videoElement.muted
                });
            });
            bind('play', () => this.emit('play'));
            bind('playing', () => {
                console.log('[Html5Adapter] playing');
                this.emit('playing');
            });
            bind('pause', () => this.emit('pause'));
            bind('waiting', () => this.emit('waiting'));
            bind('ended', () => this.emit('ended'));
            bind('canplay', () => {
                console.log('[Html5Adapter] canplay');
                this.emit('canplay');
            });
            bind('error', (event) => {
                console.error('[Html5Adapter] error', event);
                console.error('[Html5Adapter] video.error', this.videoElement.error);
                this.emit('error', event);
            });
        }

        loadSource(url, sourceType = 'mp4') {
            if (this.hls) {
                this.hls.destroy();
                this.hls = null;
            }

            this.videoElement.hidden = false;
            this.videoElement.style.display = 'block';
            this.videoElement.removeAttribute('src');

            if (sourceType === 'hls') {
                if (window.Hls && window.Hls.isSupported()) {
                    console.log('[Html5Adapter] SRC asignado', url);
                    this.hls = new window.Hls();
                    this.hls.attachMedia(this.videoElement);
                    this.hls.loadSource(url);
                    return;
                }

                if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    this.videoElement.src = url;
                    console.log('[Html5Adapter] SRC asignado', url);
                    this.videoElement.load();
                    console.log('[Html5Adapter] video.load()');
                    return;
                }
            }

            this.videoElement.src = url;
            console.log('[Html5Adapter] SRC asignado', url);
            this.videoElement.load();
            console.log('[Html5Adapter] video.load()');
        }

        load(url, sourceType = 'mp4') {
            this.loadSource(url, sourceType);
        }

        play() {
            console.log('[Html5Adapter] video.play()');
            return this.videoElement.play();
        }

        pause() {
            this.videoElement.pause();
        }

        mute() {
            this.videoElement.muted = true;
            this.emit('volumechange', { volume: this.videoElement.volume, muted: true });
        }

        unmute() {
            this.videoElement.muted = false;
            this.emit('volumechange', { volume: this.videoElement.volume, muted: false });
        }

        setVolume(level) {
            const nextVolume = Math.min(1, Math.max(0, Number(level)));
            this.videoElement.volume = Number.isFinite(nextVolume) ? nextVolume : 1;
            this.emit('volumechange', {
                volume: this.videoElement.volume,
                muted: this.videoElement.muted
            });
        }

        seek(time) {
            const nextTime = Math.max(0, Number(time) || 0);
            if (Number.isFinite(this.videoElement.duration) && this.videoElement.duration > 0) {
                this.videoElement.currentTime = Math.min(nextTime, this.videoElement.duration);
            } else {
                this.videoElement.currentTime = nextTime;
            }
        }

        getCurrentTime() {
            return this.videoElement.currentTime || 0;
        }

        getDuration() {
            return this.videoElement.duration || 0;
        }

        getVolume() {
            return this.videoElement.volume;
        }

        isMuted() {
            return Boolean(this.videoElement.muted);
        }

        getHlsLevels() {
            return this.hls?.levels || [];
        }

        setHlsLevel(levelIndex) {
            if (this.hls) {
                this.hls.currentLevel = levelIndex;
            }
        }

        destroy() {
            if (this.hls) {
                this.hls.destroy();
                this.hls = null;
            }

            this.boundHandlers.forEach(([eventName, handler]) => {
                this.videoElement.removeEventListener(eventName, handler);
            });
            this.boundHandlers = [];

            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
            super.destroy();
        }
    }

    PlayerManager.registerAdapter({
        id: 'html5',
        priority: 90,
        capabilities: {
            controllable: true,
            seekable: true,
            volume: true,
            mute: true,
            play: true,
            pause: true,
            seek: true,
            fullscreen: true,
            quality: false,
            subtitles: false,
            timeline: true
        },
        match: (server) => server.kind === 'mp4',
        create: async ({ videoElement, server }) => {
            if (!videoElement) {
                return null;
            }

            if (server.source && server.source !== server.url && /<iframe|<embed|<object/i.test(server.source)) {
                return null;
            }

            const adapter = new Html5PlayerAdapter(videoElement);
            adapter.loadSource(server.url, 'mp4');
            return adapter;
        }
    });

    window.BugaPlayerAdapters = {
        ...(window.BugaPlayerAdapters || {}),
        Html5PlayerAdapter
    };
})();
