# Informe de auditoría de seguridad — Optimus Envíos

- **Fecha:** 2026-10-25 · **Alcance:** frontend (React/Vite), API PHP 8.2 (`api/v1`), base de datos (MariaDB), repositorio y dependencias.
- **Entorno de pruebas:** MariaDB 10.4.28 y PHP 8.2.4 locales, servidores `php -S` reales, base `optimus_test` desechable. **No se tocó ninguna base ni servidor de producción.**
- **Método:** inspección del código real + reproducción de los fallos sobre el código original (commit `827eaeb`, en un worktree aparte) + pruebas automatizadas antes/después. Nada se marcó como corregido sin que la prueba correspondiente pasara.

## A. Resumen ejecutivo

**Estado general:** el backend quedó sustancialmente endurecido y verificado con pruebas automatizadas (**196 aserciones: 85 de reglas de base de datos + 111 de API/seguridad, todas en verde**, incluso ejecutando la API con el usuario de base de datos de mínimo privilegio). **Pero la aplicación NO está lista para producción** por un problema que el código no puede resolver solo: **credenciales reales de producción están publicadas en un repositorio público** (ver F-01).

| Resultado | Controles |
|---|---|
| CUMPLE | 12 — SEC-01, 06, 07, 08, 10, 11, 13, 14, 15, 16, 17, 20 |
| CUMPLE PARCIALMENTE | 7 — SEC-02, 03, 05, 09, 12, 18, 19 |
| NO APLICA | 1 — SEC-04 (RLS; ver justificación) |
| NO CUMPLE / NO VERIFICADO | 0 (los puntos no verificables en este entorno están dentro de los "parcial", detallados en la sección D) |

Hallazgos: **2 críticos, 4 altos, 7 medios, 5 bajos/informativos** (19 en total). Corregidos en código: 17. Con acción manual pendiente del titular: 2 (F-01 y F-02, rotación de secretos).

**Riesgos que impiden recomendar el despliegue hoy**
1. **F-01 (crítico):** `api/v1/.env.production` — contraseña de la base de datos de producción y `JWT_SECRET` — está en el historial de Git de un repositorio **público** y ya fue fusionado a `master`. Quitarlo del árbol actual no revoca la exposición: hay que **rotar ambos secretos** (ver sección D).
2. **F-03:** las reglas de `.htaccess` que bloquean `/.env` y los directorios internos no se pudieron ejecutar aquí (no hay Apache); están verificadas solo por revisión estática.
3. Pendiente de definición del negocio (no es de seguridad pero condiciona el lanzamiento): tarifas, condiciones, medios de pago.

## B. Matriz de los 20 controles

