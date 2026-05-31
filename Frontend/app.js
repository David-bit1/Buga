const API_KEY = "b24af203b14e23f8c91844baae37cfab";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";
const API_URL = `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=es-ES&page=1`;

const moviesGrid = document.getElementById("moviesGrid");

const createMovieCard = (movie) => {
    const poster = movie.poster_path
        ? `${IMAGE_BASE_URL}${movie.poster_path}`
        : "https://via.placeholder.com/342x513?text=No+Poster";

    const overview = movie.overview
        ? movie.overview.length > 120
            ? movie.overview.slice(0, 120).trim() + "..."
            : movie.overview
        : "Descripción no disponible.";

    return `
        <article class="movie-card">
            <img class="movie-poster" src="${poster}" alt="Poster de ${movie.title}">
            <div class="movie-card-body">
                <h3>${movie.title}</h3>
                <p>${overview}</p>
            </div>
        </article>
    `;
};

const renderMovies = (movies) => {
    if (!movies.length) {
        moviesGrid.innerHTML = '<p class="movie-error">No se encontraron películas.</p>';
        return;
    }

    moviesGrid.innerHTML = movies
        .map((movie) => createMovieCard(movie))
        .join("");
};

const loadMovies = async () => {
    if (!API_KEY || API_KEY === "TU_API_KEY_AQUI") {
        moviesGrid.innerHTML = '<p class="movie-error">Agrega tu API key de TMDB en app.js para cargar las películas.</p>';
        return;
    }

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.status_message || "Error al cargar películas.");
        }

        renderMovies(data.results || []);
    } catch (error) {
        moviesGrid.innerHTML = `<p class="movie-error">Error: ${error.message}</p>`;
    }
};

loadMovies();
