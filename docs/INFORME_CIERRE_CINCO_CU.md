# Informe de cierre — Cinco casos de uso documentales (CU23, CU24, CU25, CU26, CU27)

**Fecha:** 2026-11-08 (UTC-04)
**Producto:** FashionStore
**Única base autorizada:** `127.0.0.1:55432/fashionstore_test` (recuperada, no recreada ni vaciada; no se consultó Supabase ni la base actual).
**Sin commit, push, merge, reset, clean, stash ni despliegue.** Los cambios permanecen locales sin staging.

---

## 1. Tabla de equivalidades (documental → técnico)

| Documental | Funcionalidad | Técnico conservado | Prefijos API | Estado |
|---|---|---|---|---|
| CU23 | Vestidor virtual AR | — (no existe implementación) | — | **bloqueado** |
| CU24 | Recomendaciones con IA | `cu17_Recomendacion` (recomendador reglas + modelo Qwen local) | `/api/cliente/recomendaciones`, `/ia` | **verificado** |
| CU25 | Atención de reservas | `cu22_gestionar_reservas_sucursal` / `cu11_gestionar_reserva` | `/api/admin/reservas-sucursal`, `/api/cliente/reservas` | **verificado** |
| CU26 | Devoluciones / cambios | `cu23_gestionar_devoluciones` | `/api/admin/devoluciones` | **verificado** |
| CU27 | Venta presencial offline móvil | `cu24_registrar_venta` (caja) / `cu12_carrito` | `/api/admin/caja/*`, `/api/cliente/carrito` | **bloqueado** |

Los identificadores técnicos (carpetas, rutas, permisos, clases) se conservaron tal cual existen; no se renombró para hacer coincidir la numeración documental.

---

## 2. CU23 documental — Vestidor virtual AR (BLOQUEADO)

### Estado
**bloqueado** — requiere Android SDK, dispositivo/emulador y aceptación de licencias. No hay hardware disponible para verificar la superposición sobre la persona (ajuste corporal).

### Evidencia localizada
- No existe carpeta ni pantalla de AR en el móvil (`lib/modules/` solo contiene: `cliente_experiencia_compra`, `seguridad_accesos`, `ventas_reportes`).
- No hay dependencias de AR (ARCore, ARKit, camera_x, etc.) en `pubspec.yaml`.
- No hay recursos 3D de prendas para vestir sobre la persona.

### Causa demostrable del bloqueo
- `adb`, `emulator`, `sdkmanager` no están instalados en el equipo.
- Las variables `ANDROID_HOME` / `ANDROID_SDK_ROOT` no están definidas.
- No se puede compilar ni instalar la aplicación móvil nativa, por lo que no es posible verificar permisos de cámara, seguimiento/anclaje AR, ni liberación de recursos en un dispositivo real.
- Un objeto colocado en un plano o un visor 3D sin AR **no acredita** el requisito documental de vestir sobre la persona.

### Archivo de acciones para el usuario
`C:\SI2_Parcial1\ACCIONES_USUARIO_ANDROID.md` — detalla pasos exactos para instalar Android SDK, aceptar licencias, crear emulador y ejecutar la app móvil.

### Siguiente acción
El usuario debe instalar Android SDK, aceptar licencias (intervención humana requerida), crear un emulador/dispositivo, y entonces se puede verificar CU23 en dispositivo real.

---

## 3. CU24 documental — Recomendaciones con IA (VERIFICADO)

### Estado
**verificado** — inferencia real con el modelo local Qwen 2.5-1.5B-Instruct Q4_K_M, origen="modelo", candidatos existentes y publicables del tenant.

### Archivos implementados
| Archivo | Función |
|---|---|
| `app/modules/cliente_experiencia_compra/cu17_Recomendacion/services/recomendacion.py` | `_cargar_modelo_ia()` (carga Qwen GGUF con verificación SHA-256), `_seleccion_con_modelo()` (selección estructurada con fallback a texto libre), `recomendar_ia()` (origen="modelo" o "heurístico") |
| `app/modules/cliente_experiencia_compra/cu17_Recomendacion/schemas/recomendacion.py` | `TipoOrigen = Literal["modelo","heuristico"]`, campo `origen` en `RecomendacionesRespuesta` |
| `app/modules/cliente_experiencia_compra/cu17_Recomendacion/routers/recomendacion.py` | Endpoint `GET /api/cliente/recomendaciones/ia` (cliente de sesión, sin aceptar id de terceros) |
| `app/modules/cliente_experiencia_compra/cu17_Recomendacion/repositories/recomendacion.py` | Consultas de compras pagadas, reservas vigentes, carrito activo, candidatos disponibles, popularidad |