| ID | Control | Estado inicial | Evidencia | Corrección | Estado final |
|---|---|---|---|---|---|
| SEC-01 | Protección de API keys | CUMPLE | `grep` del bundle `dist/` sin claves; la única variable `VITE_` es la URL de un proxy; el comentario del adaptador de Amazon exige firmar PAAPI en backend | Sin cambios necesarios | **CUMPLE** |
| SEC-02 | Secretos en Git | **NO CUMPLE** | `api/v1/.env.production` versionado en repo **público** (commit `ee1878c`); `dev.log` versionado | Archivo sacado del árbol (`git rm --cached`), `.gitignore` con `.env.*`, `*.key`, `*.pem`; `.env.example` sin secretos | **PARCIAL** — el historial aún lo contiene: **rotar** y, si se desea, purgar el historial |
| SEC-03 | Credenciales y acceso a la BD | PARCIAL | Credenciales prod filtradas (F-01); el `.env` local de desarrollo usa `root`; sin usuarios de mínimo privilegio | `database/security/grants.sql` (migrator / app / report). **Probado:** `optimus_app` no puede `DROP`, `ALTER`, crear triggers, borrar pagos/compras, modificar tarifas ni leer `schema_migrations` | **PARCIAL** — aplicar `grants.sql` en producción y rotar claves (no verificable aquí) |
| SEC-04 | Row-Level Security | — | MariaDB no implementa RLS | Controles equivalentes: todo SELECT/UPDATE filtra por `user_id`; FKs compuestas `(recipient_id,user_id)`, `(purchase_id,user_id)`, triggers de pertenencia; mínimo privilegio. **Probado** (IDOR/BOLA: bob no ve ni modifica nada de alice) | **NO APLICA** (con controles compensatorios verificados) |
| SEC-05 | Cifrado de datos sensibles | **NO CUMPLE** | `addresses.ci` en texto plano; HTTPS no forzado por la app | `id_doc_enc` AES-256-GCM con clave `DATA_ENC_KEY` fuera del repo; script de migración con verificación por fila; HTTPS forzado y HSTS (probado 426/HSTS) | **PARCIAL** — cifrado de disco/respaldos y custodia de la clave son del hosting/operación (no verificable aquí) |
| SEC-06 | Autenticación obligatoria | CUMPLE | Todas las rutas privadas usan `AuthMiddleware` | Contexto de autenticación pasa de `$_REQUEST` (inyectable por `?_auth[sub]=`) a estado estático; el usuario se recarga de la BD en cada petición | **CUMPLE** — 18 rutas privadas → 401 sin token (probado) |
| SEC-07 | Control de acceso (IDOR/BOLA) | PARCIAL | Consultas ya filtraban por `user_id`, pero sin roles ni defensa en la base | Roles en BD (`customer/agent/warehouse/admin`), verificados en cada petición; `Staff/Warehouse/AdminMiddleware`; FKs compuestas y triggers | **CUMPLE** — 12 pruebas de acceso cruzado/rol (sección B) más las de compras y liquidaciones (C y D) |
| SEC-08 | Mass assignment | PARCIAL | Listas blancas por campo, pero `POST /orders` aceptaba precios del cliente (F-05) | `register` fuerza `role=customer`; `PUT /user` solo `name/phone`; `POST /orders` deshabilitado | **CUMPLE** — `role/status/token_version/user_id/email` enviados por el cliente se ignoran (probado) |
| SEC-09 | Cookies y sesiones | **NO CUMPLE** | Refresh token sin rotación ni revocación; sin logout; cambiar la contraseña no cerraba sesiones; tokens en `localStorage` | Access JWT 15 min con `typ` y `ver`; refresh opaco, hasheado, **rotativo** con detección de reutilización (revoca la familia); `logout`; cambio/reseteo de clave invalida todo; usuario suspendido pierde acceso al instante | **PARCIAL** — el frontend sigue guardando tokens en `localStorage` (expuestos a XSS; mitigado por CSP y vida corta). CSRF **no aplica**: no se usan cookies |
| SEC-10 | Hash de contraseñas | PARCIAL | bcrypt cost 12 correcto, pero `Validator` aplicaba `strip_tags/trim` a la contraseña (reproducido: `"  <b>Cl</b>ave<x>123  "` → `"Clave123"`), login aceptaba `min:4`, semillas con clave `1234` | Argon2id (fallback bcrypt 12) con rehash transparente; campos de contraseña sin tocar; mín. 8 y máx. 72 **bytes**; semillas de desarrollo con otra clave | **CUMPLE** |
| SEC-11 | Rate limiting | PARCIAL | Solo por IP, mismo contador para todos los endpoints, archivos en `/tmp` con condición de carrera | Contador atómico en BD por (ámbito, IP, endpoint); por cuenta (8/15 min) en login; por usuario en operaciones sensibles; `Retry-After`; `X-Forwarded-For` solo desde `TRUSTED_PROXIES` | **CUMPLE** — 429 verificado; otra IP y otros endpoints no se ven afectados; rotar `X-Forwarded-For` no evade el límite |
| SEC-12 | Protección contra bots | **NO CUMPLE** | Ninguna | Límites por IP/cuenta/usuario, bloqueo de cuenta tras 5 fallos (15 min), mismas respuestas para usuario inexistente/clave errónea | **PARCIAL** — no hay CAPTCHA/WAF; recomendable Turnstile/reCAPTCHA en registro y recuperación |
| SEC-13 | Consultas parametrizadas | PARCIAL | Todo con `prepare`, salvo `LIKE 'PKX-{$province}-…'` armado con un dato de la BD (inyección de segundo orden, F-06) | Endpoint eliminado; `province` ahora FK a catálogo + regex; únicos fragmentos dinámicos son listas de `?` | **CUMPLE** — `grep` sin interpolación; payloads `' OR '1'='1` en ruta, filtro y provincia inofensivos (probado) |
| SEC-14 | Validación de entradas | PARCIAL | `numeric` aceptaba `1e999`, negativos y arrays provocaban `TypeError` (500) | Validador con tipos escalares, rangos, fechas, URL http(s), regex, bytes; centavos enteros (`Money`); `CHECK` en la BD para las mismas reglas | **CUMPLE** — los casos inválidos de las secciones B, C y D se rechazan con 422/409 (29 pruebas en la sección C) |
| SEC-15 | Sanitización / XSS | PARCIAL | React escapa por defecto y no hay `dangerouslySetInnerHTML`; sin CSP; `href` tomaba URLs externas sin validar | `strip_tags` en texto de usuario, `safeUrl()` (solo http/https), CHECK de URL en BD, CSP estricta en el SPA | **CUMPLE** — `<script>`/`onerror` no sobreviven al guardado; el CSP del SPA es estático (ver D) |
| SEC-16 | Seguridad de archivos | **NO CUMPLE** | `PreAlertController`: la extensión se tomaba del nombre del cliente (`x.php` con contenido PDF) y devolvía la ruta del servidor | `FileStore`: tipo real por `finfo`+firma, extensión derivada del tipo, nombre aleatorio, clave relativa validada por regex, tope de tamaño, almacenamiento fuera del web (o con `.htaccess` de denegación), descarga solo por endpoint autorizado | **CUMPLE** — PHP disfrazado → 415; PNG llamado `shell.php` → se guarda `.png`; >1 MB → 413; bob no descarga el comprobante de alice |
| SEC-17 | Minimización de respuestas | PARCIAL | `SELECT *` devolvía `factura_path`, `tier`, `status`, etc. | Columnas explícitas en todos los endpoints; documento de identidad enmascarado; liquidaciones sin `issued_by`/tarifa interna | **CUMPLE** — pruebas de campos ausentes |
| SEC-18 | Security headers | PARCIAL | Sin CSP ni HSTS; `X-XSS-Protection` obsoleto | API: nosniff, `X-Frame-Options`, CSP `default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy`, HSTS, `Cache-Control: no-store`. SPA: CSP, HSTS, COOP, Permissions-Policy en `public/.htaccess` | **PARCIAL** — API **verificada**; las cabeceras del SPA no se pudieron probar (sin Apache) |
| SEC-19 | HTTPS obligatorio | **NO CUMPLE** | Sin redirección; `APP_ENV` ausente = modo desarrollo (CORS reflejando cualquier origen y errores con detalle) | Falla **cerrado**: todo lo que no sea `development/testing` es producción; HTTPS requerido (426); redirección 308 y HSTS en `.htaccess`; CORS con coincidencia exacta | **PARCIAL** — lógica de la app verificada; certificado y redirección del servidor web no verificables aquí |
| SEC-20 | Auditoría de dependencias | **NO CUMPLE** | `pnpm audit`: **15 vulnerabilidades (7 altas, 7 moderadas, 1 baja)**: `react-router`, `vite`, `postcss`, `nanoid`, `source-map-js` | Actualizadas (`react-router-dom` 7.18.4, `vite` 8.3.5, etc.) | **CUMPLE** — `pnpm audit`: 0; el backend PHP no usa Composer; el build y el sitio siguen funcionando |

