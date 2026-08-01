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
            this.errorHandler = null;

            this.mountElement.hidden = false;
            this.mountElement.style.display = 'block';
            this.mountElement.style.position = 'absolute';
            this.mountElement.style.inset = '0';
            this.mountElement.innerHTML = '';

            this.iframeElement = document.createElement('iframe');
            this.iframeElement.className = 'movie-video';
            this.iframeElement.setAttribute('title', server.name || 'Reproductor externo');
            this.iframeElement.setAttribute('loading', 'eager');
            this.iframeElement.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture; web-share');
            this.iframeElement.allowFullscreen = true;
            this.iframeElement.referrerPolicy = 'origin-when-cross-origin';
            this.iframeElement.style.position = 'absolute';
            this.iframeElement.style.inset = '0';
            this.iframeElement.style.width = '100%';
            this.iframeElement.style.height = '100%';
            this.iframeElement.style.border = '0';
            this.iframeElement.style.zIndex = '0';
            this.iframeElement.style.display = 'block';
            this.iframeElement.style.visibility = 'visible';
            console.log('[IframeAdapter] Iframe creado', this.iframeElement);
            this.mountElement.appendChild(this.iframeElement);

            this.loadHandler = () => {
                console.log('[IframeAdapter] Iframe loaded', this.iframeElement.src);
                this.emit('loadedmetadata');
                this.emit('durationchange');
                this.emit('canplay');
            };

            this.errorHandler = (event) => {
                console.error('[IframeAdapter] Iframe error', event);
            };
            this.iframeElement.addEventListener('error', this.errorHandler);
            this.iframeElement.addEventListener('load', this.loadHandler);
            this.loadSource(server.url, server.source || '');
        }

        loadSource(url, rawSource = '') {
            const nextUrl = String(url || '').trim();
            const sourceHtml = String(rawSource || '').trim();
            const extractSrc = (value) => {
                const text = String(value || '').trim();
                if (!text) {
                    return '';
                }

                const srcMatch = text.match(/<(?:iframe|embed|object)[^>]*\ssrc=["']([^"']+)["']/i);
                if (srcMatch?.[1]) {
                    return srcMatch[1].trim();
                }

                const dataMatch = text.match(/data-src=["']([^"']+)["']/i);
                return dataMatch?.[1]?.trim() || '';
            };

            const sourceMarkup = /<(iframe|embed|object)\b/i.test(sourceHtml) ? sourceHtml : '';
            const urlMarkup = /<(iframe|embed|object)\b/i.test(nextUrl) ? nextUrl : '';
            const resolvedSrc = extractSrc(sourceMarkup) || extractSrc(urlMarkup) || nextUrl;

            if (resolvedSrc) {
                this.iframeElement.src = resolvedSrc;
                console.log('[IframeAdapter] Src asignado', resolvedSrc);
            }

            this.iframeElement.hidden = false;
            this.iframeElement.style.display = 'block';
            this.iframeElement.style.visibility = 'visible';
            console.log('[IframeAdapter] Iframe visible');

            window.clearTimeout(this.loadTimer);
            this.loadTimer = window.setTimeout(() => {
                this.emit('loadedmetadata');
                this.emit('durationchange');
                this.emit('canplay');
            }, 0);
        }

        load(url, rawSource = '') {
            this.loadSource(url, rawSource);
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
            if (this.iframeElement && this.errorHandler) {
                this.iframeElement.removeEventListener('error', this.errorHandler);
            }
            if (this.iframeElement) {
                this.iframeElement.removeAttribute('src');
                this.iframeElement.src = 'about:blank';
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
        match: (server) => server.kind === 'embed' || server.kind === 'archive' || server.kind === 'iframe',
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
