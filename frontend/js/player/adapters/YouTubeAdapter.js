(function () {
    const { BasePlayerAdapter } = window.BugaPlayerBase || {};
    const PlayerManager = window.BugaPlayerManager;

    if (!BasePlayerAdapter || !PlayerManager) {
        throw new Error('Player base and manager must be loaded before YouTubeAdapter');
    }

    class YouTubePlayerAdapter extends BasePlayerAdapter {
        constructor(player, mountElementId) {
            super({
                controllable: true,
                seekable: true,
                volume: true,
                mute: true,
                play: true,
                pause: true,
                seek: true,
                fullscreen: true,
                quality: true,
                subtitles: false,
                timeline: true
            });

            this.player = player;
            this.mountElementId = mountElementId;
            this.boundErrorHandler = (event) => this.emit('error', event);
            this.boundStateChangeHandler = (event) => this.handleStateChange(event);
            this.player.addEventListener('onStateChange', this.boundStateChangeHandler);
            this.player.addEventListener('onError', this.boundErrorHandler);
        }

        static async create({ externalElement, server, manager }) {
            if (!externalElement) {
                return null;
            }

            const mountElement = externalElement;
            mountElement.hidden = false;
            mountElement.style.display = 'block';
            mountElement.innerHTML = '';
            if (!mountElement.id) {
                mountElement.id = 'externalPlayer';
            }

            await manager.loadYoutubeApi();
            const videoId = manager.parseYoutubeId(server.url);
            if (!videoId) {
                throw new Error(`URL de YouTube inválida: ${server.url}`);
            }

            return new Promise((resolve, reject) => {
                try {
                    const player = new YT.Player(mountElement.id, {
                        videoId,
                        width: '100%',
                        height: '100%',
                        playerVars: {
                            autoplay: 1,
                            controls: 0,
                            rel: 0,
                            showinfo: 0,
                            modestbranding: 1,
                            iv_load_policy: 3,
                            playsinline: 1
                        },
                        events: {
                            onReady: (event) => {
                                const iframe = event.target.getIframe();
                                iframe.style.position = 'absolute';
                                iframe.style.inset = '0';
                                iframe.style.width = '100%';
                                iframe.style.height = '100%';
                                iframe.style.border = '0';

                                resolve(new YouTubePlayerAdapter(event.target, mountElement.id));
                                event.target.getIframe().focus?.();
                            },
                            onError: (event) => {
                                reject(new Error(`YouTube player error code: ${event.data}`));
                            }
                        }
                    });

                    void player;
                } catch (error) {
                    reject(error);
                }
            });
        }

        handleStateChange(event) {
            switch (event.data) {
                case YT.PlayerState.PLAYING:
                    this.emit('play');
                    this.emit('playing');
                    break;
                case YT.PlayerState.PAUSED:
                    this.emit('pause');
                    break;
                case YT.PlayerState.ENDED:
                    this.emit('ended');
                    break;
                case YT.PlayerState.BUFFERING:
                    this.emit('waiting');
                    break;
                case YT.PlayerState.CUED:
                    this.emit('loadedmetadata');
                    this.emit('durationchange');
                    break;
            }
        }

        play() {
            this.player.playVideo();
        }

        pause() {
            this.player.pauseVideo();
        }

        mute() {
            this.player.mute();
            this.emit('volumechange', { volume: this.player.getVolume() / 100, muted: true });
        }

        unmute() {
            this.player.unMute();
            this.emit('volumechange', { volume: this.player.getVolume() / 100, muted: false });
        }

        setVolume(level) {
            const nextVolume = Math.min(1, Math.max(0, Number(level)));
            const scaledVolume = Number.isFinite(nextVolume) ? Math.round(nextVolume * 100) : 100;
            this.player.setVolume(scaledVolume);
            this.emit('volumechange', {
                volume: this.player.getVolume() / 100,
                muted: this.player.isMuted()
            });
        }

        seek(time) {
            this.player.seekTo(Number(time) || 0, true);
        }

        load() {
            return this;
        }

        getCurrentTime() {
            return this.player.getCurrentTime();
        }

        getDuration() {
            return this.player.getDuration();
        }

        getVolume() {
            return this.player.getVolume() / 100;
        }

        isMuted() {
            return this.player.isMuted?.() || false;
        }

        destroy() {
            this.player?.removeEventListener?.('onStateChange', this.boundStateChangeHandler);
            this.player?.removeEventListener?.('onError', this.boundErrorHandler);
            this.player?.destroy?.();
            this.player = null;
            const mountElement = document.getElementById(this.mountElementId);
            if (mountElement) {
                mountElement.innerHTML = '';
                mountElement.hidden = true;
            }
            super.destroy();
        }
    }

    PlayerManager.registerAdapter({
        id: 'youtube',
        priority: 120,
        capabilities: {
            controllable: true,
            seekable: true,
            volume: true,
            mute: true,
            play: true,
            pause: true,
            seek: true,
            fullscreen: true,
            quality: true,
            subtitles: false,
            timeline: true
        },
        match: (server) => server.kind === 'youtube',
        create: async ({ externalElement, server, manager }) => {
            if (!externalElement) {
                return null;
            }

            return YouTubePlayerAdapter.create({
                externalElement,
                server,
                manager
            });
        }
    });

    window.BugaPlayerAdapters = {
        ...(window.BugaPlayerAdapters || {}),
        YouTubePlayerAdapter
    };
})();