### Modelo y runtime
- Modelo: `qwen2.5-1.5b-instruct-q4_k_m.gguf` (1.1 GB) en `LiveClothesShop-api/.local/models/`
- SHA-256 verificado: `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`
- Runtime: `llama-cpp-python==0.3.36` (instalado en `.venv`)
- Licencia: Apache-2.0 (`QWEN-LICENSE.txt` en `.local/models/`)

### Pruebas ejecutadas
| Prueba | Resultado |
|---|---|
| `test_cu24_recomendacion_ia.py` (modelo simulado, 6 pruebas) | 6 passed |
| `test_cu24_recomendacion_ia_pg.py` (inferencia real Qwen contra PG) | 1 passed |
| `test_cu24_recomendacion_ia.py` (origen, IDs válidos, fallback) | 6 passed |

### Evidencia de inferencia real contra PostgreSQL
Ejecutado contra `127.0.0.1:55432/fashionstore_test` (tenant manaco, idemp=5):
- `origen: "modelo"`
- `tipo: "general"` (cliente sin historial)
- `total: 5`
- IDs devueltos: `['C10438c22d5d786-5-0', 'C10438c22d5d786-5-1', 'C1091a61210c089-5-0', 'C1091a61210c089-5-1', 'C10bd3c354ba3c9-5-0']`
- Verificado: todos los 5 IDs existen en la tabla `producto` con `idemp=5`
- Tiempo de inferencia: ~63s (carga del modelo + inferencia CPU)

### Requisitos cumplidos
- ✅ Inferencia real con `origen="modelo"`
- ✅ Solo candidatos existentes y publicables del tenant (verificado en BD)
- ✅ Historial del cliente autorizado (perfil construido con compras/reservas/carrito propios)
- ✅ Sin precios, stock ni IDs inventados (todos los datos vienen del catálogo real de CU10)
- ✅ Manejo de cliente sin historial (tipo "general")
- ✅ Fallback marcado explícitamente como `origen="heuristico"` cuando el modelo no está disponible o falla
- ✅ Integración en endpoint `/api/cliente/recomendaciones/ia`

### Siguiente acción
Cuando haya recursos de CPU/memoria suficientes, ejecutar la inferencia con un cliente que tenga historial para verificar `tipo="personalizada"` con `origen="modelo"`.

---

## 4. CU25 documental / CU22 técnico — Atención de reservas (VERIFICADO)

### Estado
**verificado** — servicio backend completo con preparación, confirmación, atención/entrega, permisos y sucursal, repetición sin doble efecto, cancelación/vencimiento sin doble liberación.

### Archivos implementados
| Archivo | Función |
|---|---|
| `app/modules/Reservas y Atencion al cliente/cu22_gestionar_reservas_sucursal/services/reservas.py` | `expire()` (vencimiento autónomo acotado al tenant), `cobro()` (reserva lista para cobrar en caja), `update()` (confirmar/atender/reprogramar), `listing()`, `get()`, `detalle()`, `venta_vinculada()`, `estado_cobro()` |
| `app/modules/Reservas y Atencion al cliente/cu22_gestionar_reservas_sucursal/routers/reservas.py` | Rutas HTTP de atención de reservas |
| `app/modules/Reservas y Atencion al cliente/cu22_gestionar_reservas_sucursal/schemas/` | Esquemas de reserva, atención, reprogramación |

### Requisitos cumplidos
- ✅ Preparación de reserva (confirmar prendas, retener disponibilidad)
- ✅ Confirmación de reserva (estado `confirmada`)
- ✅ Atención/entrega vinculada al flujo de venta pagada (estado `atendida`, requiere pago aprobado)
- ✅ Permisos y sucursal (tenant de sesión, `scope_id` = nrosuc)
- ✅ Repetición sin doble efecto (idempotencia por `idOperacion` + hash de petición)
- ✅ Cancelación/vencimiento sin doble liberación (`release()` libera una sola vez, `expire()` marca `vencida`)
- ✅ No se descuenta stock dos veces al entregar (la reserva se convierte en venta solo mediante el flujo de pago existente)

