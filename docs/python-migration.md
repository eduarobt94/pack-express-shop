# Migración del backend a Python (FastAPI)

**Estado:** el backend Python está completo en alcance y verificado, **convive con el PHP** (no lo reemplaza ni lo modifica) y ambos
comparten la misma base de datos. El corte a producción es una decisión del titular (ver sección 9).

## 1. Análisis del backend original

| Aspecto | Hallazgo (código real) |
|---|---|
| Stack | PHP 8.2 sin framework: `Router` propio, controladores, `Database` (PDO), JWT HS256 propio. Sin Composer ni dependencias. |
| Endpoints | **38 operaciones** (ver inventario, sección 5). Todas devuelven `{"success","message","data"}` / `{"success":false,"message","errors"?}`. |
| Base de datos | MariaDB, esquema versionado con `database/migrate.php` (5 migraciones): CHECK, FK compuestas, **31 triggers**, `SELECT … FOR UPDATE`, variable de sesión `@app_user_id` para el historial de estados. |
| Autenticación | JWT de acceso (15 min, `typ=access`, `ver`) + refresh token **opaco** con rotación y detección de reutilización (tabla `refresh_tokens`); bloqueo de cuenta; roles `customer/agent/warehouse/admin` leídos de la base en cada petición. |
| Seguridad transversal | rate limit en BD (`rate_limits`), CORS exacto, HTTPS obligatorio en producción, cabeceras, logs sin PII, cifrado AES-256-GCM de documentos de destinatarios, almacén de archivos por firma. |
| Integraciones / tareas | Ninguna externa activa: el envío de correo de recuperación es un `TODO` heredado; el proxy de Amazon es del frontend. No hay procesos programados ni colas. |
| Pruebas | `api/v1/tests/api_test.php` (111 casos de contrato y seguridad contra un servidor real) y `database/tests/db_rules_test.php` (85). Sin cobertura de frontend. |
| Frontend | `src/lib/api.js` usa `/api/v1` y `Authorization: Bearer`; `AuthContext` consume `/auth/*`. El resto del frontend usa datos de demostración. El proxy de Vite apunta a `localhost:8000` (el puerto de este backend). |

## 2. Stack Python y justificación

| Pieza | Decisión | Por qué |
|---|---|---|
| **FastAPI** | Sí | Tipado, validación declarativa, OpenAPI automático (`docs/openapi.json`) y dependencias para auth/roles/rate limit con el mismo orden que el middleware PHP. |
| **Pydantic v2** | Sí | Esquemas de entrada con `extra="ignore"` (sin mass assignment), rechazo de tipos no escalares, limpieza de HTML y reglas idénticas a las del validador PHP (`app/schemas.py`). |
| **SQLAlchemy 2 Core** (no ORM) | Sí, solo Core + `text()` parametrizado | El esquema y las reglas viven en la base (triggers, CHECK, FK compuestas, bloqueos). La API necesita exactamente esas sentencias; un ORM reproduciría el esquema sin aportar y arriesgaría diferencias sutiles. Core da parámetros enlazados, pool y transacciones. |
| **PyMySQL** | Sí | Driver puro Python, sin compilación (Windows/hosting). |
| **Alembic** | **No (por ahora)** | El esquema ya tiene migraciones versionadas y probadas (`database/migrate.php`, 5 migraciones con triggers, aserciones previas y respaldo obligatorio en producción). Introducir Alembic duplicaría la fuente de verdad. Se reevalúa tras el corte, si se quiere migrar el runner. |
| Síncrono (no `async`) | Sí | La carga es pequeña y el acceso a MariaDB es bloqueante; los endpoints `def` corren en el pool de hilos sin complicar el código. Async no aporta valor medible aquí. |
| PyJWT, bcrypt, argon2-cffi, cryptography | Sí | Bibliotecas estándar y auditadas; no se reimplementa criptografía. Formatos idénticos a PHP (ver compatibilidad cruzada). |
| Pytest · Ruff · mypy | Sí | Pruebas, estilo/seguridad (reglas `S`) y tipos. |

