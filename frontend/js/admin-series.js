const handleTableActions = async (event) => {
    const editSeries = event.target.closest('[data-edit-series]');
    const deleteSeries = event.target.closest('[data-delete-series]');
    const manageSeasons = event.target.closest('[data-manage-seasons]');

    const editSeason = event.target.closest('[data-edit-season]');
    const deleteSeason = event.target.closest('[data-delete-season]');
    const manageEpisodes = event.target.closest('[data-manage-episodes]');

    const editEpisode = event.target.closest('[data-edit-episode]');
    const deleteEpisode = event.target.closest('[data-delete-episode]');

    try {
        if (editSeries) {
            const series = seriesCache.find(s => String(s.id) === editSeries.dataset.editSeries);
            if (series) fillSeriesForm(series);
        }
        if (deleteSeries) {
            if (!confirm('¿Eliminar esta serie?')) return;
            await fetchJson(`${ADMIN_API}/series/${deleteSeries.dataset.deleteSeries}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Serie eliminada' });
            await loadSeries();
        }
        if (manageSeasons) {
            seasonSeriesSelect.value = manageSeasons.dataset.manageSeasons;
            await loadSeasons(manageSeasons.dataset.manageSeasons);
            showSection('seasons');
        }

        if (editSeason) {
            const season = seasonsCache.find(s => String(s.id) === editSeason.dataset.editSeason);
            if (season) fillSeasonForm(season);
        }
        if (deleteSeason) {
            if (!confirm('¿Eliminar esta temporada?')) return;
            await fetchJson(`${ADMIN_API}/series/${seasonSeriesId.value}/seasons/${deleteSeason.dataset.deleteSeason}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Temporada eliminada' });
            await loadSeasons(seasonSeriesId.value);
        }
        if (manageEpisodes) {
            episodeSeriesSelect.value = manageEpisodes.dataset.manageEpisodes;
            await loadEpisodes(manageEpisodes.dataset.manageEpisodes);
            showSection('episodes');
        }

        if (editEpisode) {
            const episode = episodesCache.find(e => String(e.id) === editEpisode.dataset.editEpisode);
            if (episode) fillEpisodeForm(episode);
        }
        if (deleteEpisode) {
            if (!confirm('¿Eliminar este episodio?')) return;
            await fetchJson(`${ADMIN_API}/series/${episodeSeasonId.value}/episodes/${deleteEpisode.dataset.deleteEpisode}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Episodio eliminado' });
            await loadEpisodes(episodeSeasonId.value);
        }
    } catch (error) {
        notify({ type: 'error', title: 'Error', message: error.message });
    }
};

const showSection = (sectionName) => {
    document.querySelectorAll('[data-admin-section]').forEach(section => {
        section.classList.toggle('is-active', section.dataset.adminSection === sectionName);
    });
    document.querySelectorAll('[data-admin-tab]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.adminTab === sectionName);
    });
};

const wireSeasonSeriesSelect = () => {
    if (!seasonSeriesSelect) return;
    seasonSeriesSelect.addEventListener('change', async () => {
        const seriesId = seasonSeriesSelect.value;
        if (seriesId) {
            await loadSeasons(seriesId);
        } else {
            seasonsCache = [];
            renderSeasonsTable();
        }
    });
};

const wireEpisodeSeriesSelect = () => {
    if (!episodeSeriesSelect) return;
    episodeSeriesSelect.addEventListener('change', async () => {
        const seriesId = episodeSeriesSelect.value;
        if (seriesId) {
            const data = await fetchJson(`${ADMIN_API}/series/${seriesId}/seasons`);
            seasonsCache = data.seasons || [];
            episodeSeasonSelect.innerHTML = '<option value="">Seleccionar temporada...</option>' +
                seasonsCache.map(s => `<option value="${s.id}">Temporada ${s.season_number}: ${escapeText(s.title || '')}</option>`).join('');
            episodeSeasonSelect.disabled = false;
        } else {
            episodeSeasonSelect.innerHTML = '<option value="">Primero selecciona una serie</option>';
            episodeSeasonSelect.disabled = true;
        }
    });
};

const wireEpisodeSeasonSelect = () => {
    if (!episodeSeasonSelect) return;
    episodeSeasonSelect.addEventListener('change', () => {
        if (episodeSeasonSelect.value) {
            loadEpisodes(episodeSeasonSelect.value);
        }
    });
};

const wireServerButtons = () => {
    if (addEpisodeServerButton) {
        addEpisodeServerButton.addEventListener('click', () => {
            addServerRow(episodeServerRows, { name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 });
        });
    }
    if (episodeServerRows) {
        episodeServerRows.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-server]');
            if (removeBtn) removeBtn.closest('.admin-server-row')?.remove();
        });
    }
};

const bootstrap = async () => {
    if (!requireAdmin()) return;

    document.querySelectorAll('[data-admin-tab]').forEach(button => {
        button.addEventListener('click', () => showSection(button.dataset.adminTab));
    });

    seriesForm?.addEventListener('submit', handleSeriesSubmit);
    seasonForm?.addEventListener('submit', handleSeasonSubmit);
    episodeForm?.addEventListener('submit', handleEpisodeSubmit);
    clearSeriesFormButton?.addEventListener('click', resetSeriesForm);
    clearSeasonFormButton?.addEventListener('click', resetSeasonForm);
    clearEpisodeFormButton?.addEventListener('click', resetEpisodeForm);

    seriesTable?.addEventListener('click', handleTableActions);
    seasonsTable?.addEventListener('click', handleTableActions);
    episodesTable?.addEventListener('click', handleTableActions);

    wireSeasonSeriesSelect();
    wireEpisodeSeriesSelect();
    wireEpisodeSeasonSelect();
    wireServerButtons();

    if (addEpisodeServerButton) {
        addEpisodeServerButton.addEventListener('click', () => {
            addServerRow(episodeServerRows, { name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 });
        });
    }

    resetSeriesForm();
    resetSeasonForm();
    resetEpisodeForm();
    await loadSeries();
};

document.addEventListener('DOMContentLoaded', bootstrap);
})();