### Pruebas ejecutadas
- `test_saas_postgres.py`: 72 passed (incluye pruebas de CU22/CU23)
- Pruebas dirigidas CU22/CU23: 8 passed (reportadas previamente)

### Comportamiento de stock
- Reservar reduce `cantDisp` (disponibilidad), no `stock` (existencia física).
- La entrega (atención) no descuenta stock de nuevo; la reserva se convierte en venta solo mediante el flujo de venta pagada (CU13/CU14).
- El vencimiento libera la disponibilidad retenida una sola vez.

---

## 5. CU26 documental / CU23 técnico — Devoluciones y cambios (VERIFICADO)

### Estado
**verificado** — servicio backend completo con devolución, cambio, inspección, aprobación, rechazo, reembolso, idempotencia y aislamiento por tenant.

### Archivos implementados
| Archivo | Función |
|---|---|
| `app/modules/Reservas y Atencion al cliente/cu23_gestionar_devoluciones/services/devoluciones.py` | `create()` (devolución), `create_exchange()` (cambio), `decide()` (inspeccionar/aprobar/rechazar), `refund()` (reembolso), `exchange_variants()`, `listing()`, `view()` |
| `app/modules/Reservas y Atencion al cliente/cu23_gestionar_devoluciones/models/devoluciones.py` | Modelos `Devolucion`, `Cambio`, `DetalleDev`, `DetalleCambio`, `PoliticaDevolucion`, `Reembolso` |
| `app/modules/Reservas y Atencion al cliente/cu23_gestionar_devoluciones/routers/devoluciones.py` | Rutas HTTP de devoluciones/cambios |
| `app/modules/Reservas y Atencion al cliente/cu23_gestionar_devoluciones/schemas/devoluciones.py` | Esquemas de solicitud, decisión, cambio |

### Requisitos cumplidos
- ✅ Devolución aceptada de prenda apta (inspección `apta`, aprobación, inventario y reembolso actualizados)
- ✅ Prenda dañada sin reincorporación a stock vendible (inspección `danada`, no se suma a `cantDisp`)
- ✅ Cambio con diferencia positiva (pago requerido), cero (sin movimiento económico), negativa (reembolso)
- ✅ Recarga de página y recuperación del mismo UUID (frontend: `idOperacion` persistido en `sessionStorage` aislado por empresa/usuario)
- ✅ Respuesta perdida tras commit y reintento sin duplicados (idempotencia por `idOperacion` + `huellasolicitud`, lock advisory PostgreSQL)
- ✅ Rechazo de recursos de otro tenant o sucursal no autorizada (RLS, `branch()` valida sucursal del tenant)
- ✅ Reembolso sin superar el importe retornable (validación `prior_refunds + refund_amount > payment.monto`)
- ✅ Ningún descuento doble de inventario (la reserva/venta original ya descontó; la devolución solo libera lo retenido)

### Reembolsos electrónicos
**Pendiente** — requieren confirmación del proveedor (Stripe). No se llamó a Stripe sandbox, no se usaron claves live, no se realizó ningún cargo real. El reembolso queda en estado `pendiente` hasta que el proveedor confirme.

### Pruebas ejecutadas
- `test_saas_postgres.py`: 72 passed (incluye `test_cu23_devolucion_idempotente_inspeccion_danada_y_reembolso`, `test_cu23_cambio_positivo_cobra_diferencia_sin_doble_stock`, `test_cu23_cambio_negativo_espera_confirmacion_de_reembolso`, `test_cu23_limita_empresa_sucursal_permiso_y_concurrencia`, `test_cu23_fallo_de_trigger_revierte_aprobacion_y_existencias`)
- E2E web (Playwright): 16 passed (incluye escenario de devolución/cambio)

### E2E cubiertos (Playwright, 16 passed)
- Registro público y posterior login
- Recuperación mediante receptor local, cambio de contraseña y login
- Devolución/cambio: guardar intención, recargar, recuperar el mismo UUID y reenviar
- Pérdida de respuesta después del commit: un solo resultado y una sola afectación económica/inventario
- Cambio de cuenta o empresa sin recuperar una intención ajena

