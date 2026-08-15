(function () {
console.log('[BUGA SERIES BUILD]', '2026-08-13', 'frontend/js/admin-series.js');

const ADMIN_API = window.BugaShared?.resolveApiUrl?.('/api/admin') || '/api/admin';
const SERIES_API = `${ADMIN_API}/series`;
const $ = (id) => document.getElementById(id);

const adminSidebar = $('adminSidebar');
const adminLogout = $('adminLogout');
const adminRefresh = $('adminRefresh');
const pageLoader = $('pageLoader');

const addSeriesBtn = $('addSeriesBtn');
const seriesForm = $('seriesForm');
const seriesId = $('seriesId');
const seriesTmdbId = $('seriesTmdbId');
const seriesTitle = $('seriesTitle');
const seriesOriginalTitle = $('seriesOriginalTitle');
const seriesOverview = $('seriesOverview');
const seriesDescription = $('seriesDescription');
const seriesPosterUrl = $('seriesPosterUrl');
const seriesBannerUrl = $('seriesBannerUrl');
const seriesPosterSrcset = $('seriesPosterSrcset');
const seriesBannerSrcset = $('seriesBannerSrcset');
const seriesReleaseYear = $('seriesReleaseYear');
const seriesFirstAirDate = $('seriesFirstAirDate');
const seriesGenres = $('seriesGenres');
const seriesRating = $('seriesRating');
const seriesCast = $('seriesCast');
const seriesCreator = $('seriesCreator');
const seriesTrailer = $('seriesTrailer');
const seriesPopularity = $('seriesPopularity');
const seriesStatus = $('seriesStatus');
const seriesContentType = $('seriesContentType');
const seriesCreatorName = $('seriesCreatorName');
const seriesRightsHolder = $('seriesRightsHolder');
const seriesLicenseInfo = $('seriesLicenseInfo');
const seriesSourceUrl = $('seriesSourceUrl');
const fetchSeriesTmdbDataButton = $('fetchSeriesTmdbData');
const seriesTable = $('seriesTable');
const clearSeriesFormButton = $('clearSeriesForm');
const seriesSubmit = $('seriesSubmit');

const seasonSeriesSelect = $('seasonSeriesSelect');
const seasonForm = $('seasonForm');
const seasonId = $('seasonId');
const seasonSeriesId = $('seasonSeriesId');
const seasonNumber = $('seasonNumber');
const seasonTitle = $('seasonTitle');
const seasonDescription = $('seasonDescription');
const seasonOverview = $('seasonOverview');
const seasonPosterUrl = $('seasonPosterUrl');
const seasonBannerUrl = $('seasonBannerUrl');
const seasonReleaseDate = $('seasonReleaseDate');
const seasonTmdbId = $('seasonTmdbId');
const seasonStatus = $('seasonStatus');
const seasonsTable = $('seasonsTable');
const clearSeasonFormButton = $('clearSeasonForm');
const seasonSubmit = $('seasonSubmit');

const episodeSeriesSelect = $('episodeSeriesSelect');
const episodeSeasonSelect = $('episodeSeasonSelect');
const episodeForm = $('episodeForm');
const episodeId = $('episodeId');
const episodeSeasonId = $('episodeSeasonId');
const episodeNumber = $('episodeNumber');
const episodeTitle = $('episodeTitle');
const episodeDescription = $('episodeDescription');
const episodeOverview = $('episodeOverview');
const episodeThumbnailUrl = $('episodeThumbnailUrl');
const episodeRuntime = $('episodeRuntime');
const episodeReleaseDate = $('episodeReleaseDate');
const episodeTmdbId = $('episodeTmdbId');
const episodeStatus = $('episodeStatus');
const episodeServerRows = $('episodeServerRows');
const addEpisodeServerButton = $('addEpisodeServerButton');
const episodesTable = $('episodesTable');
const clearEpisodeFormButton = $('clearEpisodeForm');
const episodeSubmit = $('episodeSubmit');

const notify = (options) => window.BugaToast?.show?.(options);
const normalizeListItems = (value) =>
    Array.isArray(value)
        ? value
            .map((item) => {
                if (typeof item === 'string' || typeof item === 'number') {
                    return String(item).trim();
                }

                if (item && typeof item === 'object') {
                    return String(item.name || item.title || item.label || item.value || '').trim();
                }

                return '';
            })
            .filter(Boolean)
        : [];

const escapeText = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const requireAdmin = () => {
    const session = window.BugaAuth?.getAuthSession?.();
    if (!session?.token) {
        window.location.href = '/pages/login.html';
        return false;
    }

    if (session.user?.role !== 'admin') {
        window.location.href = '/index.html';
        return false;
    }

    return true;
};

const showLoader = () => {
    document.body.classList.add('is-loading');
    pageLoader?.setAttribute('aria-busy', 'true');
};

const hideLoader = () => {
    document.body.classList.remove('is-loading');
    pageLoader?.setAttribute('aria-busy', 'false');
};

const authHeaders = () => {
    const token = window.BugaAuth?.getAuthToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchJson = async (url, options = {}) => {
    const response = await window.BugaShared.requestWithTimeout(
        fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                ...authHeaders(),
                ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
            }
        }),
        window.BugaShared.REQUEST_TIMEOUT_MS,
        `admin series ${options.method || 'GET'}`
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'La operación no pudo completarse');
    }

    return data;
};

