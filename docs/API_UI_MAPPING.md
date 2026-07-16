# Mapeo API ↔ UI — Strateva Web (v1)

> Solo simulación. Este documento mapea el **contrato HTTP público real** del
> backend a los componentes visuales de la web. No inventa campos ni corredores.

## Fuente del contrato

- Repositorio backend público: `Filip303/strateva-payment-router`.
- Commit de referencia (contrato desplegado):
  **`a697ca08348d0f1ec19bcb715c7a54ce6dff625f`**.
- Definición autoritativa de los esquemas (leída de este commit):
  - `backend/src/strateva/api/routes.py` (endpoints y códigos de estado),
  - `backend/src/strateva/api/schemas.py` (esquemas HTTP),
  - `backend/src/strateva/api/public.py` (proyección pública de la ruta).
- **La única fuente de verdad de los campos es el código del esquema en ese
  commit.** Ver la nota de *gap* sobre `examples/quote-response.json` al final.

Regla general: la web **solo** renderiza campos presentes en estos esquemas. Si
un dato no está, se marca como *gap* (pendiente en la API), nunca se inventa.

### Campos obligatorios vs. visualización opcional

En este documento se distingue explícitamente entre dos cosas que no deben
confundirse:

- **«Obligatorio en la API»**: el esquema del backend siempre entrega el campo.
- **«La UI puede no mostrarlo»**: decisión de presentación del componente; el
  campo sigue llegando en la respuesta.

Cuando una anotación diga «UI: opcional mostrarlo» significa lo segundo, nunca
que el campo pueda faltar en el contrato.

---

## Endpoints consumidos por la v1

