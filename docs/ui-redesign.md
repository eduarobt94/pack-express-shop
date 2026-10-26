# Rediseño UI/UX — Optimus Envíos

Objetivo: que la tienda se sienta como un sitio premium, sobrio y seguro, **sin tocar** logo, paleta de marca, tipografías, tono, estructura de contenidos ni funcionalidades.

## 1. Diagnóstico (estado previo)

Lo que restaba sensación premium, observado en el código y las pantallas:

| Área | Problema |
|---|---|
| Color | El rojo `#E31E24` se usaba como relleno tintado (`/[0.10]`, `/[0.12]`) en tarjetas, badges, tabs, íconos y estados de selección. Demasiado rojo repartido; la marca dejaba de ser acento. |
| Tipografía | Títulos de 24–36 px con poca jerarquía; muchos textos de 11–12 px en mayúsculas con tracking alto; la bajada (Montserrat 300 itálica) del manual casi no se usaba. |
| Espaciado | Secciones de 32–56 px, tarjetas apretadas (`p-4`/`p-5`), grillas de `gap-4`. Poco aire; sensación de panel, no de editorial. |
| Layout | Encabezado en dos niveles (barra + barra de categorías), héroe compacto, bloques simétricos y repetidos con el mismo peso visual. |
| Componentes | Radios 16–24 px (`rounded-2xl`), brillos/sombras de color, íconos con caja tintada, tabs "pastilla". |
| Imagen | Visuales de producto genéricos con degradado; sin fotografía editorial disponible. |
| Accesibilidad | Contraste insuficiente en texto de marca sobre fondos claros (16 de 18 combinaciones página/tema fallaban en axe), controles sin nombre accesible, desbordes a 320 px. |

## 2. Propuesta

Principios: **contención** (el rojo solo señala), **aire** (escala de 8 px, secciones de 96–160 px), **jerarquía tipográfica clara**, **bordes finos** en lugar de rellenos, **movimiento discreto** (fundidos de 0,5–0,9 s, un solo gesto de hover).

- **Inicio**: héroe a pantalla con titular grande ("Comprás en EE.UU. / Tu familia recibe en Cuba."), composición con el isotipo y patrón diagonal ≤ 12 % de opacidad, tres datos clave en una línea. Siguen: categorías como lista tipográfica, tiendas, productos (grilla 4:5), bloque de costos con el ejemplo oficial (USD 100 + 5 kg → USD 65), beneficios en 4 columnas y banda final oscura.
- **Navegación**: una sola barra de 72/80 px, enlaces mínimos, búsqueda que se despliega, menú móvil de tipografía grande.
- **Producto**: imagen cuadrada protagonista, miga de pan discreta, precio grande con `tabular-nums`, especificaciones como lista de líneas finas, "Qué pagás y a quién" en lenguaje claro.
- **Catálogo**: encabezado de página, filtros como lista simple (sin cajas), búsqueda con línea inferior, grilla con `gap-y-12`.
- **Cómo comprar / Tarifas / Contacto**: lista numerada de dos columnas, tabla de costos en `dl`, FAQ con `details` y signo "+" que rota.
- **Cuenta y Casillero**: tabs subrayadas (en vez de pastillas), tarjetas con borde fino, estados como punto + texto, selección con borde de tinta.
- **404 / Seguimiento**: mismo `PageHeader`; el seguimiento usa un campo con línea inferior.

## 3. Guía de estilo resumida

**Tipografías** (replicadas del sitio oficial optimusenvios.uy, medidas con sus estilos computados): Space Grotesk 700 para títulos y cifras (interletrado −0,02 em, interlineado 1,04 / 1,15 / 1,25 en h1 / h2 / h3), Inter 400/500/600 para texto, botones, enlaces y etiquetas. Sin cursivas. Botones en Inter 600 en minúsculas (14–16 px); etiquetas (`.eyebrow`) en Inter 600, mayúsculas, 0,06 em.

**Escala**

| Rol | Clase | Tamaño | Notas |
|---|---|---|---|
| Display | `.display` | fluido hasta ~5,25 rem | Space Grotesk 700, tracking −0,025 em |
| Título de sección | `.title-xl` / `.title-lg` | 1,875–3 rem / 1,375–1,75 rem | Space Grotesk 700 |
| Bajada | `.lead` | 1,0625–1,1875 rem | Inter 400 |
| Texto | `.prose-calm` | 15–17 px, interlineado 1,7 | máx. ~60 caracteres por línea |
| Etiqueta | `.eyebrow` | 13 px | Inter 600, mayúsculas, tracking 0,06 em, con filete de marca |

**Color**: tinta `#141414`/`#1A1A1A`, papel cálido `#F7F6F3` (modo claro), `#121212` (modo oscuro), gris `#A8A8A8` para texto auxiliar; rojo `#E31E24` solo en acentos (filete del eyebrow, punto final, enlaces activos, foco). Para texto de marca se usan tokens `--brand-text`, `--ok-text`, `--warn-text`, `--err-text`, ajustados por tema a contraste AA.

**Espaciado**: múltiplos de 8 px; `.section` 96–160 px de alto vertical, `.section-tight` para continuidad; contenedor `.container-x`.

**Componentes**: botones 48 px de alto (`sm` 40, `lg` 56), radio 8 px; tarjetas radio 12 px, borde 1 px (`--bd-1/2`), sin sombra en reposo y `--shadow-hover` al pasar; inputs con línea inferior en búsquedas y borde fino en formularios; tabs subrayadas; íconos Lucide a `strokeWidth` 1,5.

**Movimiento**: `Reveal` (fundido + 12 px), curva `[0.22, 1, 0.36, 1]`, 0,8 s; imágenes con zoom 1,03 en hover; `prefers-reduced-motion` desactiva transiciones.

**Accesibilidad**: foco visible con `--brand-text`; áreas táctiles ≥ 44 px en controles clave; diálogos con `role="dialog"`/`aria-modal`; regiones con scroll enfocables; paquetes seleccionables como `checkbox` operables con teclado.

## 4. Limitaciones

- **Fotografía**: no hay imágenes editoriales con licencia. Se usan visuales derivados de la marca (papel, patrón diagonal, ícono fino). Para el nivel buscado se necesita fotografía de producto y de logística aportada por Optimus.
- **Tipografías**: se cargan desde Google Fonts; para producción conviene alojarlas localmente.
- **Verificación visual**: la revisión se apoyó en pruebas automáticas (axe, desbordes a 320–1920 px, flujos E2E). No se hizo revisión manual con lectores de pantalla ni en dispositivos reales.
- Las afirmaciones del diagnóstico describen el código previo; no se midieron métricas de conversión ni de rendimiento percibido.
