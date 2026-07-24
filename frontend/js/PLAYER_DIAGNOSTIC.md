# Diagnóstico Completo del Reproductor Buga

Este documento detalla la arquitectura, el flujo de datos y los componentes del sistema de reproducción de video de Buga.

## 1. Archivos Involucrados

La lógica del reproductor está principalmente contenida en un único archivo, que define todas las clases y funciones necesarias.

-   **/home/david/Documentos/Buga/frontend/js/movie.js**: Contiene la lógica de carga de la película, la gestión de la UI, y la arquitectura completa de adaptadores del reproductor (`PlayerManager`, `Html5PlayerAdapter`, `YouTubePlayerAdapter`, `IframePlayerAdapter`).
-   **/home/david/Documentos/Buga/frontend/js/shared.js**: Provee funciones y constantes compartidas, como `normalizeMovie`.

## 2. Flujo de Ejecución Principal

El proceso desde que se carga la página de la película hasta que se reproduce el video sigue este flujo:

1.  **`bootstrap()`** (async):
    -   Función principal que se ejecuta al cargar la página.
    -   Llama a `fetchLocalMovie()` para obtener los datos de la película desde el backend de Buga.
    -   Si no la encuentra, intenta un fallback a `fetchMovieFromTMDB()`.
    -   Llama a `applyMovie()` para renderizar la información de la película (póster, título, etc.).
    -   Llama a `populateServerSelect()` para llenar el selector de servidores.
    -   Llama a **`setVideoSource(0)`** para iniciar la carga del primer servidor.

2.  **`setVideoSource(serverIndex)`** (async):
    -   Obtiene el objeto `server` del array de servidores de la película.
    -   Muestra el loader del reproductor (`showPlayerLoader()`).
    -   Llama a **`PlayerManager.create(server)`** y espera el resultado.
    -   Recibe una instancia del `adapter` correspondiente.
    -   Llama a **`wireAdapterToUI(adapter)`** para conectar los eventos del adaptador con la UI.

3.  **`PlayerManager.create(server)`** (async):
    -   **Punto central de la lógica del reproductor.**
    -   Limpia cualquier instancia de reproductor anterior (`activePlayerAdapter.destroy()`).
    -   Llama a **`PlayerManager.detectServerType(server.url)`** para determinar el tipo de contenido.
    -   Usa un `switch` para decidir qué adaptador crear:
        -   `youtube` -> `YouTubePlayerAdapter`
        -   `hls` -> `Html5PlayerAdapter`
        -   `mp4` -> `Html5PlayerAdapter`
        -   `iframe` -> `IframePlayerAdapter`
    -   Gestiona la visibilidad de los contenedores HTML (`#movieVideo` y `#externalPlayer`).
    -   Retorna una `Promise` que resuelve con la instancia del adaptador creado.

4.  **Creación del Adaptador** (ej. `YouTubePlayerAdapter.create()`):
    -   Cada adaptador tiene un método estático `create()` si su inicialización es asíncrona (como YouTube, que necesita que su API esté lista).
    -   El constructor del adaptador recibe el elemento HTML donde debe renderizarse.
    -   Retorna una `Promise` que resuelve con la instancia del adaptador una vez que el reproductor subyacente está listo (ej. en el evento `onReady` de YouTube).

5.  **`wireAdapterToUI(adapter)`**:
    -   Recibe la instancia del adaptador ya lista.
    -   Inicia el bucle de actualización de la UI (`uiUpdateInterval = setInterval(...)`).
    -   Registra los listeners para los eventos del adaptador (`play`, `pause`, `timeupdate`, `ended`, etc.).
    -   Las funciones que actualizan la UI (`updatePlayerChrome`, `updateProgressChrome`) se llaman desde el bucle y desde estos eventos.

## 3. Detección del Tipo de Servidor

La detección se centraliza en `PlayerManager.detectServerType(url, declaredType)`.

-   **Lógica:**
    1.  Verifica si la URL es de YouTube usando `PlayerManager.parseYoutubeId(url)`.
    2.  Si no, verifica si la URL termina en `.m3u8`.
    3.  Si no, verifica si la URL termina en `.mp4`.
    4.  Si no coincide con nada, asume que es un `iframe`.
-   **Propiedad Utilizada:** `server.url`. El campo `server.type` de la base de datos se usa como un respaldo secundario.

## 4. Adaptadores y Elementos HTML