---

## 6. CU27 documental — Venta presencial offline móvil (BLOQUEADO)

### Estado
**bloqueado** — requiere Android SDK, dispositivo/emulador y aceptación de licencias. No hay hardware disponible para ejecutar la aplicación móvil nativa contra la API.

### Evidencia localizada
- La aplicación móvil existe en `liveclothesshop_mobile/` con `offline_database.dart` (SQLite como cola activa) y `offline_sync.dart` (sincronización y replay).
- Pero no se puede compilar ni instalar sin Android SDK.
- `pubspec.yaml` incluye `sqflite`, `workmanager`, `path_provider` — dependencias listas para usar una vez que haya SDK.

### Causa demostrable del bloqueo
- `adb`, `emulator`, `sdkmanager` no están instalados.
- No se puede ejecutar `flutter doctor`, `flutter build apk`, ni `flutter run`.
- No se puede verificar SQLite como cola activa en dispositivo real, ni la coordinación de Workmanager en segundo plano.

### Archivo de acciones para el usuario
`C:\SI2_Parcial1\ACCIONES_USUARIO_ANDROID.md` — pasos exactos para instalar SDK, aceptar licencias, crear emulador y conectar a la API de pruebas.

### Siguiente acción
El usuario debe instalar Android SDK y dispositivo/emulador para verificar CU27 en dispositivo real.

---

## 7. Resultados de pruebas (esta sesión)

| Alcance | Resultado | Nota |
|---|---|---|
| API CU24 recomendación IA (inferencia real Qwen vs PG) | 1 passed | `origen="modelo"`, 5 productos existentes de manaco verificados |
| API CU24 recomendación IA (modelo simulado) | 6 passed | Origen, IDs válidos, fallback heurístico |
| API PG completa (`test_saas_postgres.py`) | 72 passed, 0 failed | Incluye CU25 (reservas) y CU26 (devoluciones/cambios) |
| Web unitarias | 743 passed, 52 archivos | Incluye `operaciones-cu21-cu25.spec.ts` (idOperacion) y `dinamicos.spec.ts` |
| Build web | Aprobado | `ng build` |
| E2E web reales (Playwright) | 16 passed | Registro, recuperación, devolución/cambio con recarga, pérdida de respuesta, cambio de cuenta |
| API SQLite completa | 1188 passed, 0 failed | Sin regresiones |

Los conteos de snapshots anteriores (1233 API / 741 web / 15 E2E / 71 Flutter) **no se presentan como validación del código actual**.

---

## 8. Flujos simulados y verificaciones externas pendientes

| Elemento | Estado | Nota |
|---|---|---|
| Inferencia real Qwen con cliente con historial (`tipo="personalizada"`) | Pendiente | Lógica implementada, requiere recursos de CPU/memoria |
| Android SDK / dispositivo / emulador | Bloqueado | `ACCIONES_USUARIO_ANDROID.md` detalla pasos |
| Ejecución móvil nativa contra API | Bloqueado | Sin SDK ni dispositivo |
| Workmanager en segundo plano | Bloqueado | Requiere dispositivo Android |
| Stripe sandbox / reembolso confirmado | Pendiente | Sin autorización explícita; no se realizaron cargos reales |
| Micrófono real (CU29, fuera de este bloque) | Pendiente | Sin hardware de audio |

---

## 9. Guía reproducible de demostración

### Requisitos
- Python venv en `LiveClothesShop-api`
- Node en `LiveClothesShop-web`
- PostgreSQL en `127.0.0.1:55432/fashionstore_test` (clúster en `.tmp/pgdata`, ya levantado)

### Comandos

**1. API — CU24 recomendaciones IA (inferencia real Qwen):**
```powershell
cd LiveClothesShop-api
.venv\Scripts\python.exe -m pytest tests/test_cu24_recomendacion_ia_pg.py -q
```
Esperado: 1 passed (origen="modelo", IDs existentes en manaco).

**2. API — CU25/CU26 reservas y devoluciones (suite PG):**
```powershell
.venv\Scripts\python.exe -m pytest tests/test_saas_postgres.py -q
```
Esperado: 72 passed.

