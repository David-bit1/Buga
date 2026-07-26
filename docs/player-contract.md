# Contrato del reproductor de Buga

## Adaptadores soportados

- `YouTubeAdapter`
- `Html5Adapter`
- `HlsAdapter`
- `IframeAdapter`

## Interfaz obligatoria

Todos los adaptadores deben exponer:

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

## Reglas de arquitectura

- `PlayerManager` es la única fuente de verdad para detectar servidor y elegir adaptador.
- La UI debe leer `capabilities` o `supports`, no asumir capacidades por tipo.
- `Html5Adapter` y `HlsAdapter` deben usar siempre `<video>`.
- `YouTubeAdapter` debe usar su propio contenedor dedicado.
- `IframeAdapter` y embeds externos no deben fingir timeline, seek ni volumen si el proveedor no lo soporta.
- `wireAdapterToUI()` solo debe mostrar controles que el adaptador realmente soporte.
- El adaptador anterior debe destruirse antes de montar uno nuevo.

## Matriz de capacidades

| Adaptador | controllable | seekable | volume | timeline | fullscreen | hls |
|---|---:|---:|---:|---:|---:|---:|
| `YouTubeAdapter` | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| `Html5Adapter` | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| `HlsAdapter` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `IframeAdapter` | ✘ | ✘ | ✘ | ✘ | ✔/✘ | ✘ |
| `Embed externo` | ✘ | ✘ | ✘ | ✘ | ✔/✘ | ✘ |

