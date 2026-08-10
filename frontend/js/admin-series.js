const fillSeriesForm = (series) => {
    seriesId.value = series.id;
    seriesTmdbId.value = series.tmdbId || '';
    seriesTitle.value = series.title || '';
    seriesOriginalTitle.value = series.original_title || '';
    seriesOverview.value = series.overview || '';
    seriesDescription.value = series.description || '';
    seriesPosterUrl.value = series.poster_url || '';
    seriesBannerUrl.value = series.banner_url || '';
    seriesPosterSrcset.value = series.poster_srcset || '';
    seriesBannerSrcset.value = series.banner_srcset || '';
    seriesReleaseYear.value = series.release_year || '';
    seriesFirstAirDate.value = series.first_air_date || '';
    seriesGenres.value = Array.isArray(series.genres) ? series.genres.map(g => g.name || g).join(', ') : '';
    seriesRating.value = series.rating || '';
    seriesCast.value = Array.isArray(series.cast) ? series.cast.join(', ') : '';
    seriesCreator.value = series.creator || '';
    seriesTrailer.value = series.trailer || '';
    seriesPopularity.value = series.popularity || '';
    seriesStatus.value = series.status || 'published';
    seriesContentType.value = series.content_type || 'independent';
    seriesCreatorName.value = series.creator_name || '';
    seriesRightsHolder.value = series.rights_holder || '';
    seriesLicenseInfo.value = series.license_info || '';
    seriesSourceUrl.value = series.source_url || '';
    seriesSubmit.textContent = seriesId.value ? 'Actualizar serie' : 'Guardar serie';
};

const fillSeasonForm = (season) => {
    seasonId.value = season.id;
    seasonSeriesId.value = season.series_id;
    seasonNumber.value = season.season_number || '';
    seasonTitle.value = season.title || '';
    seasonDescription.value = season.description || '';
    seasonOverview.value = season.overview || '';
    seasonPosterUrl.value = season.poster_url || '';
    seasonBannerUrl.value = season.banner_url || '';
    seasonReleaseDate.value = season.release_date || '';
    seasonTmdbId.value = season.tmdb_id || '';
    seasonStatus.value = season.status || 'published';
    seasonSubmit.textContent = seasonId.value ? 'Actualizar temporada' : 'Guardar temporada';
};

const fillEpisodeForm = (episode) => {
    episodeId.value = episode.id;
    episodeSeasonId.value = episode.season_id;
    episodeNumber.value = episode.episode_number || '';
    episodeTitle.value = episode.title || '';
    episodeDescription.value = episode.description || '';
    episodeOverview.value = episode.overview || '';
    episodeThumbnailUrl.value = episode.thumbnail_url || '';
    episodeRuntime.value = episode.runtime || '';
    episodeReleaseDate.value = episode.release_date || '';
    episodeTmdbId.value = episode.tmdb_id || '';
    episodeStatus.value = episode.status || 'published';
    episodeServerRows.innerHTML = '';
    if (Array.isArray(episode.servers) && episode.servers.length > 0) {
        episode.servers.forEach(s => addServerRow(episodeServerRows, s));
    } else {
        addServerRow(episodeServerRows, { name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 });
    }
    episodeSubmit.textContent = episodeId.value ? 'Actualizar episodio' : 'Guardar episodio';
};

const loadSeries = async () => {
    showLoader();
    try {
        const data = await fetchJson(`${ADMIN_API}/series`);
        seriesCache = data.series || [];
        renderSeriesTable();
        updateSeriesSelects();
    } catch (error) {
        notify({ type: 'error', title: 'Error', message: error.message });
    } finally {
        hideLoader();
    }
};

const renderSeriesTable = () => {
    if (!seriesTable) return;
    seriesTable.innerHTML = seriesCache.map((series) => `
        <tr>
            <td><strong>${escapeText(series.title)}</strong></td>
            <td>${escapeText(series.tmdbId || '')}</td>
            <td>${escapeText(series.release_year || '')}</td>
            <td><span class="admin-pill ${series.status}">${escapeText(series.status)}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-secondary" type="button" data-edit-series="${series.id}">Editar</button>
                    <button class="admin-secondary" type="button" data-delete-series="${series.id}">Eliminar</button>
                    <button class="admin-secondary" type="button" data-manage-seasons="${series.id}">Temporadas</button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5">No hay series.</td></tr>';
};

const updateSeriesSelects = () => {
    const selects = [seasonSeriesSelect, episodeSeriesSelect];
    selects.forEach(select => {
        if (select) {
            const current = select.value;
            select.innerHTML = '<option value="">Seleccionar serie...</option>' +
                seriesCache.map(s => `<option value="${s.id}">${escapeText(s.title)}</option>`).join('');
            select.value = current;
        }
    };
};

const loadSeasons = async (seriesId) => {
    showLoader();
    try {
        const data = await fetchJson(`${ADMIN_API}/series/${seriesId}/seasons`);
        seasonsCache = data.seasons || [];
        renderSeasonsTable();
    } catch (error) {
        notify({ type: 'error', title: 'Error', message: error.message });
    } finally {
        hideLoader();
    }
};

const renderSeasonsTable = () => {
    if (!seasonsTable) return;
    seasonsTable.innerHTML = seasonsCache.map((season) => `
        <tr>
            <td>${escapeText(season.series_id)}</td>
            <td>${season.season_number}</td>
            <td>${escapeText(season.title || '')}</td>
            <td><span class="admin-pill ${season.status}">${escapeText(season.status)}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-secondary" type="button" data-edit-season="${season.id}">Editar</button>
                    <button class="admin-secondary" type="button" data-delete-season="${season.id}">Eliminar</button>
                    <button class="admin-secondary" type="button" data-manage-episodes="${season.id}">Episodios</button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5">No hay temporadas.</td></tr>';
};

const loadEpisodes = async (seasonId) => {
    showLoader();
    try {
        const data = await fetchJson(`${ADMIN_API}/series/${seasonId}/episodes`);
        episodesCache = data.episodes || [];
        renderEpisodesTable();
    } catch (error) {
        notify({ type: 'error', title: 'Error', message: error.message });
    } finally {
        hideLoader();
    }
};

const renderEpisodesTable = () => {
    if (!episodesTable) return;
    episodesTable.innerHTML = episodesCache.map((ep) => `
        <tr>
            <td>${ep.series_id || ''}</td>
            <td>${ep.season_id || ''}</td>
            <td>${ep.episode_number}</td>
            <td>${escapeText(ep.title)}</td>
            <td><span class="admin-pill ${ep.status}">${escapeText(ep.status)}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-secondary" type="button" data-edit-episode="${ep.id}">Editar</button>
                    <button class="admin-secondary" type="button" data-delete-episode="${ep.id}">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6">No hay episodios.</td></tr>';
};