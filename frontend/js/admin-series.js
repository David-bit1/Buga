const createServerRowHTML = (server = {}) => {
    const { name = '', type = 'iframe', url = '', status = 'active', order = 0 } = server;
    return `
        <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="${escapeText(name)}"></label>
        <label><span>Tipo</span><select class="server-type">
            <option value="iframe" ${type === 'iframe' ? 'selected' : ''}>iframe</option>
            <option value="embed" ${type === 'embed' ? 'selected' : ''}>embed</option>
            <option value="m3u8" ${type === 'm3u8' ? 'selected' : ''}>m3u8</option>
            <option value="mp4" ${type === 'mp4' ? 'selected' : ''}>mp4</option>
        </select></label>
        <label><span>Enlace/Código</span><input type="text" class="server-url" placeholder="https://... o código iframe" value="${escapeText(url)}"></label>
        <label><span>Estado</span><select class="server-status">
            <option value="active" ${status === 'active' ? 'selected' : ''}>Activo</option>
            <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactivo</option>
        </select></label>
        <label><span>Orden</span><input type="number" class="server-order" value="${order}" min="0"></label>
        <button class="admin-secondary" type="button" data-remove-server>Eliminar</button>
    `;
};

const addServerRow = (container, server = {}) => {
    const row = document.createElement('div');
    row.className = 'admin-server-row';
    row.innerHTML = createServerRowHTML(server);
    row.querySelector('[data-remove-server]').addEventListener('click', () => row.remove());
    container.appendChild(row);
};

const getServerRows = (container) => {
    if (!container) return [];
    return Array.from(container.querySelectorAll('.admin-server-row'))
        .map((row) => ({
            name: row.querySelector('.server-name')?.value?.trim() || '',
            type: row.querySelector('.server-type')?.value || 'iframe',
            url: row.querySelector('.server-url')?.value?.trim() || '',
            status: row.querySelector('.server-status')?.value || 'active',
            order: parseInt(row.querySelector('.server-order')?.value) || 0
        }))
        .filter((server) => server.name && server.url);
};

const resetSeriesForm = () => {
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

const resetSeasonForm = () => {
    seasonId.value = '';
    seasonSeriesId.value = '';
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

const resetEpisodeForm = () => {
    episodeId.value = '';
    episodeSeasonId.value = '';
    episodeNumber.value = '';
    episodeTitle.value = '';
    episodeDescription.value = '';
    episodeOverview.value = '';
    episodeThumbnailUrl.value = '';
    episodeRuntime.value = '';
    episodeReleaseDate.value = '';
    episodeTmdbId.value = '';
    episodeStatus.value = 'published';
    episodeServerRows.innerHTML = '';
    addServerRow(episodeServerRows, { name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 });
    episodeSubmit.textContent = 'Guardar episodio';
};