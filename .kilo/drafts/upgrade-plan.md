// NOMBRE DEL PROYECTO (Buga)
1. NOMBRE PRINCIPAL DEL PROYECTO
2. NUEVA DESCRIPCIÓN DE LA PLATAFORMA
3. ACTUALIZACIÓN DE TODOS LOS ARCHIVOS PARA REFLEJAR EL NUEVO NOMBRE
4. LISTADO DE ACTUALIZACIONES REALIZADAS

1. EL NOMBRE PRINCIPAL DEL PROYECTO QUE SE MANTIENE ES: Buga

2. NUEVA DESCRIPCIÓN DE LA PLATAFORMA
La plataforma Buga es una solución integral para la administración de contenido multimedia con enfasis en películas y series. Permite la gestión de catálogos, control de fuentes de reproducción, favoritos, y organizaciones de videoclub. Incluye interfaz de administración para gestionar servidores y contenido, con autenticación y almacenamiento seguro de datos.

3. ACTUALIZACIÓN DE TODOS LOS ARCHIVOS PARA REFLEJAR EL NUEVO NOMBRE
TODOS LOS ARCHIVOS QUE MUESTRAN REFERENCIAS AL NOMBRE ANTERIOR (UltraPelis) HAN SIDO MODIFICADOS PARA REFIRIRSE CORRECTAMENTE A BUGA EN LA CONFIGURACIÓN DE LA PLATAFORMA.

4. LISTADO DE ACTUALIZACIONES REALIZADAS
- Código de configuración en ./frontend/js/shared.js
  - NUEVAS CHAVES DE ALMACENAMIENTO:
  - AUTH: 'Buga-auth'
  - ACTIVE_PROFILE: 'Buga-active-profile'
  - TOAST_FLASH: 'Buga-toast-flash'
  - FAVORITES: 'Buga-favorites'
  - WATCH_HISTORY: 'Buga-watch-history'
- NOMBRES DE API:
  - /api/auth -> /api/auth
  - /api/recommendations -> /api/recommendations
  - /api/profiles -> /api/profiles
  - /api/movies -> /api/movies
  - /api/admin -> /api/admin
- Código de almacenamiento en localStorage
  - Se han modificado todas las llaves relacionadas con UltraPelis
- NUEVOS NOMBRES EN ARCHIVOS CLAVE:
  - ./frontend/js/upload-movie.js
  - ./frontend/js/admin.js
  - ./backend/controllers/adminController.js
  - ../kilo/plans/1784060673973-crisp-canyon.md
- DOM ELEMENTOS
  - Todos los elementos HTML con clase 'ultrapelis' cambiados a 'buga'