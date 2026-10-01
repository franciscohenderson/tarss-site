# Tars 2.0 — Constitución de diseño: «Imprenta Riso»

La web es un **cartel de imprenta risográfica** pegado en una pared de Mendoza: tintas planas que se pisan, registro imperfecto, tipografía gigante como estructura. A eso se suma una **máquina registradora** (el cotizador) como pieza central táctil.

## Paleta (tintas reales de risografía)
| Token | Hex | Uso |
|---|---|---|
| `--paper` | `#F1ECE2` | Papel. Fondo del modo claro; texto del modo oscuro. |
| `--ink` | `#141414` | Tinta negra. Fondo del modo oscuro (por defecto); texto del modo claro. |
| `--pink` | `#FF48B0` | Rosa fluo. Capa de registro, acento principal, afiches. |
| `--blue` | `#0078BF` | Azul medio. Capa de registro y afiches. **Solo tamaños grandes** (3.9–4.0:1). |
| `--yellow` | `#FFE800` | Amarillo. Cinta, sellos, ticket. Siempre con tinta encima. |

Reglas de contraste: texto de lectura solo tinta↔papel, tinta sobre rosa (6:1) o tinta sobre amarillo (14.7:1). El azul nunca lleva texto chico ni va como texto chico.
Mezcla de capas: `multiply` sobre papel, `screen` sobre tinta (así se comporta la tinta riso real sobre papel claro u oscuro).

## Tipografía
- **Big Shoulders Display** (variable 100–900): títulos, palabras-afiche, precios. Mayúsculas, condensada, gigante, a sangre. Interlineado 0.82–0.9.
- **Libre Franklin** (variable): texto, botones, formularios. 1rem–1.25rem, interlineado 1.55, medida 60–68ch.
- Números del ticket: Libre Franklin con `tabular-nums` (es dato real, no disfraz).

## Estructura
- **Margen de impresión**: menú vertical fijo a la izquierda (escritorio) con marcas de registro; en celular, tira superior + menú a pantalla completa.
- **Grilla rota**: títulos que se salen del contenedor, sellos rotados en los márgenes, bloques que se pisan. Nada de filas de tarjetas iguales.
- **Afiches**: cada servicio es una hoja a pantalla completa que se fija (`sticky`) y la siguiente la tapa al scrollear.
- **Ticket**: el cotizador es una registradora; el ticket queda fijo mientras se arma el presupuesto y un talón flotante lo recuerda al alejarse.

## Movimiento
- Firma: **desregistro riso**. Las capas rosa y azul se separan siguiendo el cursor (en celular, la velocidad del scroll) con física de resorte y vuelven a registrar.
- Teclas y botones con resorte (rebote corto); botones magnéticos solo con mouse.
- Contador del ticket con dígitos que giran (curva de resorte `linear()`), escalonados de derecha a izquierda.
- Sin animaciones infinitas decorativas. Con «reducir movimiento»: capas quietas con un desregistro fijo de 3px, dígitos sin giro.

## Prohibido en este mundo
Degradados en texto, halos de color, glassmorphism, tarjetas iguales en fila, emojis como íconos, etiquetas sobre los títulos, sombras suaves genéricas. Sí se permite la sombra dura desplazada **solo** en teclas de la registradora (es la profundidad física de la tecla).