| Método | Ruta                          | Uso en la web                                  |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/v1/corridors`           | Poblar el selector de corredores.              |
| GET    | `/api/v1/corridors/{id}`      | Detalle de corredor (familias, pares, redes).  |
| POST   | `/api/v1/routes/quote`        | Simular y comparar rutas.                       |
| GET    | `/health`                     | (Opcional para la UI) estado del servicio.      |

`/ready`, `/api/v1/providers` y `/api/v1/providers/health` existen en el backend
pero **no** son necesarios para la UI de v1 (uso interno/diagnóstico).

---

## 1) `GET /api/v1/corridors` → selector de corredores

Respuesta: lista de `CorridorInfo`.

| Campo API                | Tipo   | Componente UI                                  |
|--------------------------|--------|------------------------------------------------|
| `corridor_id`            | string | valor interno de la opción del selector.        |
| `origin_country`         | string | código ISO país origen (para etiqueta/bandera). |
| `destination_country`    | string | código ISO país destino.                        |
| `source_currency`        | string | moneda del campo importe.                        |
| `destination_currency`   | string | moneda del resultado recibido.                   |

- El selector se construye **enteramente** con esta respuesta. No se codifican
  EUR→MXN ni GBP→EUR en el frontend; se muestran porque la API los devuelve.
- **Gap:** la API no devuelve un nombre legible del corredor ni de la moneda
  (solo códigos ISO). La etiqueta visible («EUR → MXN») se compone en el cliente
  a partir de los códigos; cualquier nombre «bonito» es presentación de UI, no
  un dato de la API.

## 2) `GET /api/v1/corridors/{id}` → detalle de corredor

Respuesta: `CorridorDetail`.

| Campo API             | Componente UI                                            |
|-----------------------|---------------------------------------------------------|
| `corridor_id`         | título/identificador.                                    |
| `origin_country` / `destination_country` | encabezado del corredor.             |
| `source_currency` / `destination_currency` | encabezado del corredor.           |
| `simulation_only`     | refuerza el disclaimer (siempre `true`).                 |
| `market_pairs`        | lista de pares de mercado (p. ej. `EURMXN`).             |
| `route_families[]`    | tarjetas de «familias de ruta» disponibles.              |

Cada `route_families[]` = `RouteFamilyInfo`:

| Campo                     | Componente UI                                        |
|---------------------------|------------------------------------------------------|
| `family_id`               | id de la tarjeta de familia.                          |
| `label`                   | título legible de la familia.                         |
| `enabled`                 | badge disponible / no disponible.                     |
| `simulated`               | badge «simulado» (siempre true).                      |
| `required_provider`       | nota «requiere proveedor X» (o ninguno).              |
| `providers[]`             | chips de proveedores.                                 |
| `networks[]`              | chips de redes (p. ej. `sepa`, `base`, `spei`).       |
| `operations[]`            | secuencia de operaciones (`tipo:activo->activo`).     |
| `chain_confirmations[]`   | por tramo on-chain: `edge_id` + `confirmation_target`.|
| `offramp_acceptances[]`   | por off-ramp: `minimum_confirmation_target`, `simulated`. |

- `confirmation_target` ∈ {`included`, `safe`, `finalized`}. Es un **objetivo de
  confirmación en cadena**, **no** disponibilidad de fiat (ver terminología).

## 3) `POST /api/v1/routes/quote` → simulador

### 3.1 Petición — `QuoteRequestBody`

| Campo API                            | Control de formulario                        | Reglas |
|--------------------------------------|----------------------------------------------|--------|
| `origin_country`                     | derivado del corredor elegido                | 2 letras |
| `destination_country`                | derivado del corredor elegido                | 2 letras |
| `source_currency`                    | derivado del corredor elegido                | 3 letras |
| `destination_currency`               | derivado del corredor elegido                | 3 letras |
| `amount`                             | campo importe                                | > 0 |
| `objective`                          | selector de objetivo                         | enum fijo: `cheapest`/`fastest`/`most_reliable`/`balanced` (def. `balanced`) |
| `maximum_time_minutes`               | opción avanzada (opcional en la petición)    | > 0 |
| `maximum_cost_percentage`            | opción avanzada (opcional en la petición)    | > 0, ≤ 100 |
| `maximum_conservative_time_minutes`  | opción avanzada (opcional en la petición)    | > 0 |
| `minimum_reliability`                | opción avanzada (opcional en la petición)    | 0.0–1.0 |
| `excluded_providers[]`               | opción avanzada (opcional en la petición)    | lista |
| `excluded_networks[]`                | opción avanzada (opcional en la petición)    | lista |

- Los cuatro campos de país/moneda **no** son inputs libres: se derivan del
  corredor seleccionado (que viene de la API).
- `objective` es un **enum fijo del contrato público**: la API no ofrece un
  endpoint de metadatos que enumere los objetivos, así que el frontend
  implementa y valida exactamente esos cuatro valores. Solo los corredores se
  descubren dinámicamente. (Ver *gaps*.)

### 3.2 Respuesta — `QuoteResponse`

Todos los campos son obligatorios en el contrato.

| Campo API              | Componente UI                                             |
|------------------------|----------------------------------------------------------|
| `disclaimer`           | banner de simulación junto a los resultados.              |
| `simulation_only`      | refuerzo del disclaimer (siempre `true`).                 |
| `generated_at`         | marca de generación (UI: opcional mostrarla).             |
| `quote_expires_at`     | «Validez de la recomendada hasta…» (ver nota de caducidad). |
| `sent_amount`          | «Enviado: … {source_currency}».                           |
| `source_currency`      | moneda enviada.                                           |
| `destination_currency` | moneda recibida.                                          |
| `objective`            | objetivo aplicado (eco del elegido).                      |
| `recommended_route`    | tarjeta **RECOMENDADA** (ver 3.3).                        |
| `alternative_routes[]` | tarjetas de alternativas (ver 3.3).                       |
| `warnings[]`           | avisos a nivel de respuesta.                              |
| `provider_failures[]`  | lista **siempre presente, posiblemente vacía** de fallos de proveedor; UI: opcional mostrarla. |

**Caducidad:** `quote_expires_at` es la **validez efectiva de la ruta
recomendada** — el mínimo entre la caducidad propia de esa ruta (cotizaciones
de proveedor y snapshot de mercado) y el TTL del servidor. **No** describe a las
alternativas: **cada ruta**, alternativas incluidas, lleva su propio
`expires_at` (ver 3.3), y la UI no debe sugerir que todas caducan a la vez.

### 3.3 Ruta — `PublicRouteResult` (recomendada y cada alternativa)

Todos los campos son **obligatorios en el contrato**; donde pone «UI: opcional
mostrarlo» es una decisión de presentación, no una ausencia posible del campo.

| Campo API                         | Componente UI                                    |
|-----------------------------------|--------------------------------------------------|
| `route_id`                        | id interno de la tarjeta.                         |
| `simulation_only`                 | refuerzo del disclaimer.                          |
| `steps[]`                         | desglose por tramo (ver 3.4).                     |
| `total_cost`                      | «Coste total» — **denominado en `destination_currency`**. |
| `total_cost_percentage`           | «Coste total (%)» — porcentaje.                   |
| `total_time_seconds`              | tiempo total (= esperado).                        |
| `expected_time_seconds`           | «Tiempo esperado».                                |
| `conservative_time_seconds`       | «Tiempo conservador» (NO «p95»).                  |
| `time_to_fiat_available_seconds`  | «Fiat disponible en ~» (tiempo hasta fiat útil).  |
| `latency_breakdown[]`             | obligatorio en la API; tiempos por componente (UI: opcional mostrarlo). |
| `latency_legs[]`                  | obligatorio en la API; latencia por tramo (ver 3.5) (UI: opcional mostrarlo). |
| `operates_24_7`                   | badge «24/7: Sí/No».                              |
| `effective_fx_rate`               | «FX efectivo (simulado)» — tasa efectiva extremo a extremo (ver «Monedas y unidades»). |
| `estimated_received_amount`       | «Recibe (aprox.) … {destination_currency}».       |
| `reliability_score`               | «Fiabilidad».                                     |
| `objective_score`                 | obligatorio en la API; puntuación del objetivo (UI: opcional mostrarlo). |
| `expires_at`                      | caducidad **propia de esta ruta** (también en cada alternativa); base de `quote_expires_at` para la recomendada. |
| `explanation`                     | «Por qué se recomienda».                          |
| `warnings[]`                      | avisos de la ruta (p. ej. datos on-chain simulados).|

### 3.4 Tramo — `RouteStep` (dentro de `steps[]`)

| Campo API                 | Componente UI                                   |
|---------------------------|-------------------------------------------------|
| `position`                | orden del tramo.                                 |
| `source_node`             | nodo origen (asset, network, country, account…). |
| `destination_node`        | nodo destino.                                    |
| `provider`                | proveedor del tramo.                             |
| `operation_type`          | tipo de operación (sepa_transfer, fx_conversion, onramp, offramp, bridge, local_payout, swift_transfer…). |
| `fixed_fee`               | comisión fija — **denominada en `source_node.asset`** (activo de entrada del tramo). |
| `percentage_fee_amount`   | comisión porcentual (importe) — **denominada en `source_node.asset`**. |
| `spread_cost`             | coste de spread FX — **denominado en `destination_node.asset`** (activo de salida del tramo). |
| `estimated_time_seconds`  | tiempo del tramo.                                |
| `reliability_score`       | fiabilidad del tramo.                            |
| `amount_in` / `amount_out`| «entra / sale» por tramo — en `source_node.asset` / `destination_node.asset` respectivamente. |

### 3.5 Latencia por tramo — `PublicLatencyLeg` (dentro de `latency_legs[]`)

| Campo API              | Componente UI                                       |
|------------------------|-----------------------------------------------------|
| `position` / `edge_id` | identificación del tramo.                            |
| `provider`             | proveedor.                                           |
| `component`            | componente (FUNDING, ONRAMP, CHAIN_CONFIRMATION, BRIDGE, OFFRAMP, FIAT_PAYOUT, BANK_SETTLEMENT). |
| `confirmation_target`  | included/safe/finalized (solo tramo on-chain). **No** es fiat disponible. |
| `expected_seconds`     | tiempo esperado del tramo.                            |
| `conservative_seconds` | tiempo conservador del tramo.                        |
| `availability`         | `continuous` / `banking_hours`.                     |
| `basis`                | `operational_duration` (hoy) / `calendar_elapsed` (reservado). |
| `latency_source`       | **solo** `observed` o `declarative`.                 |
| `provenance`           | **solo** `observed`, `declarative` o `fallback`.     |
| `fallback_reason`      | código estable (cuando `provenance = fallback`: existía evidencia observada, fue rechazada y se conservaron los tiempos declarativos). |
| `as_of` / `valid_until`| fechas de la evidencia observada (solo tramos `observed`). |

- El DTO público **no** expone ningún campo `source`: la distinción interna
  entre latencia sintética y contractual **no cruza la frontera pública** y la
  UI no debe inventarla ni mostrar «sintético» como valor por tramo.

---

## Monedas y unidades (obligatorio en la UI)

Ninguna cifra financiera se muestra sin su moneda o activo:

- `total_cost` → en **`destination_currency`** de la respuesta.
- `estimated_received_amount` → en `destination_currency`.
- `sent_amount` → en `source_currency`.
- Por tramo: `fixed_fee` y `percentage_fee_amount` → en **`source_node.asset`**
  (activo de entrada del tramo); `spread_cost` → en
  **`destination_node.asset`** (activo de salida); `amount_in` / `amount_out`
  → en el activo de entrada / salida respectivamente.
- `total_cost_percentage` → porcentaje (se mantiene como %).
- `effective_fx_rate` → se presenta como **tasa efectiva simulada de extremo a
  extremo**: `estimated_received_amount / sent_amount`, es decir, unidades de
  destino por unidad de origen **después de todos los costes**. **No** es un
  tipo real de mercado ni un tipo medio; el copy no debe presentarlo como tal.

El formato visual (separadores, símbolo, redondeo de visualización) es
responsabilidad de la UI y no debe alterar la cifra recibida.

---

## Distinción de tiempos (obligatoria en la UI)

El backend expone **tres** magnitudes de tiempo distintas; la web no debe
confundirlas ni sustituir una por otra:

1. **Tiempo esperado** (`expected_time_seconds`) — suma de tiempos esperados por
   tramo; es el tiempo «típico».
2. **Tiempo conservador** (`conservative_time_seconds`) — suma de cotas
   conservadoras por tramo. Es un límite prudente, **no** un p95 (el p95 de una
   suma no es la suma de p95). Etiqueta: «conservador».
3. **Fiat disponible** (`time_to_fiat_available_seconds`) — tiempo (conservador)
   hasta que el receptor tiene **fiat gastable** en su banco de destino. La
   confirmación en cadena **no** es fiat disponible: una ruta con blockchain
   rápida pero off-ramp lento reporta aquí el tiempo del off-ramp/payout.

`operates_24_7` indica si **todos** los tramos usan raíles continuos; es un flag
descriptivo, no un cálculo de calendario/festivos.

---

## Validación del contrato en el frontend (futura)

El JSON de ejemplo del backend **no modifica el contrato**: la fuente de verdad
es el código del esquema al commit de referencia. Cuando exista código, el
frontend validará las respuestas contra el contrato: si en una respuesta real
faltara un campo **obligatorio** (p. ej. `latency_legs` u `objective_score`),
la validación debe **fallar de forma segura** y mostrar el estado de error
sanitizado — nunca aceptar la respuesta como válida ni renderizar datos a
medias.

---

## Gaps (lo que la API todavía NO proporciona)

Marcado explícitamente como *gap*, nunca presentado como dato existente:

- **Sin endpoint de metadatos de objetivos**: la API no expone ningún endpoint
  para descubrir los objetivos de optimización. El frontend implementa y valida
  los cuatro valores exactos del enum público (`cheapest`, `fastest`,
  `most_reliable`, `balanced`); solo los corredores se descargan dinámicamente.
- **Nombres legibles**: la API da códigos ISO de país/moneda e ids de corredor,
  pero **no** nombres localizados de corredor ni de moneda. La UI los compone;
  no son datos del backend.
- **Ejemplo desactualizado (no altera el contrato)**:
  `examples/quote-response.json` (en el repo backend, a este commit) no incluye
  `expected_time_seconds`, `conservative_time_seconds`,
  `time_to_fiat_available_seconds`, `latency_breakdown`, `latency_legs` ni
  `operates_24_7`, pese a que el esquema `PublicRouteResult` **sí** los declara
  como obligatorios en el mismo commit. El código del esquema manda; el JSON de
  ejemplo está atrasado y no debilita el contrato. Si una respuesta real
  incumpliera el esquema, aplica la validación fail-safe descrita arriba.
- **Sin variancia real**: hoy `conservative_seconds` suele igualar
  `expected_seconds` (no hay distribuciones por tramo). No hay ningún campo de
  percentil; no debe mostrarse «p95».
- **Disponibilidad como calendario**: `availability` (`continuous`/
  `banking_hours`) es descriptivo; los tiempos son duraciones operativas, **no**
  ETAs de calendario (no modelan festivos, husos ni cortes). No presentar los
  tiempos como hora de entrega natural.
