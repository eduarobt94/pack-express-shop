# Adaptación de la base de datos al nuevo modelo de negocio

Motor objetivo: **MariaDB ≥ 10.4** (el de Hostinger y el probado aquí). Se usa sintaxis propia de MariaDB (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE TRIGGER`); en MySQL 8 habría que adaptarla.

## 1. Análisis del modelo anterior (esquema v1.0)

| Tabla | Problema frente al nuevo modelo |
|---|---|
| `orders`, `order_items` | Modelaban **pago del producto dentro de la plataforma** con subtotal/flete/aduana. El nuevo modelo no cobra el producto: el cliente paga en la tienda y a Optimus solo comisión + envío. El código que escribía en ellas estaba roto (INSERT con 10 columnas y 11 valores) y aceptaba precios del cliente. |
| `pre_alerts` | Aviso previo sin comprobante estructurado, sin productos ni destinatario; su subida de archivos era insegura. Reemplazada por `purchases`. |
| `addresses` | `province CHAR(3)` libre (sin FK); documento de identidad en texto plano; sin garantía de un solo predeterminado; `ON DELETE CASCADE` desde `users`. |
| `packages` | `user_id` obligatorio: no admite paquetes **no identificados**; sin vínculo con la compra; peso sin unidad original; seguro (obsoleto). |
| `locker_shipments` | `address_id` sin FK; `handling`/`insurance`/`volumetric_weight_kg` obsoletos; estados que no incluyen despacho/Cuba/reparto/incidencia; nada impedía despachar sin pago. |
| `locker_shipment_packages` | Un paquete podía estar en dos envíos. |
| (no existía) | Roles, tarifas versionadas, liquidaciones, pagos, historial de estados, sesiones revocables, rate limiting compartido. |

Contraste con el código: cada decisión se verificó contra los controladores (`api/v1/controllers/*`) y el documento de alcance (`Especificacion_Web_Optimus_Cuba.docx`).

## 2. Nuevo modelo

```
users(role) ─┬─ suites                       (código de cliente OPT-UY-######)
             ├─ addresses ── provinces       (destinatarios en Cuba; doc. cifrado; 1 predeterminado)
             ├─ purchases ── purchase_items  (compra registrada; importe = qty×precio−descuento, calculado en la BD)
             │      └──< packages >── locker_shipment_packages ──> locker_shipments
             └─ settlements ── settlement_lines ──> purchases
                    ├─ payments (inmutables; contrapartidas negativas)
                    └─ tariff_versions (tarifa aplicada, inmutable)
status_transitions (máquina de estados) · status_log (historial) · counters (códigos sin carreras)
refresh_tokens · rate_limits · internal_cost_params (solo administración)
```

Reglas de negocio que **hace cumplir la base de datos** (no solo la aplicación):

| Regla | Mecanismo |
|---|---|
| El destinatario/compra/paquete/envío pertenecen al mismo cliente | FKs compuestas `(id, user_id)` + triggers |
| Un solo destinatario predeterminado por cliente | columna generada + `UNIQUE` |
| Provincia válida | FK a `provinces` |
| Cantidad 1–1000, precios ≥ 0, descuento ≤ importe, URL http(s) | `CHECK` |
| Pedido de tienda no duplicado | `UNIQUE(user_id, store, store_order_number)` |
| Comisión = `ROUND(base × tasa, 2)`; envío = `ROUND(kg × tarifa, 2)`; total = comisión + envío + extras; extra con justificación | `CHECK` en `settlements` |
| Una compra no puede estar en dos liquidaciones vigentes (no se duplica comisión, peso ni cargos) | columna generada + `UNIQUE` en `settlement_lines` |
| Liquidación emitida e inmutable; ajustes = nueva versión (`supersedes_id`) | trigger |
| Emitir exige personal (`agent/admin`) y que base y peso coincidan con las líneas | trigger |
| Tarifa aplicada guardada en la liquidación; las tarifas son inmutables y solo las crea un administrador | triggers |
| Pagos: solo `agent/admin`, sin sobrepago, inmutables, anulación solo por contrapartida completa; pagos en UYU guardan cotización | triggers + `CHECK` (serializado con `SELECT … FOR UPDATE`) |
| Estado de la liquidación derivado de los pagos | trigger `AFTER INSERT` en `payments` |
| Transiciones de estado válidas (compra, liquidación, envío) | tabla `status_transitions` + triggers |
| **No se despacha** sin liquidación pagada, guía del operador y pesos completos (excepción solo de un administrador, con motivo) | trigger en `locker_shipments` |
| Un paquete en un solo envío; no se editan envíos despachados | `UNIQUE` + triggers |
| Sin borrado accidental: compras, envíos, paquetes, liquidaciones, pagos, tarifas e historial no se eliminan | triggers + `ON DELETE RESTRICT` (antes `CASCADE` desde `users`) |
| Peso > 0 | `CHECK` |
| Cada cambio de estado queda en `status_log` con el usuario (`@app_user_id`) | triggers |

## 3. Migraciones y orden de ejecución

| # | Archivo | Qué hace |
|---|---|---|
| 001 | `001_baseline.sql` | Esquema v1.0 original, idempotente (`IF NOT EXISTS`). |
| 002 | `002_roles_provinces_recipients.sql` | Roles y bloqueo en `users`; `provinces`; FK de provincia; `id_doc_enc`; un predeterminado; `refresh_tokens`; `rate_limits`. **Precondiciones** (aborta si hay provincias inválidas o dos predeterminados). |
| 003 | `003_purchases_tariffs_settlements.sql` | `purchases`, `purchase_items`, `tariff_versions` (+ tarifa de referencia), `internal_cost_params`, `settlements`, `settlement_lines`, `payments`, `status_transitions`, `status_log`, `counters`. |
| 004 | `004_packages_shipments_rules.sql` | Paquetes no identificados, unidades de peso, FKs compuestas, `RESTRICT`, estados nuevos, todos los triggers. **Precondiciones** (pesos ≤ 0, valores negativos, paquetes en 2 envíos, destinatarios ajenos). |
| 005 | `005_legacy_deprecation.sql` | Marca como obsoletas (comentarios) las estructuras del modelo anterior. No borra nada. |

`database/migrate.php`: versionado en `schema_migrations` con checksum (detecta migraciones modificadas), bloques separados por `-- @@`, aserciones previas con `-- @@assert`, y **rechaza correr en producción sin `--yes-i-have-a-backup`**.

`database/schema.sql` es una instantánea de referencia generada con `mysqldump --no-data`; **no** se usa para crear la base.

## 4. Estrategia: expansión → contracción

Esta entrega es solo la fase de **EXPANSIÓN**: agrega estructuras y restricciones, no elimina ni transforma datos. La API anterior y la nueva conviven con el mismo esquema.

**Contracción (pendiente, requiere autorización y respaldo verificado):** eliminar `orders`, `order_items`, `pre_alerts`, y las columnas obsoletas (`addresses.ci`, `packages.insured/insurance_cost`, `locker_shipments.volumetric_weight_kg/handling/insurance`, `users.tier`), y retirar los valores de estado antiguos de los `ENUM`. Antes de cada eliminación hay que verificar que no queden dependencias ni datos necesarios (listados en `005_legacy_deprecation.sql`).

## 5. Límites de reversión

- **No hay migración inversa automática.** Las migraciones 002–005 solo agregan; para volver atrás sin pérdida alcanza con **no usar** lo nuevo (la API anterior sigue siendo compatible con las columnas viejas). Restaurar el respaldo previo revierte todo.
- Lo que **no** es reversible sin respaldo: pasar `ON DELETE CASCADE` → `RESTRICT` (se puede deshacer, pero reintroduce el riesgo), `MODIFY` de `ENUM` ampliados (reducirlos fallaría si ya hay valores nuevos) y el cifrado de documentos con `--blank-legacy` (borra el texto plano: **irreversible**; exige copia previa y la clave).
- DDL en MariaDB hace *commit* implícito: una migración **no es atómica**. Cada una es idempotente y solo se registra al terminar; ante un fallo se corrige la causa y se vuelve a ejecutar (probado: tras un fallo intermedio la nueva ejecución completó correctamente).

## 6. Migración de datos existentes

| Dato | Procedimiento | Validación |
|---|---|---|
| `addresses.ci` (texto plano) → `id_doc_enc` | `php database/scripts/encrypt_recipient_docs.php` (simulacro) → `--apply` → solo tras verificar y con respaldo: `--apply --blank-legacy` | Cada fila se cifra, se **descifra y se compara**; informe de reconciliación (pendientes / cifradas / fallidas). Probado: 2/2 filas, idempotente |
| `pre_alerts`, `orders` | No se migran (modelos distintos). Se conservan para consulta histórica (solo lectura para `optimus_app`). | Conteos idénticos antes/después (3 usuarios, 6 paquetes, 2 pre-alertas, 2 destinatarios, 1 envío, 3 órdenes, 4 ítems) |
| Estados antiguos de paquetes/envíos | Siguen siendo válidos en el `ENUM`; los nuevos se usan en filas nuevas. **No se remapean automáticamente**: p. ej. `no_docs` y `retained` no tienen equivalente unívoco. | Decisión pendiente de Optimus |

## 7. Procedimiento recomendado de despliegue y recuperación

1. **Respaldo** completo (`mysqldump --single-transaction --routines --triggers`) y **prueba de restauración** en un ambiente aparte.
2. Poner el sitio en mantenimiento (las migraciones 002–004 toman bloqueos de metadatos breves; las tablas son pequeñas).
3. Crear los usuarios con `database/security/grants.sql` (contraseñas nuevas, sin guardarlas en el repo).
4. Con `optimus_migrator`: `php database/migrate.php status` → `php database/migrate.php up --yes-i-have-a-backup`.
5. Configurar `DATA_ENC_KEY`, `JWT_SECRET` (nuevo), `CORS_ORIGIN`, `TRUSTED_PROXIES`, `UPLOAD_DIR` fuera del web; apuntar la API a `optimus_app`.
6. Cifrar documentos (sección 6). Probar login, registro, una compra y una liquidación de prueba.
7. Retirar el modo mantenimiento. **Plan B:** restaurar el respaldo del paso 1 y volver a desplegar la versión anterior del backend.

## 8. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| Migraciones sobre base **vacía** (001–005) | OK |
| Migraciones sobre la base v1.0 **con datos** (seeds del modelo anterior) | OK, conteos preservados; 2ª ejecución: "Nada pendiente" |
| Precondición con dato inválido (provincia inexistente) | Aborta con código 4; solo queda registrada la 001; no se crea ninguna tabla nueva |
| Fallo intermedio y reanudación | OK (idempotencia) |
| `database/tests/db_rules_test.php` | **85/85** — integridad, pertenencia, estados, cálculo, inmutabilidad, pagos por rol, condición de despacho, tarifas, historial, **concurrencia** (dos procesos pagando a la vez: el segundo espera el bloqueo y es rechazado por exceder el saldo) y atomicidad |
| `api/v1/tests/api_test.php` | **111/111**, también ejecutada con el usuario de mínimo privilegio |
| Mínimo privilegio | `optimus_app`: sin `DROP/ALTER/TRIGGER`, sin `UPDATE/DELETE` sobre pagos, compras o tarifas, sin acceso a `schema_migrations` |
| Build del frontend / `pnpm audit` | OK / 0 vulnerabilidades |

**Sin ejecutar / limitaciones:** no existe suite de pruebas del frontend; no hay pruebas de carga ni de planes de ejecución sobre volúmenes reales (las tablas son pequeñas; los índices se diseñaron para las consultas de la API: `(user_id,status)`, `uq_purchases_store_order`, claves únicas de códigos); no se probó MySQL 8 ni otra versión de MariaDB; no se probó el servidor Apache del hosting.

## 9. Riesgos, decisiones y tareas pendientes

- **Zona horaria:** PHP (`Europe/Berlin` en esta máquina) y la base usan zonas distintas. Se detectó y corrigió un error real por esto: las comparaciones de fechas de caducidad/bloqueo se hacen en SQL. Fijar la misma zona (o UTC) en PHP y en la base en producción.
- **Tarifas y costos:** los valores 10 %, USD 11/kg y los costos internos son **de referencia** (`is_reference=1`) hasta que Optimus los confirme; peso mínimo, redondeo de fracciones, volumen y baterías siguen sin definir.
- **Formato del código de cliente** (`OPT-UY-######`) y de las numeraciones: provisional.
- **Constancias y facturación fiscal**, notificaciones por correo, panel de administración y exportaciones: no incluidos en esta entrega.
- **Triggers y mantenimiento:** la lógica crítica vive en 31 triggers y 36 restricciones `CHECK`; cualquier cambio de reglas es una migración nueva. Se ejecutan con los privilegios del usuario que los creó (el migrator), por eso la app puede escribir el historial sin tener permiso directo.
- Decisión pendiente antes de la contracción: ¿hay datos reales en `orders`/`pre_alerts` de producción que Optimus quiera conservar fuera de la base?
