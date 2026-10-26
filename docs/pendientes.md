# Pendientes

Lista viva para ir trabajando poco a poco. Marcar con `[x]` al completar y anotar fecha. Orden: mayor impacto primero.

## A. Contenido que debe aportar Optimus (bloquea publicación real)

- [ ] **Datos de contacto reales**: número de WhatsApp, correo, dirección de la sucursal en Uruguay y horarios. Hoy son `[WHATSAPP]`, `[EMAIL]`, `[DIRECCIÓN DE LA SUCURSAL]`, `[HORARIOS DE ATENCIÓN]` (Footer, Contacto, Cómo comprar).
- [ ] **Plazos de entrega** (por tramo: recepción en EE.UU., despacho, entrega en Cuba). No publicar un plazo sin respaldo.
- [ ] **Lista de artículos prohibidos y restricciones** (baterías, paneles, generadores, voluminosos, líquidos, etc.).
- [ ] **Dirección de recepción en EE.UU.** (hoy pendiente en Cómo comprar y en el casillero de demostración).
- [ ] **Tarifa vigente** (hoy USD 11/kg es de referencia) y reglas de peso mínimo, redondeo, volumen y cargo por batería.
- [ ] **Condiciones del servicio** aprobadas: cancelaciones, almacenamiento, paquetes no identificados, falta de pago, pérdida/daño/seguro, reclamos y devoluciones, privacidad.
- [ ] **Cifras verificables** (años de operación, envíos realizados, reseñas reales) con fecha y responsable. Hasta entonces no hay sección de "por qué elegirnos".
- [ ] **Tiendas**: confirmar si Temu y Walmart se habilitan; hoy figuran "Próximamente".
- [ ] **Fotografía editorial con licencia** (producto, logística, equipo). Hoy los visuales derivan de la marca.

## B. Home y navegación (siguiente iteración, depende de A)

- [ ] **Bloque "Antes de enviar"** en la home: plazos, restricciones e impuestos en tres columnas cortas, con enlace a la página de prohibidos.
- [ ] **Página de artículos prohibidos y restricciones** (`/restricciones`) y enlazarla desde el footer y el cotizador.
- [ ] **Bloque de contacto** al final de la home (WhatsApp, horarios, dirección).
- [ ] **Botón fijo de WhatsApp** en la barra móvil (hoy solo Rastrear y Calcular; no se publica un botón a un placeholder).
- [ ] **Preguntas frecuentes** consolidadas en una sola página/ancla (hoy están dentro de Contacto).
- [ ] Acceso a **"Mis compras y recepción"** (casillero) desde la cuenta; hoy solo está en el pie y en el menú móvil.
- [ ] Mover la **búsqueda de productos** al catálogo con sugerencias; ya no está en la cabecera.

## C. Calidad y QA (de la fase de pruebas automatizadas)

- [ ] **Informe final** `docs/automated-testing-report.md` (estrategia, matriz TEST-xxx, defectos, cobertura, limitaciones).
- [ ] **Corrida completa final** de todo: Vitest con cobertura, pytest (incluye rendimiento), contrato PHP/Python, reglas de BD, Playwright escritorio y móvil, lint, build, auditoría de dependencias.
- [ ] **Calibrar umbrales de rendimiento** (`backend/tests/perf_thresholds.json` es provisional; medir con `PERF_REPORT=1`).
- [ ] **Ejecutar el CI** (`.github/workflows/ci.yml` nunca se corrió) y ajustar lo que falle.
- [ ] Investigar el **fallo intermitente** de `test_refresh_simultaneo_solo_rota_una_vez` (visto una vez, no reproducido) y el de a11y en "Cómo comprar" (oscuro), visto una vez en la corrida completa.
- [ ] Prueba de **concurrencia en el backend PHP** (hoy solo hay en Python).
- [ ] Pruebas **E2E con Chromium** (localmente se usa Edge) y revisión manual con lector de pantalla y dispositivos reales.
- [ ] Actualizar pruebas de interfaz tras cada cambio de navegación o de la home.

## D. Seguridad y despliegue

- [ ] **Rotar `JWT_SECRET` y la contraseña de la base de datos de producción**: el secreto anterior quedó en el historial público de git.
- [ ] Aplicar `database/security/grants.sql` (mínimo privilegio) en el servidor.
- [ ] Verificar las reglas de `.htaccess` y el alojamiento del backend en Python (FastAPI) o decidir si se mantiene PHP.
- [ ] Servir las **tipografías de forma local** (hoy se cargan desde Google Fonts).
- [ ] Code-splitting: el bundle principal supera 500 kB (aviso de build).

## F. Brechas contra la especificación (Especificacion_Web_Optimus_Cuba.docx)

Revisión de lo que pide el documento y todavía no está en la interfaz (el backend ya cubre parte). Se trabaja sin salir del alcance de la v1 del documento.

- [ ] **Recuperación de contraseña** (la especificación la pide junto con contraseña segura); hoy no hay flujo en la web ni en la API.
- [ ] **Formulario de registro de compra** completo: tienda, pedido, fecha, moneda, comprobante legible, detalle por producto (enlace, modelo, cantidad, precio, descuentos), impuestos y envío interno separados, seguimientos múltiples y aceptación de condiciones con versión y fecha. Hoy el formulario es una versión reducida.
- [ ] **Destinatarios**: alta, edición y borrado desde la web (provincia, municipio, datos del operador); hoy la pantalla de cuenta muestra datos de demostración.
- [ ] **Constancia descargable** de liquidación y pago (botón presente, sin archivo real); numeración y relación con facturación a definir con Optimus.
- [ ] **Avisos por correo** al recibir, liquidar, confirmar pago, despachar y entregar (propuesta mínima del documento). WhatsApp y operador quedan como ampliación aparte.
- [ ] **Panel de administración** y perfiles (administrador, caja/atención, colaborador en EE.UU.): bandeja de paquetes sin identificar, compras parcialmente recibidas, incidencias, exportación CSV/Excel de manifiestos, liquidaciones y costos, separación de ingresos por comisión y transporte.
- [ ] **Catálogo administrable**: fotos autorizadas, peso embalado verificado, disponibilidad por producto (hoy los productos no traen el dato `available`, así que la ficha no muestra disponibilidad, solo la fecha de actualización).
- [ ] **Regla de desembolso y estados** visibles al cliente: estados separados de compra, paquete/envío y pago con historial (quién y cuándo).
- [ ] **Zona horaria** y unidades (libras/kilos con dato original) definidas y mostradas.
- [ ] Revisar en cada cambio que **no se publique nada que la especificación marca como pendiente** (plazos reales, prohibidos, ahorros porcentuales, comparativas de precio, cifras sin respaldo, fotos o logos no autorizados).

Nota: varias ideas del análisis de competencia **no se implementan** por salirse del documento: compra asistida y pago del producto en la plataforma, pago en línea, DDP, planes de membresía, envío familiar compartido y almacenamiento gratis (no hay política definida: está en pendientes de la sección 7).

## E. Reglas para mantener la home limpia

- Una sección nueva solo entra si responde una duda que el soporte recibe seguido, trae un dato verificable y tiene una acción que no existe ya en otro lado.
- No entran: frases de marca sin dato, cifras sin respaldo, dos bloques para la misma pregunta, carruseles automáticos, pop-ups, productos fuera del servicio.
- Un solo CTA principal por pantalla; máximo 6 ítems en la cabecera.
- Si se agrega algo, se quita o se fusiona otra cosa del mismo nivel.
- Toda cifra publicada lleva fecha y responsable. Revisión trimestral con datos reales de uso.
