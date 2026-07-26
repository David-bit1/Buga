(function () {
    const { BasePlayerAdapter } = window.BugaPlayerBase || {};
    const PlayerManager = window.BugaPlayerManager;

    if (!BasePlayerAdapter || !PlayerManager) {
        throw new Error('Player base and manager must be loaded before IframeAdapter');
    }

    class IframePlayerAdapter extends BasePlayerAdapter {
        constructor(mountElement, server) {
            super({
                controllable: false,
                seekable: false,
                volume: false,
                fullscreen: true,
                timeline: false
            });

            this.mountElement = mountElement;
            this.server = server;
            this.iframeElement = null;
            this.loadTimer = null;
            this.loadHandler = null;

            this.mountElement.hidden = false;
            this.mountElement.style.display = 'block';
            this.mountElement.innerHTML = '';

            this.iframeElement = document.createElement('iframe');
            this.iframeElement.className = 'movie-video';
            this.iframeElement.setAttribute('title', server.name || 'Reproductor externo');
            this.iframeElement.setAttribute('loading', 'lazy');
            this.iframeElement.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; web-share; fullscreen');
            this.iframeElement.allowFullscreen = true;
            this.iframeElement.referrerPolicy = 'origin-when-cross-origin';
            this.iframeElement.style.width = '100%';
            this.iframeElement.style.height = '100%';
            this.iframeElement.style.border = '0';
            this.mountElement.appendChild(this.iframeElement);

            this.loadHandler = () => {
                this.emit('loadedmetadata');
                this.emit('durationchange');
                this.emit('canplay');
            };

            this.iframeElement.addEventListener('load', this.loadHandler);
            this.loadSource(server.url, server.source || '');
        }

        loadSource(url, rawSource = '') {
            const nextUrl = String(url || '').trim();
            const sourceHtml = String(rawSource || '').trim();

            if (sourceHtml && /<iframe|<embed|<object/i.test(sourceHtml)) {
                const srcMatch = sourceHtml.match(/<(?:iframe|embed|object)[^>]*\ssrc=["']([^"']+)["']/i);
                if (srcMatch?.[1]) {
                    this.iframeElement.src = srcMatch[1];
                } else {
                    this.iframeElement.src = nextUrl;
                }
            } else if (nextUrl) {
                this.iframeElement.src = nextUrl;
            }

            window.clearTimeout(this.loadTimer);
            this.loadTimer = window.setTimeout(() => {
                this.emit('loadedmetadata');
                this.emit('durationchange');
                this.emit('canplay');
            }, 0);
        }

        play() {}

        pause() {}

        mute() {}

        unmute() {}

        setVolume() {}

        seek() {}

        getCurrentTime() {
            return 0;
        }

        getDuration() {
            return 0;
        }

        destroy() {
            window.clearTimeout(this.loadTimer);
            if (this.iframeElement && this.loadHandler) {
                this.iframeElement.removeEventListener('load', this.loadHandler);
            }
            if (this.mountElement) {
                this.mountElement.innerHTML = '';
                this.mountElement.hidden = true;
            }
            super.destroy();
        }
    }

    PlayerManager.registerAdapter({
        id: 'iframe',
        priority: 10,
        capabilities: {
            controllable: false,
            seekable: false,
            volume: false,
            fullscreen: true,
            timeline: false
        },
        match: (server) => server.kind === 'embed' || server.kind === 'iframe',
        create: async ({ externalElement, server }) => {
            if (!externalElement) {
                return null;
            }

            return new IframePlayerAdapter(externalElement, server);
        }
    });

    window.BugaPlayerAdapters = {
        ...(window.BugaPlayerAdapters || {}),
        IframePlayerAdapter
    };
})();
