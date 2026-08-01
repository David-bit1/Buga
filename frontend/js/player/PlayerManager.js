(function () {
    const { BasePlayerAdapter } = window.BugaPlayerBase || {};

    if (!BasePlayerAdapter) {
        throw new Error('BugaPlayerBase must be loaded before PlayerManager');
    }

    const YOUTUBE_HOSTS = [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
        'youtu.be'
    ];

    const EMBED_HOSTS = [
        'streamwish.to',
        'streamwish.com',
        'streamwish.eu',
        'voe.sx',
        'vidlink.pro',
        'filemoon.sx',
        'mixdrop.co',
        'dood.watch',
        'dailymotion.com',
        'www.dailymotion.com',
        'vimeo.com',
        'www.vimeo.com',
        'twitch.tv',
        'www.twitch.tv',
        'drive.google.com',
        'www.drive.google.com',
        'dropbox.com',
        'www.dropbox.com'
    ];

    const ARCHIVE_HOSTS = [
        'archive.org',
        'www.archive.org',
        'web.archive.org'
    ];

    const state = {
        activeAdapter: null,
        registry: [],
        registrationOrder: 0,
        youtubeApiPromise: null
    };

    const CAPABILITY_KEYS = [
        'controllable',
        'seekable',
        'volume',
        'fullscreen',
        'timeline',
        'hls'
    ];

    const DEFAULT_CAPABILITIES = Object.freeze({
        controllable: true,
        seekable: true,
        volume: true,
        fullscreen: true,
        timeline: true,
        hls: false
    });

    const normalizeString = (value) => String(value || '').trim();

    const parseUrl = (value) => {
        const text = normalizeString(value);
        if (!text) {
            return null;
        }

        try {
            return new URL(text, window.location.href);
        } catch {
            return null;
        }
    };

    const extractIframeSrc = (value) => {
        const text = normalizeString(value);
        if (!text) {
            return '';
        }

        const srcMatch = text.match(/<(?:iframe|embed|object)[^>]*\ssrc=["']([^"']+)["']/i);
        if (srcMatch?.[1]) {
            return normalizeString(srcMatch[1]);
        }

        const dataMatch = text.match(/data-src=["']([^"']+)["']/i);
        if (dataMatch?.[1]) {
            return normalizeString(dataMatch[1]);
        }

        return '';
    };

    const parseYoutubeId = (value) => {
        const text = normalizeString(value);
        if (!text) {
            return null;
        }

        const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/|u\/\w\/))([a-zA-Z0-9_-]{11})/i);
        if (match?.[1]) {
            return match[1];
        }

        const parsedUrl = parseUrl(text);
        if (!parsedUrl) {
            return null;
        }

        const host = parsedUrl.hostname.toLowerCase();
        if (host.includes('youtu.be')) {
            const shortId = parsedUrl.pathname.replace('/', '').slice(0, 11);
            return shortId.length === 11 ? shortId : null;
        }

        const searchId = parsedUrl.searchParams.get('v');
        return searchId && searchId.length === 11 ? searchId : null;
    };

    const getHostname = (value) => {
        const parsedUrl = parseUrl(value);
        return parsedUrl ? parsedUrl.hostname.toLowerCase() : '';
    };

    const getPathExtension = (value) => {
        const parsedUrl = parseUrl(value);
        if (!parsedUrl) {
            return '';
        }

        const pathname = parsedUrl.pathname.split('/').pop() || '';
        return pathname.includes('.') ? pathname.split('.').pop().toLowerCase() : '';
    };

    const isEmbedMarkup = (value) => /<(iframe|embed|object)\b/i.test(normalizeString(value));

    const normalizeServer = (server, index = 0) => {
        if (!server) {
            return {
                name: `Servidor ${index + 1}`,
                type: 'iframe',
                url: '',
                rawUrl: '',
                rawType: '',
                status: 'active',
                order: index
            };
        }

        if (typeof server === 'string') {
            const rawText = normalizeString(server);
            const extractedSrc = extractIframeSrc(rawText);
            const resolvedUrl = extractedSrc || rawText;
            return {
                name: `Servidor ${index + 1}`,
                type: detectServerType(resolvedUrl, extractedSrc ? 'iframe' : ''),
                url: resolvedUrl,
                rawUrl: resolvedUrl,
                rawType: '',
                status: 'active',
                order: index,
                source: rawText
            };
        }

        const rawUrl = normalizeString(server.url || server.link || server.value || server.src || '');
        const rawCode = normalizeString(server.code || server.html || server.embed_code || server.embed || '');
        const extractedSrc = extractIframeSrc(rawCode);
        const resolvedUrl = rawUrl || extractedSrc || rawCode;

        return {
            name: normalizeString(server.name) || `Servidor ${index + 1}`,
            type: detectServerType(resolvedUrl, server.type),
            url: resolvedUrl,
            rawUrl: rawUrl || resolvedUrl,
            rawType: normalizeString(server.type).toLowerCase(),
            status: normalizeString(server.status).toLowerCase() === 'inactive' ? 'inactive' : 'active',
            order: Number.isFinite(Number(server.order)) ? Number(server.order) : index,
            source: rawCode || rawUrl
        };
    };

    const detectServerType = (url, declaredType = '') => {
        const text = normalizeString(url);
        const declared = normalizeString(declaredType).toLowerCase();

        if (!text) {
            return 'invalid';
        }

        if (parseYoutubeId(text) || declared === 'youtube') {
            return 'youtube';
        }

        if (isEmbedMarkup(text) || declared === 'embed') {
            return 'embed';
        }

        const host = getHostname(text);
        if (host && ARCHIVE_HOSTS.some((knownHost) => host === knownHost || host.endsWith(`.${knownHost}`))) {
            return 'archive';
        }

        const extension = getPathExtension(text);
        if (extension === 'm3u8' || declared === 'm3u8' || declared === 'hls') {
            return 'hls';
        }

        if (['mp4', 'webm', 'mov', 'mkv'].includes(extension) || declared === 'mp4') {
            return 'mp4';
        }

        if (host && (YOUTUBE_HOSTS.includes(host) || host.endsWith('.youtube.com') || host.endsWith('.youtube-nocookie.com'))) {
            return 'youtube';
        }

        if (host && EMBED_HOSTS.some((knownHost) => host === knownHost || host.endsWith(`.${knownHost}`))) {
            return 'embed';
        }

        if (declared === 'iframe') {
            return 'iframe';
        }

        return 'iframe';
    };

    const detectServerDetails = (server) => {
        const normalized = normalizeServer(server);
        const host = getHostname(normalized.url);
        const extension = getPathExtension(normalized.url);
        const youtubeId = parseYoutubeId(normalized.url);
        const kind = detectServerType(normalized.url, normalized.rawType);

        const displayType = {
            youtube: 'YouTube',
            hls: 'HLS',
            mp4: extension ? extension.toUpperCase() : 'MP4',
            embed: 'EMBED',
            archive: 'ARCHIVE',
            iframe: 'IFRAME',
            invalid: 'INVALID'
        }[kind] || kind.toUpperCase();

        return {
            ...normalized,
            host,
            extension,
            youtubeId,
            kind,
            displayType,
            isEmbedMarkup: isEmbedMarkup(normalized.source || normalized.url)
        };
    };

    const normalizeCapabilities = (...sources) => {
        const capabilities = { ...DEFAULT_CAPABILITIES };

        sources.forEach((source) => {
            if (!source || typeof source !== 'object') {
                return;
            }

            CAPABILITY_KEYS.forEach((key) => {
                if (typeof source[key] === 'boolean') {
                    capabilities[key] = source[key];
                }
            });

            Object.keys(source).forEach((key) => {
                if (!CAPABILITY_KEYS.includes(key) && typeof source[key] !== 'undefined') {
                    capabilities[key] = source[key];
                }
            });
        });

        return capabilities;
    };

    const registerAdapter = (definition) => {
        if (!definition || typeof definition !== 'object') {
            throw new Error('Adapter definition must be an object');
        }

        if (!definition.id) {
            throw new Error('Adapter definition requires an id');
        }

        if (typeof definition.match !== 'function' || typeof definition.create !== 'function') {
            throw new Error(`Adapter "${definition.id}" must define match() and create()`);
        }

        const entry = {
            priority: Number.isFinite(Number(definition.priority)) ? Number(definition.priority) : 0,
            order: state.registrationOrder++,
            ...definition
        };

        state.registry.push(entry);
        state.registry.sort((left, right) => {
            if (right.priority !== left.priority) {
                return right.priority - left.priority;
            }

            return left.order - right.order;
        });

        return entry.id;
    };

    const resolveAdapter = (server) => {
        const details = detectServerDetails(server);
        const registered = state.registry.find((definition) => definition.match(details));

        if (registered) {
            return { details, definition: registered };
        }

        const fallbackId = {
            youtube: 'youtube',
            hls: 'hls',
            mp4: 'html5',
            embed: 'iframe',
            archive: 'iframe',
            iframe: 'iframe'
        }[details.kind] || 'iframe';

        const fallbackDefinition = state.registry.find((definition) => definition.id === fallbackId)
            || state.registry.find((definition) => definition.id === 'iframe')
            || null;

        return { details, definition: fallbackDefinition };
    };

    const destroyCurrent = () => {
        if (state.activeAdapter && typeof state.activeAdapter.destroy === 'function') {
            try {
                state.activeAdapter.destroy();
            } catch (error) {
                console.warn('[PlayerManager] failed to destroy active adapter', error);
            }
        }

        state.activeAdapter = null;
    };

    const loadYoutubeApi = () => {
        if (state.youtubeApiPromise) {
            return state.youtubeApiPromise;
        }

        state.youtubeApiPromise = new Promise((resolve) => {
            if (window.YT && window.YT.Player) {
                resolve();
                return;
            }

            window.onYouTubeIframeAPIReady = () => {
                resolve();
            };

            const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
            if (!existingScript) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(script);
            }
        });

        return state.youtubeApiPromise;
    };

    const create = async (server, context = {}) => {
        console.log('ENTER PlayerManager.create', { server, context: { hasVideoElement: Boolean(context.videoElement), hasExternalElement: Boolean(context.externalElement) } });
        destroyCurrent();

        const resolved = resolveAdapter(server);
        const { details, definition } = resolved;

        console.log('Servidor recibido:', details);
        console.log('URL:', details.url);
        console.log('Tipo detectado:', details.kind);
        console.log('Adaptador seleccionado:', definition?.id || 'none');

        if (context.videoElement) {
            context.videoElement.hidden = true;
            context.videoElement.style.display = 'none';
        }

        if (context.externalElement) {
            context.externalElement.hidden = true;
            context.externalElement.style.display = 'none';
        }

        if (!definition) {
            console.warn('[PlayerManager] No adapter matched server', details);
            return null;
        }

        const visibilityTargets = [context.videoElement, context.externalElement].filter(Boolean);
        visibilityTargets.forEach((element) => {
            element.hidden = true;
            element.style.display = 'none';
        });

        const mountContext = {
            ...context,
            server: details,
            manager: api
        };

        console.log('ENTER adapter.create', { adapterId: definition.id });
        const adapter = await definition.create(mountContext);
        console.log('EXIT adapter.create', { adapter: Boolean(adapter), adapterId: definition.id });
        if (!adapter) {
            return null;
        }

        adapter.kind = details.kind;
        adapter.adapterId = definition.id;
        adapter.definition = definition;
        adapter.server = details;
        adapter.capabilities = normalizeCapabilities(definition.capabilities, adapter.capabilities);
        adapter.supports = {
            playback: Boolean(adapter.capabilities.controllable),
            seeking: Boolean(adapter.capabilities.seekable),
            volume: Boolean(adapter.capabilities.volume),
            fullscreen: Boolean(adapter.capabilities.fullscreen),
            timeline: Boolean(adapter.capabilities.timeline),
            hls: Boolean(adapter.capabilities.hls)
        };

        state.activeAdapter = adapter;
        return adapter;
    };

    const api = {
        registerAdapter,
        create,
        destroyCurrent,
        loadYoutubeApi,
        normalizeServer,
        detectServerType: detectServerDetails,
        parseYoutubeId,
        normalizeCapabilities,
        getActiveAdapter: () => state.activeAdapter,
        resolveAdapter,
        getRegisteredAdapters: () => state.registry.slice()
    };

    window.BugaPlayerManager = api;
})();