## C. Detalle de vulnerabilidades

| ID | Sev. | Dónde | Evidencia y riesgo | Corrección | Verificación |
|---|---|---|---|---|---|
| **F-01** | Crítica | `api/v1/.env.production` (git) | Contiene clave de la BD de producción y `JWT_SECRET`; el repo es público (`gh repo view` → PUBLIC) | Sacado del árbol, ignorado, plantilla sin secretos | `git ls-files` ya no lo lista. **El secreto sigue en el historial → rotar (D-1)** |
| **F-02** | Crítica | `JWT`/`AuthMiddleware` | **Reproducido** sobre el código original: un JWT firmado con el secreto de ejemplo (`change-this-…`) devolvió `200` con los datos del usuario 1. Con F-01 el secreto real también es público | La API se niega a arrancar si `JWT_SECRET` falta, tiene <32 caracteres o es el de ejemplo; JWT fija `HS256`, exige `typ=access`, `exp` y `ver` | Pruebas: `alg=none`, firma alterada, `sub` cambiado y refresh-como-access → 401 |
| **F-03** | Alta | `api/v1/.htaccess` | El archivo no tenía regla alguna para ficheros ocultos: con `RewriteCond !-f`, un archivo existente (`/api/v1/.env`) se serviría tal cual. No reproducible sin Apache | Denegación de dotfiles, `.env/.log/.sql…`, `controllers/ core/ config/ tests/ storage/`; `FilesMatch` de respaldo | **No verificado en ejecución** (revisión estática) |
| **F-04** | Alta | `PreAlertController::handleUpload` | `pathinfo($file['name'])`: un `x.php` con contenido PDF pasa la verificación de MIME y se guarda como `.php` (ejecución remota si el directorio es servido por PHP); la ruta del servidor se devolvía en la API | `FileStore` (ver SEC-16); la creación de pre-alertas se deshabilitó | Pruebas de subida (5 casos) en verde |
| **F-05** | Alta | `OrderController::create` | **Reproducido:** `POST /orders` → `{"message":"Error al crear la orden"}` (INSERT con 10 columnas y 11 valores). Además tomaba `unit_price` del cuerpo (manipulación de precios) y marcaba `paid_at=NOW()` | Endpoint reemplazado por `410 Gone`; el modelo de negocio ya no cobra producto en la plataforma | Prueba: `POST /orders` con precio 0,01 → 410 |
| **F-06** | Alta | `OrderController` | `LIKE 'PKX-{$province['province']}-…'` interpolaba un valor guardado desde la entrada del usuario (`province` aceptaba 3 caracteres cualesquiera) → inyección SQL de segundo orden | Endpoint eliminado; provincia = FK a catálogo + regex `^[A-Za-z]{3}$` | `province="'--"` → 422; `ZZZ` → 422 |
| F-07 | Media | `Validator` | **Reproducido:** altera contraseñas (`strip_tags` + `trim`) | Campos `password*`/`token*` sin tratamiento | Prueba de login con contraseña con caracteres especiales |
| F-08 | Media | `AuthController` | Sin bloqueo de cuenta; login `min:4`; tiempo distinto si el usuario no existe; sesiones sin revocación | Ver SEC-09/10/12 | 27 pruebas de autenticación y sesión (sección A) |
| F-09 | Media | `config/app.php`, `index.php` | `APP_ENV` ausente ⇒ desarrollo: CORS refleja cualquier `Origin` con `Allow-Credentials` y errores con detalle | Falla cerrado | Pruebas CORS: origen ajeno y `shop.example.evil.com` rechazados |
| F-10 | Media | `RateLimiter` | Contador global por IP en `/tmp`, no atómico | Ver SEC-11 | Pruebas de 429 |
| F-11 | Media | Controladores | `SELECT *` | Columnas explícitas | Pruebas de minimización |
| F-12 | Media | `public/.htaccess` | Sin CSP/HSTS/redirección HTTPS | Agregados | No verificado en ejecución |
| F-13 | Media | `addresses.ci` | Documento de identidad en texto plano | `id_doc_enc` + script verificado | Script ejecutado sobre datos reales del modelo anterior: 2/2 cifradas y verificadas |
| F-14 | Media | `package.json` | 15 advisories | Dependencias actualizadas | `pnpm audit` → 0; `pnpm build` OK |
| F-15 | Baja | Esquema | `ON DELETE CASCADE` desde `users` sobre paquetes, envíos, destinatarios | `RESTRICT` | Prueba: borrar un usuario con datos falla |
| F-16 | Baja | `Logger` | Registraba emails (PII) | Enmascara claves `email/pass/token/id_doc…` | Revisión de código |
| F-17 | Baja | `ProductDetail.jsx` | `href={product.url}` sin validar el esquema | `safeUrl()` | Build OK |
| F-18 | Baja | Repo | `dev.log` versionado | Eliminado | — |
| F-19 | Info | Entorno local | El `.env` local de desarrollo usa `root` y un nombre de base de producción | Recomendación | — |

