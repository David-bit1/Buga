function resetMovieForm() {
    // Clear form fields
    movieIdInput.value = '';
    movieTmdbId.value = '';
    movieTitle.value = '';
    movieOriginalTitle.value = '';
    movieDescription.value = '';
    movieGenres.value = '';
    movieYear.value = '';
    movieDuration.value = '';
    movieCountry.value = '';
    movieLanguage.value = '';
    movieRating.value = '';
    movieCast.value = '';
    movieDirector.value = '';
    movieTrailer.value = '';
    movieOverview.value = '';
    movieReleaseDate.value = '';
    moviePopularity.value = '';
    moviePosterUrl.value = '';
    movieBannerUrl.value = '';
    movieFeatured.checked = false;
    // Reset server rows
    resetServerRows([{ name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 }]);
    formTitle.textContent = 'Nueva película';
    movieSubmit.textContent = 'Guardar película';
}

const addMovieBtn = document.getElementById('addMovieBtn');
if (addMovieBtn) {
    addMovieBtn.addEventListener('click', resetMovieForm);
}

const addServerButton = document.getElementById('addServerButton');
if (addServerButton) {
    addServerButton.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'admin-server-row';
        row.innerHTML = `
            <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="Servidor 1"></label>
            <label><span>Tipo</span><select class="server-type">
                <option value="iframe">iframe</option>
                <option value="embed">embed</option>
                <option value="m3u8">m3u8</option>
                <option value="mp4">mp4</option>
            </select></label>
            <label><span>Enlace/Código</span><input type="text" class="server-url" placeholder="https://... o código iframe"></label>
            <label><span>Estado</span><select class="server-status">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
            </select></label>
            <label><span>Orden</span><input type="number" class="server-order" value="0" min="0"></label>
            <button class="admin-secondary" type="button">Eliminar</button>
        `;
        
        // Add remove button functionality
        const removeBtn = row.querySelector('.admin-secondary');
        removeBtn.addEventListener('click', () => {
            row.remove();
            // Ensure at least one server row remains
            if (serverRows.querySelectorAll('.admin-server-row').length === 0) {
                addServerButton.click();
            }
        });
        
        serverRows.appendChild(row);
    });
}

const bootstrap = async () => {
    if (!requireAdmin()) {
        return;
    }

    setActiveSection('dashboard');

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
        button.addEventListener('click', () => setActiveSection(button.dataset.adminTab));
    });

    adminRefresh?.addEventListener('click', refreshAll);
    adminLogout?.addEventListener('click', () => {
        window.BugaAuth?.clearAuthSession?.();
        window.BugaAuth?.clearActiveProfile?.();
        window.location.href = '/pages/login.html';
    });

    movieForm?.addEventListener('submit', handleMovieSubmit);
    genreForm?.addEventListener('submit', handleGenreSubmit);
    settingsForm?.addEventListener('submit', handleSettingsSubmit);
    clearMovieFormButton?.addEventListener('click', resetMovieForm);
    clearGenreFormButton?.addEventListener('click', resetGenreForm);

    movieTable?.addEventListener('click', handleTableActions);
    usersTable?.addEventListener('click', handleTableActions);
    genresTable?.addEventListener('click', handleTableActions);

    resetMovieForm();
    resetGenreForm();
    await refreshAll();
};

document.addEventListener('DOMContentLoaded', bootstrap);