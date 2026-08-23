(function () {
    const shared = window.BugaShared || {};
    
    const sharedConfig = {
        API_ORIGIN: (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
            ? 'http://127.0.0.1:3100'
            : 'https://buga.onrender.com',
        API_KEY: 'b24af203b14e23f8c91844baae37cfab',
        TMDB_BASE_URL: 'https://api.themoviedb.org/3',
        IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
        IMAGE_BASE_URL_W780: 'https://image.tmdb.org/t/p/w780',
        POSTER_BASE_URL: 'https://image.tmdb.org/t/p/w500',
        FALLBACK_POSTER: '/assets/images/no-poster.png',
        DEFAULT_VIDEO_SOURCE: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        REQUEST_TIMEOUT_MS: 9000,
        TOAST_DURATION: 4200,
        TOAST_STACK_LIMIT: 4,
        STORAGE_KEYS: { // Nombre actualizado de 'ultrapelis' a 'Buga'
            AUTH: 'Buga-auth',
            ACTIVE_PROFILE: 'Buga-active-profile',
            TOAST_FLASH: 'Buga-toast-flash',
            FAVORITES: 'Buga-favorites',
            WATCH_HISTORY: 'Buga-watch-history'
        },
        API_BASES: {
            auth: '/api/auth',
            recommendations: '/api/recommendations',
            profiles: '/api/profiles',
            movies: '/api/movies',
            admin: '/api/admin'
        }
    };

    const requestWithTimeout = (promise, timeoutMs = sharedConfig.REQUEST_TIMEOUT_MS, label = 'request') =>
        Promise.race([
            promise,
            new Promise((_, reject) => {
                window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
            })
        ]);

    const resolveApiUrl = (path) => {
        if (!path) {
            return path;
        }

        if (/^https?:\/\//i.test(path)) {
            return path;
        }

        const normalizedPath = String(path).startsWith('/') ? String(path) : `/${path}`;
        return `${sharedConfig.API_ORIGIN}${normalizedPath}`;
    };

    const getProfileStorageKey = (suffix) => { // Renamed from getProfileStorageKey to avoid conflict
        if (window.BugaAuth?.getProfileStorageKey) {
            return window.BugaAuth.getProfileStorageKey(suffix);
        }

        return suffix;
    };

    const normalizeMovieData = (movie, mediaType = 'movie') => {
      if (!movie || typeof movie !== 'object') {
        movie = {};
      }

      const releaseDate = mediaType === 'tv'
        ? movie.first_air_date || movie.release_date || ''
        : movie.release_date || movie.first_air_date || '';

      const title = mediaType === 'tv'
        ? movie.name || movie.original_name || 'Serie sin título'
        : movie.title || movie.original_title || 'Película sin título';

      const genres = Array.isArray(movie.genres)
        ? movie.genres.map((genre) => (typeof genre === 'string' ? { name: genre } : (genre && genre.name ? { id: genre.id, name: genre.name } : { name: '' }))).filter(g => g.name)
        : [];

    return {
        id: movie.id,
        tmdb_id: movie.tmdb_id || null,
        mediaType,
        title,
        original_title: movie.original_title || movie.original_name || title,
        overview: movie.overview || movie.description || '',
        description: movie.description || movie.overview || '',
        tagline: movie.tagline || '',
        poster_url: movie.poster_url || (movie.poster_path ? `${sharedConfig.IMAGE_BASE_URL}${movie.poster_path}` : ''),
        banner_url: movie.banner_url || (movie.backdrop_path ? `${sharedConfig.IMAGE_BASE_URL_W780}${movie.backdrop_path}` : ''),
        poster: movie.poster_url || movie.poster || (movie.poster_path ? `${sharedConfig.IMAGE_BASE_URL}${movie.poster_path}` : sharedConfig.FALLBACK_POSTER),
        backdrop: movie.banner_url || movie.backdrop || (movie.backdrop_path ? `${sharedConfig.IMAGE_BASE_URL_W780}${movie.backdrop_path}` : ''),
        release_date: releaseDate,
        release_year: movie.release_year || (releaseDate ? String(releaseDate).slice(0, 4) : null),
        year: movie.release_year ? String(movie.release_year) : (releaseDate ? String(releaseDate).slice(0, 4) : 'N/A'),
        runtime: movie.runtime || 0,
        genres,
        rating: movie.rating || '',
        cast: Array.isArray(movie.cast) ? movie.cast : [],
        director: movie.director || '',
        trailer: movie.trailer || '',
        servers: Array.isArray(movie.servers) ? movie.servers : (Array.isArray(movie.playback_sources) ? movie.playback_sources : []),
        featured: Boolean(movie.featured),
        status: movie.status || 'published',
        popularity: Number(movie.popularity || 0)
    };
    }

    const normalizeIdList = (value) =>
        [...new Set((Array.isArray(value) ? value : [])
            .map((item) => String(item).trim())
            .filter(Boolean))];

    const tmdbFetch = async (path) => {
        const url = new URL(`${sharedConfig.TMDB_BASE_URL}${path}`);
        url.searchParams.set('api_key', sharedConfig.API_KEY);
        url.searchParams.set('language', 'es-ES');

        const response = await requestWithTimeout(fetch(url), sharedConfig.REQUEST_TIMEOUT_MS, 'tmdb');
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(body || `TMDb responded with ${response.status}`);
        }

        return response.json();
    };

    const buildTmdbMoviePayload = async (tmdbId) => {
        if (!tmdbId) {
            return null;
        }

        const movie = await tmdbFetch(`/movie/${tmdbId}?append_to_response=credits,videos`);
        console.log('===== TMDB RAW =====', JSON.stringify(movie, null, 2));
        const credits = movie.credits || {};
        const videos = movie.videos || {};
        const productionCompanies = Array.isArray(movie.production_companies)
            ? movie.production_companies.map((company) => company.name).filter(Boolean)
            : [];
        const trailer = (Array.isArray(videos.results) ? videos.results : [])
            .find((video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser'))?.key || '';
        const cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 10).map((person) => person.name).filter(Boolean) : [];
        const director = (Array.isArray(credits.crew) ? credits.crew : [])
            .find((person) => person.job === 'Director')?.name || '';
        const sourceUrl = `https://www.themoviedb.org/movie/${movie.id}`;

        return {
            tmdb_id: Number(movie.id),
            title: String(movie.title || movie.original_title || '').trim(),
            original_title: String(movie.original_title || movie.title || '').trim(),
            description: String(movie.overview || '').trim(),
            overview: String(movie.overview || '').trim(),
            poster_url: movie.poster_path ? `${sharedConfig.IMAGE_BASE_URL}${movie.poster_path}` : '',
            poster_srcset: movie.poster_path
                ? `https://image.tmdb.org/t/p/w185${movie.poster_path} 185w, https://image.tmdb.org/t/p/w342${movie.poster_path} 342w, https://image.tmdb.org/t/p/w500${movie.poster_path} 500w`
                : '',
            banner_url: movie.backdrop_path ? `${sharedConfig.IMAGE_BASE_URL_W780}${movie.backdrop_path}` : '',
            banner_srcset: movie.backdrop_path
                ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path} 300w, https://image.tmdb.org/t/p/w780${movie.backdrop_path} 780w, https://image.tmdb.org/t/p/w1280${movie.backdrop_path} 1280w`
                : '',
            release_year: Number.parseInt(String(movie.release_date || '').slice(0, 4), 10) || 0,
            release_date: movie.release_date || '',
            runtime: Number(movie.runtime || 0),
            country: Array.isArray(movie.production_countries) && movie.production_countries.length > 0
                ? String(movie.production_countries[0]?.name || movie.production_countries[0]?.iso_3166_1 || '').trim()
                : (Array.isArray(movie.origin_country) && movie.origin_country.length > 0 ? String(movie.origin_country[0] || '').trim() : ''),
            language: String(movie.spoken_languages?.[0]?.english_name || movie.spoken_languages?.[0]?.name || movie.original_language || '').trim(),
            genres: Array.isArray(movie.genres) ? movie.genres.map((genre) => genre.name).filter(Boolean) : [],
            rating: movie.vote_average > 0 ? String(Number(movie.vote_average).toFixed(1)) : '',
            cast,
            director,
            trailer: trailer ? `https://www.youtube.com/watch?v=${trailer}` : '',
            popularity: Number(movie.popularity || 0),
            creator_name: productionCompanies[0] || '',
            rights_holder: productionCompanies.join(', '),
            source_url: sourceUrl,
            production_companies: productionCompanies
        };
    };

    const buildTmdbSeriesPayload = async (tmdbId) => {
        if (!tmdbId) {
            return null;
        }

        const series = await tmdbFetch(`/tv/${tmdbId}?append_to_response=credits,videos,content_ratings`);
        const credits = series.credits || {};
        const videos = series.videos || {};
        const ratings = series.content_ratings || {};
        const productionCompanies = Array.isArray(series.production_companies)
            ? series.production_companies.map((company) => company.name).filter(Boolean)
            : [];
        const networks = Array.isArray(series.networks)
            ? series.networks.map((network) => network.name).filter(Boolean)
            : [];
        const firstAirDate = String(series.first_air_date || '').trim();
        const trailer = (Array.isArray(videos.results) ? videos.results : [])
            .find((video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser'))?.key || '';
        const cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 10).map((person) => person.name).filter(Boolean) : [];
        const creator = Array.isArray(series.created_by) && series.created_by.length > 0
            ? String(series.created_by[0]?.name || '').trim()
            : '';
        const rating = (Array.isArray(ratings.results) ? ratings.results : [])
            .find((item) => item.iso_3166_1 === 'US')?.rating
            || (Array.isArray(ratings.results) ? ratings.results[0]?.rating : '')
            || '';

        return {
            tmdb_id: Number(series.id),
            title: String(series.name || series.original_name || '').trim(),
            original_title: String(series.original_name || series.name || '').trim(),
            description: String(series.overview || '').trim(),
            overview: String(series.overview || '').trim(),
            poster_url: series.poster_path ? `${sharedConfig.IMAGE_BASE_URL}${series.poster_path}` : '',
            poster_srcset: series.poster_path
                ? `https://image.tmdb.org/t/p/w185${series.poster_path} 185w, https://image.tmdb.org/t/p/w342${series.poster_path} 342w, https://image.tmdb.org/t/p/w500${series.poster_path} 500w`
                : '',
            banner_url: series.backdrop_path ? `${sharedConfig.IMAGE_BASE_URL_W780}${series.backdrop_path}` : '',
            banner_srcset: series.backdrop_path
                ? `https://image.tmdb.org/t/p/w300${series.backdrop_path} 300w, https://image.tmdb.org/t/p/w780${series.backdrop_path} 780w, https://image.tmdb.org/t/p/w1280${series.backdrop_path} 1280w`
                : '',
            release_year: Number.parseInt(firstAirDate.slice(0, 4), 10) || 0,
            first_air_date: firstAirDate,
            genres: Array.isArray(series.genres) ? series.genres.map((genre) => genre.name).filter(Boolean) : [],
            rating,
            cast,
            creator,
            trailer,
            popularity: Number(series.popularity || 0),
            creator_name: creator,
            rights_holder: [...productionCompanies, ...networks].join(', '),
            source_url: `https://www.themoviedb.org/tv/${series.id}`,
            production_companies: productionCompanies,
            networks
        };
    };

    window.BugaShared = {
        ...shared,
        ...sharedConfig,
        requestWithTimeout,
        resolveApiUrl,
        getProfileStorageKey,
        normalizeMovie: normalizeMovieData,
        normalizeIdList,
        buildTmdbMoviePayload,
        buildTmdbSeriesPayload
    };
})();
