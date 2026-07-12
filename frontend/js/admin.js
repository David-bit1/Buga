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