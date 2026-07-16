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

---

## Endpoints consumidos por la v1

| Método | Ruta                          | Uso en la web                                  |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/v1/corridors`           | Poblar el selector de corredores.              |
| GET    | `/api/v1/corridors/{id}`      | Detalle de corredor (familias, pares, redes).  |
| POST   | `/api/v1/routes/quote`        | Simular y comparar rutas.                       |
| GET    | `/health`                     | (Opcional) estado del servicio.                 |

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
| `objective`                          | selector de objetivo                         | `cheapest`/`fastest`/`most_reliable`/`balanced` (def. `balanced`) |
| `maximum_time_minutes`               | opción avanzada (opcional)                   | > 0 |
| `maximum_cost_percentage`            | opción avanzada (opcional)                   | > 0, ≤ 100 |
| `maximum_conservative_time_minutes`  | opción avanzada (opcional)                   | > 0 |
| `minimum_reliability`                | opción avanzada (opcional)                   | 0.0–1.0 |
| `excluded_providers[]`               | opción avanzada (opcional)                   | lista |
| `excluded_networks[]`                | opción avanzada (opcional)                   | lista |

- Los cuatro campos de país/moneda **no** son inputs libres: se derivan del
  corredor seleccionado (que viene de la API).

### 3.2 Respuesta — `QuoteResponse`

| Campo API              | Componente UI                                             |
|------------------------|----------------------------------------------------------|
| `disclaimer`           | banner de simulación junto a los resultados.              |
| `simulation_only`      | refuerzo del disclaimer (siempre `true`).                 |
| `generated_at`         | marca de generación (opcional en UI).                     |
| `quote_expires_at`     | «Simulación válida hasta…».                                |
| `sent_amount`          | «Enviado: … {source_currency}».                           |
| `source_currency`      | moneda enviada.                                           |
| `destination_currency` | moneda recibida.                                          |
| `objective`            | objetivo aplicado (eco del elegido).                      |
| `recommended_route`    | tarjeta **RECOMENDADA** (ver 3.3).                        |
| `alternative_routes[]` | tarjetas de alternativas (ver 3.3).                       |
| `warnings[]`           | avisos a nivel de respuesta.                              |
| `provider_failures[]`  | (opcional) nota de fallos de proveedor observados.        |

### 3.3 Ruta — `PublicRouteResult` (recomendada y cada alternativa)

| Campo API                         | Componente UI                                    |
|-----------------------------------|--------------------------------------------------|
| `route_id`                        | id interno de la tarjeta.                         |
| `simulation_only`                 | refuerzo del disclaimer.                          |
| `steps[]`                         | desglose por tramo (ver 3.4).                     |
| `total_cost`                      | «Coste total».                                    |
| `total_cost_percentage`           | «Coste total (%)».                                |
| `total_time_seconds`             | tiempo total (= esperado).                        |
| `expected_time_seconds`           | «Tiempo esperado».                                |
| `conservative_time_seconds`       | «Tiempo conservador» (NO «p95»).                  |
| `time_to_fiat_available_seconds`  | «Fiat disponible en ~» (tiempo hasta fiat útil).  |
| `latency_breakdown[]`             | (opcional) tiempos por componente.                |
| `latency_legs[]`                  | (opcional) latencia por tramo (ver 3.5).          |
| `operates_24_7`                   | badge «24/7: Sí/No».                              |
| `effective_fx_rate`               | «FX efectivo».                                    |
| `estimated_received_amount`       | «Recibe (aprox.) … {destination_currency}».       |
| `reliability_score`               | «Fiabilidad».                                     |
| `objective_score`                 | (opcional) puntuación del objetivo.               |
| `expires_at`                      | caducidad de la ruta (base de `quote_expires_at`).|
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
| `fixed_fee`               | comisión fija.                                   |
| `percentage_fee_amount`   | comisión porcentual (importe).                   |
| `spread_cost`             | coste de spread FX.                              |
| `estimated_time_seconds`  | tiempo del tramo.                                |
| `reliability_score`       | fiabilidad del tramo.                            |
| `amount_in` / `amount_out`| «entra / sale» por tramo.                         |

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
| `latency_source`       | `observed` / `declarative`.                          |
| `provenance`           | `observed` / `declarative` / `fallback`.             |
| `fallback_reason`      | código (si se rechazó evidencia observada).          |
| `as_of` / `valid_until`| fechas de la evidencia observada (si aplica).        |

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

## Gaps (lo que la API todavía NO proporciona)

Marcado explícitamente como *gap*, nunca presentado como dato existente:

- **Nombres legibles**: la API da códigos ISO de país/moneda e ids de corredor,
  pero **no** nombres localizados de corredor ni de moneda. La UI los compone;
  no son datos del backend.
- **Ejemplo desactualizado**: `examples/quote-response.json` (en el repo backend,
  a este commit) **no** incluye `expected_time_seconds`,
  `conservative_time_seconds`, `time_to_fiat_available_seconds`,
  `latency_breakdown`, `latency_legs` ni `operates_24_7`, pese a que el esquema
  `PublicRouteResult` **sí** los declara en el mismo commit. El **código del
  esquema es la fuente de verdad**; el JSON de ejemplo está atrasado. La UI debe
  tolerar su ausencia de forma segura, pero puede contar con ellos según el
  contrato.
- **Sin variancia real**: hoy `conservative_seconds` suele igualar
  `expected_seconds` (no hay distribuciones por tramo). No hay ningún campo de
  percentil; no debe mostrarse «p95».
- **Disponibilidad como calendario**: `availability` (`continuous`/
  `banking_hours`) es descriptivo; los tiempos son duraciones operativas, **no**
  ETAs de calendario (no modelan festivos, husos ni cortes). No presentar los
  tiempos como hora de entrega natural.
- **Presentación de importes/monedas**: la API devuelve valores numéricos y
  códigos ISO; el formato (separadores, símbolo, redondeo de visualización) es
  responsabilidad de la UI y no debe alterar la cifra recibida.
