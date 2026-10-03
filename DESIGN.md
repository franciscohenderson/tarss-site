# Tars — Constitución de diseño (2026-10)

Reemplaza a «Imprenta Riso». La web es **oscura, precisa y táctil**: profundidad con capas y bordes finísimos (Linear), materiales y respuesta al toque (Apple / iOS), un solo acento rosa. La personalidad la ponen la tipografía condensada gigante y las fotos de rubros, no la decoración.

## Paleta
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#09090b` (zinc-950) | Fondo. Nunca negro puro. |
| `--bg2` | `#141417` | Superficies (mosaicos, tarjetas). |
| `--fg` | `#f3efe7` | Texto principal (blanco cálido, no `#fff`). |
| `--muted` | `#a7a29a` | Texto secundario (≥ 7:1 sobre `--bg`). |
| `--pink` | `#ff48b0` | **Único acento**: CTA, foco, estados activos, precios destacados. |
| `--line` | `rgb(255 255 255 / 0.07)` | Bordes y separadores (hairline 1 px). |
| `--glass` | `rgb(255 255 255 / 0.045)` + blur | Vidrio: solo chat del asistente y calculadora. |

## Tipografía
- **Big Shoulders Display** (900): títulos, mayúsculas, tracking −0.01 em, interlineado 0.88–0.95.
- **Libre Franklin**: todo lo demás. Cuerpo 16–20 px, interlineado 1.5. Títulos de tarjeta con tracking −0.03 em.
- Siempre con respaldo (`'Arial Narrow'`, `system-ui`): con `font-display: optional` a veces no llegan.

## Superficies y profundidad
- Tarjeta: `--bg2`, radio 20–26 px, borde `--line`, brillo superior `inset 0 1px 0 rgb(255 255 255 / .06)`.
- Vidrio (iOS): fondo `--glass`, `backdrop-filter: blur(18px) saturate(160%)`, borde `--line`, brillo superior. Necesita color detrás (resplandores suaves rosa/verde), si no, no se nota. Nunca vidrio dentro de vidrio.
- Separación entre secciones: filete `--line`, mucho aire.

## Movimiento
- Curvas: `--ease-out cubic-bezier(.23,1,.32,1)`; resortes con `linear()` para lo táctil.
- Micro: 120–250 ms. Entradas: ≤ 500 ms. Nada lineal ni `ease-in-out` genérico.
- Toque: `:active { scale: .97 }` en botones, teclas y opciones.
- Siempre respetar `prefers-reduced-motion`.

## Reglas
- Un solo acento (rosa). El verde solo para los mensajes de WhatsApp.
- Texto sobre vidrio o foto: contraste AA verificado.
- Sin librerías de animación: CSS + Web Animations API alcanzan (0 KB).