const seriesTableState = {
    series: [],
    seasons: [],
    episodes: []
};

const createServerRowHTML = (server = {}) => {
    const { name = '', type = 'iframe', url = '', status = 'active', order = 0 } = server;
    return `
        <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="${escapeText(name)}"></label>
        <label><span>Tipo</span>
            <select class="server-type">
                <option value="youtube" ${type === 'youtube' ? 'selected' : ''}>youtube</option>
                <option value="mp4" ${type === 'mp4' ? 'selected' : ''}>mp4</option>
                <option value="m3u8" ${type === 'm3u8' ? 'selected' : ''}>m3u8</option>
                <option value="iframe" ${type === 'iframe' ? 'selected' : ''}>iframe</option>
                <option value="embed" ${type === 'embed' ? 'selected' : ''}>embed</option>
            </select>
        </label>
        <label><span>Enlace/Código</span><input type="text" class="server-url" placeholder="https://... o código iframe" value="${escapeText(url)}"></label>
        <label><span>Estado</span>
            <select class="server-status">
                <option value="active" ${status === 'active' ? 'selected' : ''}>Activo</option>
                <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactivo</option>
            </select>
        </label>
        <label><span>Orden</span><input type="number" class="server-order" value="${Number(order) || 0}" min="0"></label>
        <button class="admin-secondary" type="button">Eliminar</button>
    `;
};

const addEpisodeServerRow = (server = {}) => {
    if (!episodeServerRows) {
        return;
    }

    const row = document.createElement('div');
    row.className = 'admin-server-row';
    row.innerHTML = createServerRowHTML(server);

    row.querySelector('button')?.addEventListener('click', () => {
        row.remove();
        if (!episodeServerRows.querySelector('.admin-server-row')) {
            addEpisodeServerRow({ name: 'Servidor 1' });
        }
    });

    episodeServerRows.appendChild(row);
};

const resetEpisodeServerRows = (servers = []) => {
    if (!episodeServerRows) {
        return;
    }

    episodeServerRows.innerHTML = '';
    const fallback = servers.length ? servers : [{ name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 }];
    fallback.forEach((server) => addEpisodeServerRow(server));
};

const getEpisodeServers = () => {
    if (!episodeServerRows) {
        return [];
    }

    return Array.from(episodeServerRows.querySelectorAll('.admin-server-row'))
        .map((row) => ({
            name: row.querySelector('.server-name')?.value?.trim() || '',
            type: row.querySelector('.server-type')?.value || 'iframe',
            url: row.querySelector('.server-url')?.value?.trim() || '',
            status: row.querySelector('.server-status')?.value || 'active',
            order: Number.parseInt(row.querySelector('.server-order')?.value, 10) || 0
        }))
        .filter((server) => server.name && server.url);
};

const setActiveSection = (sectionName) => {
    document.querySelectorAll('[data-admin-section]').forEach((section) => {
        section.classList.toggle('is-active', section.dataset.adminSection === sectionName);
    });

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.adminTab === sectionName);
    });
};

const populateSeriesSelects = () => {
    const previousSeasonSeriesId = seasonSeriesSelect?.value || '';
    const previousEpisodeSeriesId = episodeSeriesSelect?.value || '';

    const options = seriesTableState.series
        .map((series) => `<option value="${escapeText(series.id)}">${escapeText(series.title)}</option>`)
        .join('');

    if (seasonSeriesSelect) {
        seasonSeriesSelect.innerHTML = `<option value="">Seleccionar serie...</option>${options}`;
        if (previousSeasonSeriesId) {
            seasonSeriesSelect.value = previousSeasonSeriesId;
        }
    }

    if (episodeSeriesSelect) {
        episodeSeriesSelect.innerHTML = `<option value="">Seleccionar serie...</option>${options}`;
        if (previousEpisodeSeriesId) {
            episodeSeriesSelect.value = previousEpisodeSeriesId;
        }
    }
};

const populateSeasonSelect = () => {
    if (!episodeSeasonSelect) {
        return;
    }

    const previousEpisodeSeasonId = episodeSeasonSelect.value || '';
    const options = seriesTableState.seasons
        .map((season) => `<option value="${escapeText(season.id)}">${escapeText(`T${season.season_number} — ${season.title || 'Sin título'}`)}</option>`)
        .join('');

    episodeSeasonSelect.innerHTML = `<option value="">Seleccionar temporada...</option>${options}`;
    if (previousEpisodeSeasonId) {
        episodeSeasonSelect.value = previousEpisodeSeasonId;
    }
    episodeSeasonSelect.disabled = !seriesTableState.seasons.length;
};