**Observación del proceso de verificación:** las pruebas detectaron un error propio en la primera versión de la corrección: el bloqueo de cuenta comparaba `locked_until` con `strtotime()` de PHP (zona `Europe/Berlin`) contra `NOW()` de la BD (otra zona), por lo que **nunca bloqueaba**. Se corrigió comparando en SQL (también en la caducidad del refresh token). Sin la prueba, habría quedado un control aparente que no funcionaba.

## D. Riesgos pendientes y acciones manuales

1. **D-1 · Rotar secretos (URGENTE).** Cambiar la contraseña del usuario de base de datos de producción y generar un `JWT_SECRET` nuevo (`openssl rand -hex 48`). Al rotar el `JWT_SECRET` se cierran todas las sesiones. Si se quiere eliminar el archivo del historial hay que reescribirlo (`git filter-repo`) y forzar el push: es destructivo y debe decidirlo el titular; aun así, **los secretos deben considerarse comprometidos** porque el repositorio ya fue público.
2. **D-2 · Aplicar `database/security/grants.sql`** en producción con contraseñas nuevas y apuntar `DB_USER` de la API a `optimus_app`.
3. **D-3 · Configurar `DATA_ENC_KEY`** (y respaldarla aparte) antes de usar documentos de destinatarios; ejecutar `database/scripts/encrypt_recipient_docs.php` si existen datos con `ci`.
4. **D-4 · Pruebas que requieren Apache/HTTPS real:** reglas de `.htaccess` (F-03, F-12), redirección 308, cabeceras del SPA, certificado y `TRUSTED_PROXIES`. Comprobar manualmente tras desplegar: `curl -I https://dominio/api/v1/.env` debe dar 403/404; `curl -I http://dominio/` debe redirigir.
5. **D-5 · Tokens en `localStorage`.** Recomendado: refresh token en cookie `HttpOnly; Secure; SameSite=Strict` (con protección CSRF) y access token en memoria. No se hizo: el frontend todavía no consume la API (datos de demostración) y el cambio exige rediseñar el flujo.
6. **D-6 · Bots:** agregar CAPTCHA (Turnstile/reCAPTCHA) en registro y recuperación de contraseña.
7. **D-7 · Rate limiting de ventana fija:** una ráfaga puede duplicar el límite al cruzar la ventana (visto en las pruebas). Aceptable para este uso; si se necesita más rigor, pasar a ventana deslizante.
8. **D-8 · Recuperación de contraseña:** el envío del correo sigue sin implementar (`TODO` heredado); no se registra el token.
9. **D-9 · Sistema operativo/PHP/MariaDB del hosting:** nivel de parches no verificable desde aquí. Respaldos y su restauración: ver `docs/database-migration.md`.
10. **D-10 · Errores de producción:** revisar que `api/v1/logs` no sea legible por web y rote los logs.