Cambio de base de datos: **ninguno**. El esquema y los datos no se tocaron.

## 3. Estructura

```
backend/
├─ app/
│  ├─ main.py            # create_app: middleware de seguridad, manejadores de error, routers (con y sin /api/v1)
│  ├─ config.py          # Settings tipados (mismas variables que api/v1/.env), falla cerrado
│  ├─ db.py              # engine, Db (query/one/execute/tx/next_seq/set_actor)
│  ├─ schemas.py         # Pydantic: validación y anti mass-assignment
│  ├─ api/
│  │  ├─ deps.py         # get_db, current_user, roles, rate limiters
│  │  └─ routes/         # auth · users · purchases · finance (tarifas/liquidaciones/staff) · locker (+ modelo anterior)
│  ├─ services/          # sessions · settlements (reglas de negocio) · files (almacén)
│  └─ core/              # errors · responses · logging · money · crypto · passwords · tokens · ratelimit · network
├─ tests/                # unit · integración (TestClient) · compatibilidad PHP↔Python · comparación diferencial
├─ pyproject.toml · requirements*.txt · .env.example · Dockerfile
```

## 4. Módulos migrados

Todos. **Pendiente: ninguno del backend PHP.** Lo que sigue pendiente es lo mismo que ya estaba pendiente en PHP (envío del correo de
recuperación, panel de administración, constancias, notificaciones).

## 5. Inventario de endpoints y compatibilidad

Mismas rutas y métodos, con y sin el prefijo `/api/v1`. 38/38 operaciones.

| Módulo | Operaciones | Seguridad |
|---|---|---|
| Auth | `POST /auth/login · register · refresh · logout · forgot-password · reset-password` | límite 10/min por IP+endpoint; login además 8/15 min por cuenta; bloqueo de cuenta tras 5 fallos |
| Público | `GET /tariffs/current` · `POST /quote` | límite general |
| Usuario | `GET/PUT /user` · `PUT /user/password` · `GET/POST /user/addresses` · `PUT/DELETE /user/addresses/{id}` | JWT; siempre filtrado por `user_id` |
| Compras | `GET/POST /purchases` · `GET /purchases/{code}` · `GET /purchases/{code}/receipt` | JWT; 404 si es de otro cliente; subida validada por firma |
| Liquidaciones | `GET /settlements` · `GET /settlements/{code}` | JWT; solo las propias y emitidas |
| Casillero | `GET /locker` · `/locker/packages[/{id}]` · `/locker/shipments[/{id}]` | JWT |
| Personal | `POST /staff/packages` · `GET /staff/packages/unidentified` · `POST /staff/settlements` · `POST /staff/settlements/{code}/payments` · `POST /staff/purchases/{code}/status` | rol verificado en la base; límite 20/min por usuario |
| Administración | `POST /admin/tariffs` | solo `admin` |
| Modelo anterior | `GET /pre-alerts` · `DELETE /pre-alerts/{id}` · `GET /orders[/{id}]` · `POST /pre-alerts` y `POST /orders` → **410** | JWT |

Contrato JSON idéntico: `DECIMAL` como cadena (`"500.00"`), fechas `AAAA-MM-DD HH:MM:SS`, `Cache-Control: no-store`, tokens y hashes
intercambiables con PHP.

## 6. Pruebas ejecutadas y resultados

