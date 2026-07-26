# Diagnóstico del reproductor Buga

## Flujo actual

1. `movie.js` carga la película desde `/api/movies/:id` y normaliza los datos con `BugaShared.normalizeMovie`.
2. `populateServerSelect()` muestra cada servidor usando `PlayerManager.detectServerType(server)`.
3. `setVideoSource()` llama a `window.BugaPlayerManager.create(server, context)`.
4. `PlayerManager` normaliza la URL, detecta el tipo real y resuelve un adaptador registrado.
5. El adaptador emite eventos estándar y `movie.js` sincroniza la UI.

## Archivos clave

- `frontend/js/player/PlayerBase.js`: base común de eventos e ինտերfaz mínima.
- `frontend/js/player/PlayerManager.js`: registro, detección y ciclo de vida.
- `frontend/js/player/adapters/Html5Adapter.js`: MP4, WebM, MOV.
- `frontend/js/player/adapters/HlsAdapter.js`: `.m3u8` con `Hls.js`.
- `frontend/js/player/adapters/YouTubeAdapter.js`: YouTube y variantes.
- `frontend/js/player/adapters/IframeAdapter.js`: iframe, embed y hosts externos.
- `frontend/js/movie.js`: UI, navegación, selección de servidor y sincronización visual.

## Contrato

Todos los adaptadores exponen:

- `play()`
- `pause()`
- `mute()`
- `unmute()`
- `setVolume()`
- `seek()`
- `getCurrentTime()`
- `getDuration()`
- `destroy()`
- `on()`
- `off()`

## Detección

`PlayerManager` no depende solo de `server.type`.

- YouTube: `youtube.com`, `youtu.be`, `youtube-nocookie`
- HLS: `.m3u8` o tipo declarado `m3u8`/`hls`
- Video directo: `.mp4`, `.webm`, `.mov`
- iframe/embed: código HTML o hosts externos como `streamwish`, `voe`, `vidlink`, `filemoon`

## UI

- `movie.js` usa `playerState` para play/pause y volumen.
- Los controles solo se muestran para reproductores controlables.
- El loader se oculta con eventos `loadedmetadata`, `canplay`, `playing` o `error`.

## Extensión

Para agregar un nuevo proveedor:

1. Crear un adaptador nuevo en `frontend/js/player/adapters/`.
2. Registrar el adaptador con `PlayerManager.registerAdapter(...)`.
3. Definir `match()` y `create()` sin tocar la UI principal.