## E. Resultado final

Los controles evaluados **no presentan vulnerabilidades de código pendientes conocidas**, y las pruebas automatizadas las cubren (196 en verde; 0 vulnerabilidades en `pnpm audit`). **La aplicación NO está preparada para avanzar a producción desde esta auditoría** hasta que se completen las acciones **D-1, D-2 y D-4** (rotar los secretos filtrados, aplicar mínimo privilegio en la base de producción y verificar las reglas del servidor web). No se declara cumplimiento total: SEC-02, 03, 05, 09, 12, 18 y 19 quedan **parciales** por las razones indicadas, y un control (SEC-04) no aplica a la tecnología.

### Cómo repetir las pruebas

```bash
mysql -e "DROP DATABASE IF EXISTS optimus_test; CREATE DATABASE optimus_test CHARACTER SET utf8mb4"
export DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASS= DB_NAME=optimus_test
php database/migrate.php up
php database/tests/db_rules_test.php        # 85 reglas de integridad/seguridad de la BD (base vacía)
# base vacía otra vez, luego:
php api/v1/tests/api_test.php               # 111 pruebas de API y seguridad (levanta 3 servidores php -S)
# con mínimo privilegio: aplicar grants.sql y exportar API_DB_USER/API_DB_PASS
pnpm audit && pnpm build
```