| Prueba | Resultado |
|---|---|
| Suite de contrato `api/v1/tests/api_test.php` (111 casos: autenticación, IDOR, mass assignment, inyección, archivos, sesión, rate limit, flujo de liquidación, CORS/HTTPS/HSTS) **contra el backend PHP** | **111/111** |
| La **misma suite, sin cambios en los casos, contra el backend Python** (`API_IMPL=python`) | **111/111** |
| Idem con el usuario de BD de mínimo privilegio (`optimus_app`) | **111/111** |
| `pytest` (unitarias, integración con TestClient, compatibilidad cruzada con PHP) | **69/69** |
| Comparación diferencial `backend/tests/compare_backends.py` (91 peticiones idénticas a ambos backends; estado, `success`, mensaje, estructura de datos y cabeceras) | **88 idénticas · 3 diferencias** (ver sección 7) |
| Reglas de la base `database/tests/db_rules_test.php` | 85/85 |
| `ruff check`, `ruff format --check`, `mypy app` | sin hallazgos |
| Arranque con `JWT_SECRET` débil o de ejemplo | aborta (`RuntimeError`) |

**Compatibilidad cruzada (condición de una reversión segura):** un JWT emitido por PHP lo acepta Python y viceversa; los documentos
cifrados con AES-GCM por uno los descifra el otro; los hashes bcrypt `$2y$` de PHP se verifican en Python y los de Python en PHP;
los hashes Argon2id de PHP se verifican en Python.

## 7. Diferencias funcionales y correcciones

| # | Diferencia | Motivo |
|---|---|---|
| 1 | `GET /locker/shipments`, `GET /locker/shipments/{id}`, `GET /orders` → **500 en PHP, 200/404 en Python** | **Defecto del PHP original**: usa `JSON_ARRAYAGG`, que no existe en MariaDB < 10.5 (el entorno de pruebas es 10.4). Python obtiene los datos con consultas portables. Si producción tuviera MariaDB ≥ 10.5 el PHP funcionaba. |
| 2 | Los envíos sin paquetes devuelven `package_ids: []` (el PHP habría devuelto `[null]`) | Corrección del `LEFT JOIN … JSON_ARRAYAGG`. |
| 3 | Validación: `errors` por campo con otro texto de mensaje en los casos de formato | Los mensajes de Pydantic se normalizan; `status`, `success`, `message` y los campos con error coinciden. `login` y `forgot-password` siguen **sin** detalle por campo, como en PHP. |
| 4 | `PUT/DELETE /user/addresses/abc` → 404 (igual que PHP). | Paridad con `(int)` de PHP; no es diferencia. |
| 5 | Método HTTP no permitido → 404 `Endpoint not found` | Paridad con el router PHP (FastAPI respondería 405). |
| 6 | Errores 500 en `development/testing` muestran solo el nombre de la excepción | PHP mostraba el mensaje completo; en producción ambos devuelven el mensaje genérico. |
| 7 | Hash de contraseñas: bcrypt `$2y$` cost 12 por defecto (`PASSWORD_ALGO`) | Para que una reversión a PHP siga validando contraseñas nuevas. `argon2id` disponible para después del corte. |
| 8 | `/docs` y `/openapi.json` solo fuera de producción | No exponer el mapa de la API. |

Mejoras de seguridad introducidas por la migración (verificadas): tope de tamaño de petición antes de leer el cuerpo; lectura acotada de
archivos (`UPLOAD_MAX_MB+1`); validación estricta de tipos con Pydantic; `uvicorn --no-proxy-headers` (ver riesgos).

## 8. Instalación, configuración, ejecución y pruebas

```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt     # Linux/macOS: .venv/bin/pip
cp .env.example .env        # completar JWT_SECRET (>=32), DATA_ENC_KEY, DB_*; usar el usuario optimus_app
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers
```
`--no-proxy-headers` es obligatorio: sin él, uvicorn reescribe la IP del cliente desde `X-Forwarded-For` para conexiones locales y se
puede evadir el rate limit (la suite lo detectó). La confianza en proxies se declara solo en `TRUSTED_PROXIES`.

Pruebas (base desechable cuyo nombre termine en `_test`, con migraciones aplicadas: `php database/migrate.php up`):
```bash
cd backend && python -m pytest                                  # unitarias + integración + compatibilidad PHP
ruff check . && ruff format --check . && mypy app
API_IMPL=python php api/v1/tests/api_test.php                    # contrato de 111 casos contra Python (sin API_IMPL: contra PHP)
python backend/tests/compare_backends.py                         # comparación PHP ↔ Python
```
Documentación interactiva (solo fuera de producción): `http://localhost:8000/docs`. Contrato exportado: `docs/openapi.json`.