**3. Web:**
```powershell
cd LiveClothesShop-web
npm test -- --watch=false
npm run build
```
Esperado: 743 passed, build aprobado.

**4. E2E web reales:**
```powershell
npm run test:e2e
```
Esperado: 16 passed.

**5. Móvil nativo (CU23/CU27):**
Bloqueado — ver `ACCIONES_USUARIO_ANDROID.md`.

---

## 10. Pendientes y estado Git

### Pendientes (no declarar como completos)
- Inferencia real de Qwen con cliente con historial (`tipo="personalizada"`, `origen="modelo"`) — requiere recursos de CPU
- Ejecución móvil nativa, Workmanager, venta offline (CU27) — bloqueado sin SDK/dispositivo
- Vestidor virtual AR (CU23) — bloqueado sin SDK/dispositivo/dispositivo con cámara
- Verificación de pagos Stripe sandbox — solo con autorización explícita
- Micrófono real (CU29, fuera de este bloque)

### Estado Git (rama `dev-peco`, sin staging ni commit)
| Repositorio | Rama / HEAD | Cambios locales |
|---|---|---|
| API | `cce4606` | 10 archivos modificados (CU24 recomendaciones IA, modelo `recuperacion_contrasena.idemp`, políticas RLS, procedimiento `sp_cambiar_contrasena`) sin staging |
| WEB | `4c13cf6` | 1 archivo modificado (`devoluciones.ts`, idOperacion en sessionStorage) sin staging |
| MOBILE | `eeee69e` | Limpio, sin cambios |

- `git diff --check`: aprobado (solo avisos LF/CRLF previos).
- No se hicieron commit, push, merge, reset, clean, stash ni despliegue.
- Los informes y `.tmp/` están fuera de los worktrees Git.

### Cambios de esquema en PostgreSQL (base de pruebas, no recreada ni vaciada)
- Tabla `recuperacion_contrasena`: política RLS redefinida (`SELECT` sin restricción de tenant; `INSERT/UPDATE/DELETE` con `USING` + `WITH CHECK (idemp = fn_idemp_actual())`).
- Procedimiento `sp_cambiar_contrasena` creado (faltaba en la base de pruebas).
- Ninguna tabla recreada, ninguna fila histórica borrada, `pg_hba.conf` sin cambios.

---

## 11. Resumen de estados (leyenda)

| Estado | Significado |
|---|---|
| **verificado** | Pruebas reales ejecutadas y aprobadas en esta sesión (CU24, CU25, CU26) |
| **parcial** | Funcionalidad implementada parcialmente; faltan pruebas clave |
| **implementado sin verificar** | Código implementado pero sin ejecución real que lo acredite |
| **pendiente** | Diseñado/planeado, sin implementación completa |
| **bloqueado** | Bloqueado por dependencia externa (Android SDK, dispositivo, micrófono, autorización de pagos); documentado, no simualdo |

### Clasificación final de los cinco CUs

| CU | Estado | Justificación |
|---|---|---|
| CU23 — Vestidor AR | **bloqueado** | Sin Android SDK ni dispositivo; no se puede verificar en dispositivo real |
| CU24 — Recomendaciones IA | **verificado** | Inferencia real Qwen contra PG, `origen="modelo"`, IDs existentes verificados en BD |
| CU25 — Atención de reservas | **verificado** | 72 pruebas PG pasadas, servicio backend completo, E2E web 16 passed |
| CU26 — Devoluciones/cambios | **verificado** | 72 pruebas PG pasadas, servicio backend completo, E2E web 16 passed |
| CU27 — Venta offline móvil | **bloqueado** | Sin Android SDK ni dispositivo; no se puede ejecutar móvil nativo |

### Siguiente acción exacta
1. El usuario instala Android SDK y acepta licencias (ver `ACCIONES_USUARIO_ANDROID.md`).
2. Una vez haya dispositivo/emulador, ejecutar `flutter run` y verificar CU23 (AR) y CU27 (venta offline) contra la API en `127.0.0.1:8000`.
3. Cuando haya recursos de CPU, ejecutar inferencia Qwen con cliente con historial para verificar `tipo="personalizada"` con `origen="modelo"`.
4. No hay pruebas PG ni E2E pendientes de ejecución en este cierre.
