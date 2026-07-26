(function () {
    const { Html5PlayerAdapter } = window.BugaPlayerAdapters || {};
    const PlayerManager = window.BugaPlayerManager;

    if (!Html5PlayerAdapter || !PlayerManager) {
        throw new Error('Html5Adapter and PlayerManager must be loaded before HlsAdapter');
    }

    class HlsPlayerAdapter extends Html5PlayerAdapter {
        constructor(videoElement) {
            super(videoElement);
        }

        loadSource(url) {
            super.loadSource(url, 'hls');
        }
    }

    PlayerManager.registerAdapter({
        id: 'hls',
        priority: 100,
        capabilities: {
            controllable: true,
            seekable: true,
            volume: true,
            fullscreen: true,
            timeline: true,
            hls: true
        },
        match: (server) => server.kind === 'hls',
        create: async ({ videoElement, server }) => {
            if (!videoElement) {
                return null;
            }

            const adapter = new HlsPlayerAdapter(videoElement);
            adapter.loadSource(server.url);
            return adapter;
        }
    });

    window.BugaPlayerAdapters = {
        ...(window.BugaPlayerAdapters || {}),
        HlsPlayerAdapter
    };
})();