const renderSeriesTable = () => {
    if (!seriesTable) {
        return;
    }

    seriesTable.innerHTML = seriesTableState.series.length
        ? seriesTableState.series.map((series) => `
            <tr>
                <td>
                    <strong>${escapeText(series.title)}</strong>
                    <div class="admin-small">${escapeText(series.original_title || '')}</div>
                </td>
                <td>${escapeText(series.tmdb_id || '—')}</td>
                <td>${escapeText(series.release_year || '—')}</td>
                <td><span class="admin-pill ${escapeText(series.status || 'published')}">${escapeText(series.status || 'published')}</span></td>
                <td>
                    <div class="admin-row-actions">
                        <button class="admin-secondary" type="button" data-edit-series="${escapeText(series.id)}">Editar</button>
                        <button class="admin-secondary" type="button" data-delete-series="${escapeText(series.id)}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5">Todavía no hay series guardadas.</td></tr>';
};

const renderSeasonsTable = () => {
    if (!seasonsTable) {
        return;
    }

    const seriesById = new Map(seriesTableState.series.map((series) => [series.id, series.title]));

    seasonsTable.innerHTML = seriesTableState.seasons.length
        ? seriesTableState.seasons.map((season) => `
            <tr>
                <td>${escapeText(seriesById.get(season.series_id) || 'Serie')}</td>
                <td>${escapeText(season.season_number)}</td>
                <td>${escapeText(season.title || 'Sin título')}</td>
                <td><span class="admin-pill ${escapeText(season.status || 'published')}">${escapeText(season.status || 'published')}</span></td>
                <td>
                    <div class="admin-row-actions">
                        <button class="admin-secondary" type="button" data-edit-season="${escapeText(season.id)}">Editar</button>
                        <button class="admin-secondary" type="button" data-delete-season="${escapeText(season.id)}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5">No hay temporadas cargadas.</td></tr>';
};

const renderEpisodesTable = () => {
    if (!episodesTable) {
        return;
    }

    const seriesById = new Map(seriesTableState.series.map((series) => [series.id, series.title]));
    const seasonsById = new Map(seriesTableState.seasons.map((season) => [season.id, season]));

    episodesTable.innerHTML = seriesTableState.episodes.length
        ? seriesTableState.episodes.map((episode) => {
            const season = seasonsById.get(episode.season_id);
            return `
                <tr>
                    <td>${escapeText(seriesById.get(season?.series_id) || 'Serie')}</td>
                    <td>${escapeText(season ? `T${season.season_number}` : '—')}</td>
                    <td>${escapeText(episode.episode_number)}</td>
                    <td>${escapeText(episode.title || 'Sin título')}</td>
                    <td><span class="admin-pill ${escapeText(episode.status || 'published')}">${escapeText(episode.status || 'published')}</span></td>
                    <td>
                        <div class="admin-row-actions">
                            <button class="admin-secondary" type="button" data-edit-episode="${escapeText(episode.id)}">Editar</button>
                            <button class="admin-secondary" type="button" data-delete-episode="${escapeText(episode.id)}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('')
        : '<tr><td colspan="6">No hay episodios cargados.</td></tr>';
};

const clearSeriesForm = () => {
    seriesForm?.reset();
    seriesId.value = '';
    seriesTmdbId.value = '';
    seriesTitle.value = '';
    seriesOriginalTitle.value = '';
    seriesOverview.value = '';
    seriesDescription.value = '';
    seriesPosterUrl.value = '';
    seriesBannerUrl.value = '';
    seriesPosterSrcset.value = '';
    seriesBannerSrcset.value = '';
    seriesReleaseYear.value = '';
    seriesFirstAirDate.value = '';
    seriesGenres.value = '';
    seriesRating.value = '';
    seriesCast.value = '';
    seriesCreator.value = '';
    seriesTrailer.value = '';
    seriesPopularity.value = '';
    seriesStatus.value = 'published';
    seriesContentType.value = 'independent';
    seriesCreatorName.value = '';
    seriesRightsHolder.value = '';
    seriesLicenseInfo.value = '';
    seriesSourceUrl.value = '';
    seriesSubmit.textContent = 'Guardar serie';
};

const handleAutoFillSeriesFromTmdb = async () => {
    const tmdbId = seriesTmdbId.value.trim();
    if (!tmdbId) {
        return;
    }

    const previousLabel = fetchSeriesTmdbDataButton?.textContent || 'Autorrellenar TMDb';
    if (fetchSeriesTmdbDataButton) {
        fetchSeriesTmdbDataButton.disabled = true;
        fetchSeriesTmdbDataButton.textContent = 'Buscando...';
    }

    try {
        const data = await fetchJson(`${SERIES_API}/tmdb/${encodeURIComponent(tmdbId)}`).catch(async (error) => {
            console.warn('Backend series TMDb lookup failed, trying direct TMDb fallback', error);
            return window.BugaShared?.buildTmdbSeriesPayload
                ? { series: await window.BugaShared.buildTmdbSeriesPayload(Number(tmdbId)) }
                : { series: null };
        });
        const series = data.series || data;

        if (!series || !(series.tmdb_id || series.id)) {
            throw new Error(`No se encontró una serie con el ID ${tmdbId}`);
        }

        seriesTmdbId.value = series.tmdb_id || tmdbId;
        seriesTitle.value = series.title || '';
        seriesOriginalTitle.value = series.original_title || '';
        seriesDescription.value = series.description || series.overview || '';
        seriesOverview.value = series.overview || '';
        seriesPosterUrl.value = series.poster_url || '';
        seriesBannerUrl.value = series.banner_url || '';
        seriesPosterSrcset.value = series.poster_srcset || '';
        seriesBannerSrcset.value = series.banner_srcset || '';
        seriesReleaseYear.value = series.release_year || '';
        seriesFirstAirDate.value = series.first_air_date || '';
        seriesGenres.value = Array.isArray(series.genres) ? normalizeListItems(series.genres).join(', ') : '';
        seriesRating.value = series.rating || '';
        seriesCast.value = Array.isArray(series.cast) ? normalizeListItems(series.cast).join(', ') : '';
        seriesCreator.value = series.creator || '';
        seriesTrailer.value = series.trailer || '';
        seriesPopularity.value = series.popularity || '';
        seriesStatus.value = series.status || 'published';

        notify({
            type: 'success',
            title: 'Serie encontrada',
            message: series.title || 'La información se completó automáticamente.'
        });
    } catch (error) {
        notify({ type: 'error', title: 'Error al autocompletar', message: error.message || 'No se pudo obtener la información.' });
    } finally {
        if (fetchSeriesTmdbDataButton) {
            fetchSeriesTmdbDataButton.disabled = false;
            fetchSeriesTmdbDataButton.textContent = previousLabel;
        }
    }
};

const clearSeasonForm = () => {
    seasonForm?.reset();
    seasonId.value = '';
    seasonSeriesId.value = seasonSeriesSelect?.value || '';
    seasonNumber.value = '';
    seasonTitle.value = '';
    seasonDescription.value = '';
    seasonOverview.value = '';
    seasonPosterUrl.value = '';
    seasonBannerUrl.value = '';
    seasonReleaseDate.value = '';
    seasonTmdbId.value = '';
    seasonStatus.value = 'published';
    seasonSubmit.textContent = 'Guardar temporada';
};

const clearEpisodeForm = () => {
    episodeForm?.reset();
    episodeId.value = '';
    episodeSeasonId.value = episodeSeasonSelect?.value || '';
    episodeNumber.value = '';
    episodeTitle.value = '';
    episodeDescription.value = '';
    episodeOverview.value = '';
    episodeThumbnailUrl.value = '';
    episodeRuntime.value = '';
    episodeReleaseDate.value = '';
    episodeTmdbId.value = '';
    episodeStatus.value = 'published';
    resetEpisodeServerRows();
    episodeSubmit.textContent = 'Guardar episodio';
};

const fillSeriesForm = (series) => {
    seriesId.value = series?.id || '';
    seriesTmdbId.value = series?.tmdb_id || '';
    seriesTitle.value = series?.title || '';
    seriesOriginalTitle.value = series?.original_title || '';
    seriesDescription.value = series?.description || series?.overview || '';
    seriesOverview.value = series?.overview || '';
    seriesPosterUrl.value = series?.poster_url || '';
    seriesBannerUrl.value = series?.banner_url || '';
    seriesPosterSrcset.value = series?.poster_srcset || '';
    seriesBannerSrcset.value = series?.banner_srcset || '';
    seriesReleaseYear.value = series?.release_year || '';
    seriesFirstAirDate.value = series?.first_air_date || '';
    seriesGenres.value = normalizeListItems(series?.genres).join(', ');
    seriesRating.value = series?.rating || '';
    seriesCast.value = normalizeListItems(series?.cast).join(', ');
    seriesCreator.value = series?.creator || '';
    seriesTrailer.value = series?.trailer || '';
    seriesPopularity.value = series?.popularity || '';
    seriesStatus.value = series?.status || 'published';
    seriesContentType.value = series?.content_type || 'independent';
    seriesCreatorName.value = series?.creator_name || '';
    seriesRightsHolder.value = series?.rights_holder || '';
    seriesLicenseInfo.value = series?.license_info || '';
    seriesSourceUrl.value = series?.source_url || '';
    seriesSubmit.textContent = series ? 'Actualizar serie' : 'Guardar serie';
};

const fillSeasonForm = (season) => {
    seasonId.value = season?.id || '';
    seasonSeriesId.value = season?.series_id || '';
    if (seasonSeriesSelect) {
        seasonSeriesSelect.value = season?.series_id || '';
    }
    seasonNumber.value = season?.season_number || '';
    seasonTitle.value = season?.title || '';
    seasonDescription.value = season?.description || '';
    seasonOverview.value = season?.overview || '';
    seasonPosterUrl.value = season?.poster_url || '';
    seasonBannerUrl.value = season?.banner_url || '';
    seasonReleaseDate.value = season?.release_date || '';
    seasonTmdbId.value = season?.tmdb_id || '';
    seasonStatus.value = season?.status || 'published';
    seasonSubmit.textContent = season ? 'Actualizar temporada' : 'Guardar temporada';
};

const fillEpisodeForm = (episode) => {
    episodeId.value = episode?.id || '';
    episodeSeasonId.value = episode?.season_id || '';
    const season = seriesTableState.seasons.find((item) => item.id === episode?.season_id);
    if (seasonSeriesSelect && season?.series_id) {
        seasonSeriesSelect.value = season.series_id;
    }
    if (episodeSeriesSelect && season?.series_id) {
        episodeSeriesSelect.value = season.series_id;
    }
    if (episodeSeasonSelect && episode?.season_id) {
        episodeSeasonSelect.value = episode.season_id;
    }
    episodeNumber.value = episode?.episode_number || '';
    episodeTitle.value = episode?.title || '';
    episodeDescription.value = episode?.description || '';
    episodeOverview.value = episode?.overview || '';
    episodeThumbnailUrl.value = episode?.thumbnail_url || '';
    episodeRuntime.value = episode?.runtime || '';
    episodeReleaseDate.value = episode?.release_date || '';
    episodeTmdbId.value = episode?.tmdb_id || '';
    episodeStatus.value = episode?.status || 'published';
    resetEpisodeServerRows(Array.isArray(episode?.servers) ? episode.servers : []);
    episodeSubmit.textContent = episode ? 'Actualizar episodio' : 'Guardar episodio';
};

const loadSeries = async () => {
    const data = await fetchJson(SERIES_API);
    seriesTableState.series = Array.isArray(data.series) ? data.series : [];
    populateSeriesSelects();
    renderSeriesTable();
};

const loadSeasons = async (seriesIdValue = '') => {
    if (!seriesIdValue) {
        seriesTableState.seasons = [];
        seriesTableState.episodes = [];
        populateSeasonSelect();
        renderSeasonsTable();
        renderEpisodesTable();
        return;
    }

    const data = await fetchJson(`${SERIES_API}/${seriesIdValue}/seasons`);
    seriesTableState.seasons = Array.isArray(data.seasons) ? data.seasons : [];
    seriesTableState.episodes = [];
    populateSeasonSelect();
    renderSeasonsTable();
    renderEpisodesTable();
};

const loadEpisodes = async (seriesIdValue = '', seasonIdValue = '') => {
    if (!seriesIdValue || !seasonIdValue) {
        seriesTableState.episodes = [];
        renderEpisodesTable();
        return;
    }

    const data = await fetchJson(`${SERIES_API}/${seriesIdValue}/seasons/${seasonIdValue}/episodes`);
    seriesTableState.episodes = Array.isArray(data.episodes) ? data.episodes : [];
    renderEpisodesTable();
};

const refreshContext = async () => {
    const selectedSeasonSeriesId = seasonSeriesSelect?.value || '';
    const selectedEpisodeSeriesId = episodeSeriesSelect?.value || '';
    const selectedEpisodeSeasonId = episodeSeasonSelect?.value || '';

    await loadSeries();

    const selectedSeriesId = selectedSeasonSeriesId || selectedEpisodeSeriesId || '';
    if (selectedSeriesId) {
        if (seasonSeriesSelect) {
            seasonSeriesSelect.value = selectedSeriesId;
        }
        if (episodeSeriesSelect) {
            episodeSeriesSelect.value = selectedSeriesId;
        }
        await loadSeasons(selectedSeriesId);
    } else {
        await loadSeasons('');
    }

    const selectedSeasonId = selectedEpisodeSeasonId || '';
    if (selectedSeriesId && selectedSeasonId) {
        if (episodeSeasonSelect) {
            episodeSeasonSelect.value = selectedSeasonId;
        }
        await loadEpisodes(selectedSeriesId, selectedSeasonId);
    } else {
        await loadEpisodes('', '');
    }
};

const handleSeriesSubmit = async (event) => {
    event.preventDefault();

    const payload = {
        tmdbId: seriesTmdbId.value.trim() ? Number(seriesTmdbId.value) : null,
        title: seriesTitle.value.trim(),
        original_title: seriesOriginalTitle.value.trim(),
        description: seriesDescription.value.trim(),
        overview: seriesOverview.value.trim(),
        poster_url: seriesPosterUrl.value.trim(),
        banner_url: seriesBannerUrl.value.trim(),
        poster_srcset: seriesPosterSrcset.value.trim(),
        banner_srcset: seriesBannerSrcset.value.trim(),
        release_year: seriesReleaseYear.value ? Number(seriesReleaseYear.value) : 0,
        first_air_date: seriesFirstAirDate.value.trim(),
        genres: seriesGenres.value.trim().split(',').map((value) => value.trim()).filter(Boolean),
        rating: seriesRating.value.trim(),
        cast: seriesCast.value.trim().split(',').map((value) => value.trim()).filter(Boolean),
        creator: seriesCreator.value.trim(),
        trailer: seriesTrailer.value.trim(),
        featured: false,
        status: seriesStatus.value || 'published',
        content_type: seriesContentType.value || 'independent',
        creator_name: seriesCreatorName.value.trim(),
        rights_holder: seriesRightsHolder.value.trim(),
        license_info: seriesLicenseInfo.value.trim(),
        source_url: seriesSourceUrl.value.trim(),
        popularity: seriesPopularity.value ? Number(seriesPopularity.value) : 0
    };

    if (!payload.title) {
        notify({ type: 'error', title: 'Título obligatorio', message: 'Ingresa un título para la serie.' });
        return;
    }

    seriesSubmit.disabled = true;
    seriesSubmit.textContent = seriesId.value ? 'Actualizando...' : 'Guardando...';

    try {
        const isEditing = Boolean(seriesId.value);
        const endpoint = isEditing ? `${SERIES_API}/${seriesId.value}` : SERIES_API;
        const method = isEditing ? 'PUT' : 'POST';
        await fetchJson(endpoint, { method, body: JSON.stringify(payload) });

        notify({
            type: 'success',
            title: isEditing ? 'Serie actualizada' : 'Serie guardada',
            message: payload.title
        });

        clearSeriesForm();
        await refreshContext();
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar la serie', message: error.message || 'Intenta nuevamente.' });
    } finally {
        seriesSubmit.disabled = false;
        seriesSubmit.textContent = seriesId.value ? 'Actualizar serie' : 'Guardar serie';
    }
};

const handleSeasonSubmit = async (event) => {
    event.preventDefault();

    const selectedSeriesId = seasonSeriesSelect?.value || seasonSeriesId.value || '';
    if (!selectedSeriesId) {
        notify({ type: 'error', title: 'Falta la serie', message: 'Selecciona una serie antes de guardar la temporada.' });
        return;
    }

    const payload = {
        season_number: Number(seasonNumber.value),
        title: seasonTitle.value.trim(),
        description: seasonDescription.value.trim(),
        overview: seasonOverview.value.trim(),
        poster_url: seasonPosterUrl.value.trim(),
        banner_url: seasonBannerUrl.value.trim(),
        release_date: seasonReleaseDate.value.trim(),
        tmdbId: seasonTmdbId.value.trim() ? Number(seasonTmdbId.value) : null,
        status: seasonStatus.value || 'published'
    };

    if (!payload.season_number) {
        notify({ type: 'error', title: 'Número obligatorio', message: 'Ingresa un número de temporada.' });
        return;
    }

    seasonSubmit.disabled = true;
    seasonSubmit.textContent = seasonId.value ? 'Actualizando...' : 'Guardando...';

    try {
        const isEditing = Boolean(seasonId.value);
        const endpoint = isEditing
            ? `${SERIES_API}/${selectedSeriesId}/seasons/${seasonId.value}`
            : `${SERIES_API}/${selectedSeriesId}/seasons`;
        const method = isEditing ? 'PUT' : 'POST';
        await fetchJson(endpoint, { method, body: JSON.stringify(payload) });

        notify({
            type: 'success',
            title: isEditing ? 'Temporada actualizada' : 'Temporada guardada',
            message: payload.title || `Temporada ${payload.season_number}`
        });

        clearSeasonForm();
        await loadSeasons(selectedSeriesId);
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar la temporada', message: error.message || 'Intenta nuevamente.' });
    } finally {
        seasonSubmit.disabled = false;
        seasonSubmit.textContent = seasonId.value ? 'Actualizar temporada' : 'Guardar temporada';
    }
};

const handleEpisodeSubmit = async (event) => {
    event.preventDefault();

    const selectedSeriesId = episodeSeriesSelect?.value || '';
    const selectedSeasonId = episodeSeasonSelect?.value || episodeSeasonId.value || '';

    if (!selectedSeriesId || !selectedSeasonId) {
        notify({ type: 'error', title: 'Falta contexto', message: 'Selecciona una serie y una temporada antes de guardar el episodio.' });
        return;
    }

    const payload = {
        episode_number: Number(episodeNumber.value),
        title: episodeTitle.value.trim(),
        description: episodeDescription.value.trim(),
        overview: episodeOverview.value.trim(),
        thumbnail_url: episodeThumbnailUrl.value.trim(),
        runtime: episodeRuntime.value ? Number(episodeRuntime.value) : 0,
        release_date: episodeReleaseDate.value.trim(),
        tmdbId: episodeTmdbId.value.trim() ? Number(episodeTmdbId.value) : null,
        servers: getEpisodeServers(),
        status: episodeStatus.value || 'published'
    };

    if (!payload.episode_number || !payload.title) {
        notify({ type: 'error', title: 'Datos obligatorios', message: 'Número y título son obligatorios.' });
        return;
    }

    if (!payload.servers.length) {
        notify({ type: 'error', title: 'Sin servidores', message: 'Agrega al menos un servidor para el episodio.' });
        return;
    }

    episodeSubmit.disabled = true;
    episodeSubmit.textContent = episodeId.value ? 'Actualizando...' : 'Guardando...';

    try {
        const isEditing = Boolean(episodeId.value);
        const endpoint = isEditing
            ? `${SERIES_API}/${selectedSeriesId}/seasons/${selectedSeasonId}/episodes/${episodeId.value}`
            : `${SERIES_API}/${selectedSeriesId}/seasons/${selectedSeasonId}/episodes`;
        const method = isEditing ? 'PUT' : 'POST';
        await fetchJson(endpoint, { method, body: JSON.stringify(payload) });

        notify({
            type: 'success',
            title: isEditing ? 'Episodio actualizado' : 'Episodio guardado',
            message: payload.title
        });

        clearEpisodeForm();
        await loadEpisodes(selectedSeriesId, selectedSeasonId);
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar el episodio', message: error.message || 'Intenta nuevamente.' });
    } finally {
        episodeSubmit.disabled = false;
        episodeSubmit.textContent = episodeId.value ? 'Actualizar episodio' : 'Guardar episodio';
    }
};

const handleSeriesTableAction = async (event) => {
    const editButton = event.target.closest('[data-edit-series]');
    const deleteButton = event.target.closest('[data-delete-series]');

    if (editButton) {
        const selected = seriesTableState.series.find((item) => String(item.id) === editButton.dataset.editSeries);
        if (!selected) {
            return;
        }

        fillSeriesForm(selected);
        setActiveSection('series');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (deleteButton) {
        const selected = seriesTableState.series.find((item) => String(item.id) === deleteButton.dataset.deleteSeries);
        if (!selected) {
            return;
        }

        if (!window.confirm(`¿Eliminar la serie "${selected.title}"?`)) {
            return;
        }

        try {
            await fetchJson(`${SERIES_API}/${selected.id}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Serie eliminada', message: selected.title });
            await refreshContext();
        } catch (error) {
            notify({ type: 'error', title: 'No se pudo eliminar', message: error.message || 'Intenta nuevamente.' });
        }
    }
};

const handleSeasonTableAction = async (event) => {
    const editButton = event.target.closest('[data-edit-season]');
    const deleteButton = event.target.closest('[data-delete-season]');

    if (editButton) {
        const selected = seriesTableState.seasons.find((item) => String(item.id) === editButton.dataset.editSeason);
        if (!selected) {
            return;
        }

        fillSeasonForm(selected);
        setActiveSection('seasons');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (deleteButton) {
        const selected = seriesTableState.seasons.find((item) => String(item.id) === deleteButton.dataset.deleteSeason);
        if (!selected) {
            return;
        }

        const selectedSeriesId = selected.series_id;
        if (!window.confirm(`¿Eliminar la temporada ${selected.season_number}?`)) {
            return;
        }

        try {
            await fetchJson(`${SERIES_API}/${selectedSeriesId}/seasons/${selected.id}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Temporada eliminada', message: selected.title || `Temporada ${selected.season_number}` });
            await loadSeasons(selectedSeriesId);
        } catch (error) {
            notify({ type: 'error', title: 'No se pudo eliminar', message: error.message || 'Intenta nuevamente.' });
        }
    }
};

const handleEpisodeTableAction = async (event) => {
    const editButton = event.target.closest('[data-edit-episode]');
    const deleteButton = event.target.closest('[data-delete-episode]');

    if (editButton) {
        const selected = seriesTableState.episodes.find((item) => String(item.id) === editButton.dataset.editEpisode);
        if (!selected) {
            return;
        }

        fillEpisodeForm(selected);
        setActiveSection('episodes');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (deleteButton) {
        const selected = seriesTableState.episodes.find((item) => String(item.id) === deleteButton.dataset.deleteEpisode);
        if (!selected) {
            return;
        }

        const season = seriesTableState.seasons.find((item) => item.id === selected.season_id);
        const selectedSeriesId = season?.series_id || episodeSeriesSelect?.value || '';
        if (!selectedSeriesId || !season) {
            return;
        }

        if (!window.confirm(`¿Eliminar el episodio ${selected.episode_number}?`)) {
            return;
        }

        try {
            await fetchJson(`${SERIES_API}/${selectedSeriesId}/seasons/${season.id}/episodes/${selected.id}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Episodio eliminado', message: selected.title });
            await loadEpisodes(selectedSeriesId, season.id);
        } catch (error) {
            notify({ type: 'error', title: 'No se pudo eliminar', message: error.message || 'Intenta nuevamente.' });
        }
    }
};

const bootstrap = async () => {
    if (!requireAdmin()) {
        return;
    }

    setActiveSection('series');
    clearSeriesForm();
    clearSeasonForm();
    clearEpisodeForm();

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
        button.addEventListener('click', () => setActiveSection(button.dataset.adminTab));
    });

    addSeriesBtn?.addEventListener('click', () => {
        clearSeriesForm();
        setActiveSection('series');
        seriesTitle?.focus();
    });

    adminRefresh?.addEventListener('click', async () => {
        showLoader();
        try {
            await refreshContext();
        } catch (error) {
            notify({ type: 'error', title: 'No se pudo actualizar', message: error.message || 'Intenta nuevamente.' });
        } finally {
            hideLoader();
        }
    });

    adminLogout?.addEventListener('click', () => {
        window.BugaAuth?.logout?.();
    });

    seriesForm?.addEventListener('submit', handleSeriesSubmit);
    clearSeriesFormButton?.addEventListener('click', clearSeriesForm);
    seriesTable?.addEventListener('click', handleSeriesTableAction);

    seasonSeriesSelect?.addEventListener('change', async () => {
        const selectedSeriesId = seasonSeriesSelect.value || '';
        seasonSeriesId.value = selectedSeriesId;
        clearSeasonForm();
        clearEpisodeForm();
        showLoader();
        try {
            await loadSeasons(selectedSeriesId);
        } catch (error) {
            notify({ type: 'error', title: 'No se pudieron cargar temporadas', message: error.message || 'Intenta nuevamente.' });
        } finally {
            hideLoader();
        }
    });

    seasonForm?.addEventListener('submit', handleSeasonSubmit);
    clearSeasonFormButton?.addEventListener('click', clearSeasonForm);
    seasonsTable?.addEventListener('click', handleSeasonTableAction);

    episodeSeriesSelect?.addEventListener('change', async () => {
        const selectedSeriesId = episodeSeriesSelect.value || '';
        if (seasonSeriesSelect) {
            seasonSeriesSelect.value = selectedSeriesId;
        }
        clearEpisodeForm();
        showLoader();
        try {
            await loadSeasons(selectedSeriesId);
            episodeSeasonSelect.value = '';
            seriesTableState.episodes = [];
            renderEpisodesTable();
        } catch (error) {
            notify({ type: 'error', title: 'No se pudieron cargar temporadas', message: error.message || 'Intenta nuevamente.' });
        } finally {
            hideLoader();
        }
    });

    episodeSeasonSelect?.addEventListener('change', async () => {
        const selectedSeriesId = episodeSeriesSelect?.value || '';
        const selectedSeasonId = episodeSeasonSelect.value || '';
        episodeSeasonId.value = selectedSeasonId;
        clearEpisodeForm();
        showLoader();
        try {
            await loadEpisodes(selectedSeriesId, selectedSeasonId);
        } catch (error) {
            notify({ type: 'error', title: 'No se pudieron cargar episodios', message: error.message || 'Intenta nuevamente.' });
        } finally {
            hideLoader();
        }
    });

    addEpisodeServerButton?.addEventListener('click', () => addEpisodeServerRow({ name: `Servidor ${episodeServerRows?.querySelectorAll('.admin-server-row').length + 1 || 1}` }));
    episodeForm?.addEventListener('submit', handleEpisodeSubmit);
    clearEpisodeFormButton?.addEventListener('click', clearEpisodeForm);
    episodesTable?.addEventListener('click', handleEpisodeTableAction);
    fetchSeriesTmdbDataButton?.addEventListener('click', handleAutoFillSeriesFromTmdb);
    seriesTmdbId?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAutoFillSeriesFromTmdb();
        }
    });
    seriesTmdbId?.addEventListener('change', () => {
        if (seriesTmdbId.value.trim()) {
            handleAutoFillSeriesFromTmdb();
        }
    });
    showLoader();
    try {
        await loadSeries();
        if (seasonSeriesSelect?.value) {
            await loadSeasons(seasonSeriesSelect.value);
        }
        if (episodeSeriesSelect?.value && episodeSeasonSelect?.value) {
            await loadEpisodes(episodeSeriesSelect.value, episodeSeasonSelect.value);
        }
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo inicializar el panel', message: error.message || 'Intenta nuevamente.' });
    } finally {
        hideLoader();
    }
};

bootstrap();
})();