## 9. Despliegue gradual y reversión

La migración es **de backend únicamente**: misma base, mismo esquema, mismas rutas. Por eso el corte se hace en el proxy y es reversible
en segundos.

1. **Prerrequisitos de producción:** migraciones 001–005 aplicadas (`database/migrate.php`), usuarios de `grants.sql`, `JWT_SECRET` y `DATA_ENC_KEY` **nuevos** (los anteriores deben considerarse comprometidos, ver auditoría), `UPLOAD_DIR` fuera del web, **`DATA_ENC_KEY` idéntica en ambos backends** si conviven.
2. **Sombra:** levantar el backend Python en un puerto interno (`127.0.0.1:8000`) detrás del mismo reverse proxy; PHP sigue sirviendo todo.
3. **Comparar:** ejecutar `compare_backends.py` y la suite de contrato contra el ambiente de *staging* con una copia de la base.
4. **Canario:** enrutar un porcentaje o solo `GET` públicos (`/tariffs/current`, `/quote`) a Python; vigilar errores 5xx, latencia y logs (`backend/logs`).
5. **Corte:** enrutar `/api/v1/*` a Python. Mantener PHP instalado pero sin tráfico durante al menos un ciclo de negocio.
6. **Reversión:** devolver `/api/v1/*` al upstream PHP. No hay migración de datos que deshacer; los tokens, hashes y datos cifrados son compatibles en ambos sentidos. Única precaución: no cambiar `PASSWORD_ALGO` a `argon2id` hasta consolidar el corte (PHP sin Argon2 no verificaría esos hashes).
7. **Después del corte estable:** cambiar `PASSWORD_ALGO=argon2id`, retirar el código PHP y reevaluar Alembic.

Ejecución en producción: contenedor (`backend/Dockerfile`, usuario no root) o servicio systemd con `uvicorn … --workers 2 --no-proxy-headers`
detrás de Nginx/Apache con TLS (que debe enviar `X-Forwarded-Proto: https` y estar en `TRUSTED_PROXIES`). Logs JSON en `LOG_DIR`
(`app-*.log` y `audit-*.log`); recomendable rotarlos y no exponerlos por web.

## 10. Riesgos pendientes y recomendaciones

1. **El hosting actual es compartido (PHP).** Ejecutar Python requiere un VPS/contenedor o un plan que lo permita; es una decisión de infraestructura **que debe confirmar el titular antes de planificar el corte**. Mientras tanto el backend PHP sigue siendo válido.
2. **Secretos filtrados** (auditoría de seguridad, F-01): rotar antes de cualquier despliegue; vale para ambos backends.
3. **Sin pruebas de carga ni de rendimiento**: las consultas son las mismas que las del PHP y las tablas pequeñas; medir antes del corte con tráfico real. El pool es de 5+10 conexiones por proceso (ajustar a `max_connections` de MariaDB × número de workers).
4. **MariaDB < 10.5**: el PHP original falla en 3 endpoints (diferencia 1). Confirmar la versión de producción.
5. **Fecha y hora:** la base y el proceso Python deben usar la misma zona horaria (las comparaciones críticas se hacen en SQL, pero los logs y `date`/`time` locales dependen del SO).
6. **Límite de frecuencia de ventana fija:** una ráfaga puede alcanzar hasta 2× el límite en el borde de la ventana (igual que PHP).
7. **Frontend:** no se modificó. Sigue guardando tokens en `localStorage` (ver auditoría D-5) y no consume aún la mayoría de los endpoints.
8. **No probado:** otras versiones de MySQL/MariaDB, Python < 3.12, ejecución con varios workers bajo carga concurrente real, comportamiento tras un reinicio con transacciones abiertas.