| Tipo Detectado | Adaptador Utilizado | Elemento HTML Creado/Utilizado |
| :--- | :--- | :--- |
| `youtube` | `YouTubePlayerAdapter` | Reemplaza `<div id="externalPlayer">` con un `<iframe>` generado por la API de YouTube. |
| `iframe` | `IframePlayerAdapter` | Utiliza el elemento `<iframe id="externalPlayer">` y le asigna el `src`. |
| `mp4` | `Html5PlayerAdapter` | Utiliza el elemento `<video id="movieVideo">` y le asigna el `src`. |
| `hls` | `Html5PlayerAdapter` | Utiliza el elemento `<video id="movieVideo">` y lo controla con `Hls.js`. |

## 5. Gestión de Eventos

-   **`Html5PlayerAdapter`**: Escucha directamente los eventos nativos del elemento `<video>` (`play`, `pause`, `timeupdate`, `volumechange`, `ended`, etc.).
-   **`YouTubePlayerAdapter`**: Escucha los eventos de la API de YouTube (`onStateChange`, `onError`) y los traduce a eventos estándar (`play`, `pause`, `ended`). **Importante:** No emite `timeupdate`, por lo que la UI **debe** usar un bucle (`setInterval`) para sondear `getCurrentTime()`.
-   **`IframePlayerAdapter`**: Es una "caja negra". No emite eventos de reproducción. La UI no puede sincronizarse con él.
-   **`movie.js`**: El archivo principal se suscribe a los eventos emitidos por el adaptador activo (`adapter.on(...)`) para actualizar la interfaz.

## 6. Lógica Asíncrona y Promises

-   **`bootstrap()`**: `async`, espera a que la información de la película y el primer reproductor se carguen.
-   **`setVideoSource()`**: `async`, espera a que `PlayerManager.create()` resuelva.
-   **`PlayerManager.create()`**: `async`, espera a que el adaptador específico (ej. `YouTubePlayerAdapter.create`) resuelva.
-   **`YouTubePlayerAdapter.create()`**: `async`, retorna una `Promise` que resuelve en el callback `onReady` de la API de YouTube.
-   **`PlayerManager.loadYoutubeApi()`**: Retorna una `Promise` que resuelve cuando el script de la API de YouTube ha cargado.

## 7. Funciones y Código Obsoleto o Duplicado

-   **Funciones nunca llamadas:**
    -   `showExternalPlayer()` y `hideExternalPlayer()`: Su lógica fue absorbida y centralizada dentro de `PlayerManager.create()`, que ahora gestiona la visibilidad de los contenedores.
-   **Código Duplicado:**
    -   La lógica para mostrar/ocultar los contenedores (`#movieVideo`, `#externalPlayer`) estaba dispersa y ahora está unificada dentro del `switch` de `PlayerManager.create()`.
    -   La creación del bucle de actualización de la UI (`setInterval`) estaba duplicada o era inconsistente. Ahora se gestiona de forma centralizada en `wireAdapterToUI`.
-   **Funciones que quedaron obsoletas:**
    -   El `setInterval` que existía dentro de `YouTubePlayerAdapter` para simular `timeupdate` fue eliminado. Esta responsabilidad ahora recae correctamente en la capa de la UI (`movie.js`), que es la que necesita las actualizaciones.

## 8. Resumen de la Arquitectura Actual

La arquitectura se basa en el **Patrón Adaptador** para abstraer las diferentes tecnologías de reproducción de video.

```mermaid
graph TD
    subgraph UI Layer (movie.js)
        A[bootstrap] --> B(setVideoSource);
        B --> C{PlayerManager.create};
        F[wireAdapterToUI] --> G(Inicia Bucle UI);
        G --> H{Actualiza Controles};
    end

    subgraph Player Abstraction Layer (movie.js)
        C --> D{detectServerType};
        D --> E_YT[YouTubePlayerAdapter];
        D --> E_H5[Html5PlayerAdapter];
        D --> E_IF[IframePlayerAdapter];
        E_YT --> F;
        E_H5 --> F;
        E_IF --> F;
    end

    subgraph Player Implementation
        E_YT --> P_YT(YT.Player API);
        E_H5 --> P_H5(HTMLVideoElement);
        E_IF --> P_IF(HTMLIFrameElement);
    end

    style F fill:#cde,stroke:#333,stroke-width:2px
    style G fill:#cde,stroke:#333,stroke-width:2px
    style C fill:#cde,stroke:#333,stroke-width:2px
```

Esta estructura es robusta porque:
1.  **Desacopla la UI de la implementación del reproductor:** La UI solo habla con la interfaz del `PlayerAdapter`.
2.  **Centraliza la lógica de creación:** `PlayerManager.create` es el único punto de entrada para crear cualquier tipo de reproductor.
3.  **Centraliza la detección de formato:** `PlayerManager.detectServerType` es la única fuente de verdad para decidir qué tipo de servidor se está usando.
4.  **Centraliza la actualización de la UI:** El `setInterval` en `wireAdapterToUI` asegura una sincronización constante y predecible.