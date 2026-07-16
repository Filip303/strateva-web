# Wireframes textuales — Simulador (v1)

> Solo simulación. El disclaimer de «Strateva no ejecuta, custodia ni mueve
> fondos» acompaña **siempre** al CTA y a los resultados. Todos los datos
> provienen del contrato HTTP público.

Wireframes de baja fidelidad (solo estructura, no diseño). Cubren escritorio y
móvil, el formulario del simulador, el estado de carga, el resultado recomendado
con alternativas, el desglose por tramo y los estados de error (404, 422, 429,
5xx y timeout).

Leyenda: `[ ]` campo, `( )` control/botón, `▸` elemento plegable, `···` repetible.

---

## 1. Simulador — escritorio (dos columnas)

```
┌──────────────────────────────────────────────────────────────┐
│  Strateva Payment Router · Simulador                          │
│  ⚠ Solo simulación. No se mueve dinero real.                  │
├───────────────────────────┬──────────────────────────────────┤
│  FORMULARIO               │  RESULTADOS                        │
│                           │                                    │
│  Corredor                 │  (vacío al inicio: texto guía      │
│  [ EUR → MXN        ▾ ]   │   "Rellena el formulario y pulsa   │
│   (opciones desde API)    │    Comparar rutas")                │
│                           │                                    │
│  Importe                  │                                    │
│  [ 1000        ] EUR      │                                    │
│                           │                                    │
│  Objetivo                 │                                    │
│  ( ) Más barato           │                                    │
│  ( ) Más rápido           │                                    │
│  ( ) Más fiable           │                                    │
│  (•) Equilibrado          │                                    │
│                           │                                    │
│  ▸ Opciones avanzadas     │                                    │
│    (límites: coste máx.,  │                                    │
│     tiempo máx., fiab.    │                                    │
│     mín., exclusiones)    │                                    │
│                           │                                    │
│  ( Comparar rutas )       │                                    │
│  ⚠ Resultado simulado.    │                                    │
└───────────────────────────┴──────────────────────────────────┘
```

- «Corredor» se rellena con `GET /api/v1/corridors` (nunca hardcode).
- Moneda de importe = `source_currency` del corredor elegido.
- «Opciones avanzadas» mapea a `maximum_cost_percentage`,
  `maximum_conservative_time_minutes`, `minimum_reliability`,
  `excluded_providers`, `excluded_networks`.
- CTA permitido: **«Comparar rutas»** (alternativa: «Simular ruta»). El
  disclaimer aparece pegado al CTA.

## 2. Simulador — móvil (una columna, apilado)

```
┌─────────────────────────┐
│ Strateva · Simulador    │
│ ⚠ Solo simulación.      │
├─────────────────────────┤
│ Corredor [ EUR→MXN ▾ ]  │
│ Importe  [ 1000 ] EUR   │
│ Objetivo                │
│  (•) Equilibrado ▾      │
│ ▸ Opciones avanzadas    │
│ ( Comparar rutas )      │
│ ⚠ Resultado simulado.   │
├─────────────────────────┤
│ RESULTADOS (debajo)     │
│  … (tras enviar)        │
└─────────────────────────┘
```

En móvil los resultados se muestran **debajo** del formulario; el foco salta al
bloque de resultados al completarse la llamada.

---

## 3. Estado de carga

```
┌──────────────────────────────────────┐
│ RESULTADOS                            │
│  ⏳ Comparando rutas simuladas…       │
│  [░░░░░░░░░  ] (indicador indeterm.)  │
│  (el botón queda deshabilitado)       │
└──────────────────────────────────────┘
```

- Se muestra mientras `POST /api/v1/routes/quote` está en curso.
- Botón deshabilitado para evitar envíos duplicados.
- Debe existir un **timeout** de cliente (ver estado Timeout).

---

## 4. Resultado — ruta recomendada + alternativas

```
┌───────────────────────────────────────────────────────────┐
│ RESULTADOS                                                 │
│ ⚠ Resultado simulado. Nada se ejecuta ni se envía.         │
│ Enviado: 1000 EUR → MXN · Objetivo: Equilibrado            │
│ Simulación válida hasta: {quote_expires_at}                │
│                                                            │
│ ┌─ RECOMENDADA ───────────────────────────────────────┐   │
│ │ Recibe (aprox.): {estimated_received_amount} MXN     │   │
│ │ Coste total: {total_cost} ({total_cost_percentage}%) │   │
│ │ FX efectivo: {effective_fx_rate}                     │   │
│ │ Tiempo esperado: {expected_time_seconds}             │   │
│ │ Tiempo conservador: {conservative_time_seconds}      │   │
│ │ Fiat disponible en ~: {time_to_fiat_available_secs}  │   │
│ │ Fiabilidad: {reliability_score}                      │   │
│ │ 24/7: {operates_24_7 ? "Sí" : "No"}                  │   │
│ │ Por qué: {explanation}                               │   │
│ │ ⚠ {warnings…}                                        │   │
│ │ ▸ Ver desglose por tramo                             │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ Alternativas                                               │
│ ┌─ Alternativa #1 ──────────────────────────────────┐ ··· │
│ │ Recibe ~ · Coste % · Tiempo · Fiabilidad          │     │
│ │ ⚠ {warnings…}  ▸ Ver desglose por tramo           │     │
│ └────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────┘
```

- Los nombres entre `{ }` son campos reales de `PublicRouteResult` (ver
  `API_UI_MAPPING.md`). No se muestra ninguna cifra que la API no devuelva.
- Los tiempos se presentan de forma legible pero honesta: «conservador», nunca
  «p95» (ver `TERMINOLOGY_AND_COPY.md`).
- Cada ruta con pasos on-chain arrastra su warning de datos simulados.

---

## 5. Desglose por tramo (plegable dentro de cada ruta)

```
▾ Desglose por tramo
 ┌ Tramo 0 · sepa_transfer · mock_sepa ───────────────┐
 │ EUR (ES, sepa) → EUR (ES, provider_internal)       │
 │ Entra 1000.00 → Sale 1000.00                       │
 │ Comisión fija 0 · % 0 · spread 0                    │
 │ Tiempo ~3600 s · Fiabilidad 0.995                  │
 └────────────────────────────────────────────────────┘
 ┌ Tramo 1 · provider_transfer · mock_globalremit ────┐ ···
 │ …                                                  │
 └────────────────────────────────────────────────────┘
 (opcional) Latencia por tramo:
   componente · esperado/conservador · disponibilidad ·
   procedencia (sintético/declarativo/observado) ·
   objetivo de confirmación (included/safe/finalized) —
   NO es fiat disponible.
```

- Campos por tramo = `RouteStep` (position, source/destination node, provider,
  operation_type, fixed_fee, percentage_fee_amount, spread_cost,
  estimated_time_seconds, reliability_score, amount_in, amount_out).
- La latencia por tramo, si se muestra, usa `latency_legs` (component, expected/
  conservative, availability, provenance, confirmation_target, fallback_reason).

---

## 6. Estados de error

Todos se muestran en el bloque de resultados, conservando el formulario y el
disclaimer. El texto es humano; el detalle técnico crudo no se expone.

### 6.1 · 404 — corredor no modelado
```
┌ RESULTADOS ─────────────────────────────────────┐
│ ⚠ Ese corredor no está disponible en la          │
│   simulación. Elige otro de la lista.            │
│ ( Volver a elegir corredor )                     │
└──────────────────────────────────────────────────┘
```
Origen: `POST /api/v1/routes/quote` → 404 (corredor no modelado) o corredor
ausente en `GET /api/v1/corridors`.

### 6.2 · 422 — entrada inválida o sin ruta viable
```
┌ RESULTADOS ─────────────────────────────────────┐
│ ⚠ No hay ninguna ruta que cumpla lo pedido, o    │
│   algún dato no es válido.                        │
│   {detalle legible: p. ej. "el importe debe ser  │
│    mayor que 0" o "ninguna ruta bajo tus límites"}│
│ ( Ajustar importe / objetivo / límites )         │
└──────────────────────────────────────────────────┘
```
Origen: validación de formulario o 422 del backend (input inválido o ninguna
ruta bajo los guardrails).

### 6.3 · 429 — demasiadas peticiones
```
┌ RESULTADOS ─────────────────────────────────────┐
│ ⚠ Demasiadas simulaciones seguidas. Espera unos  │
│   segundos y vuelve a intentarlo.                │
│ ( Reintentar ) (deshabilitado unos segundos)     │
└──────────────────────────────────────────────────┘
```
Origen: rate limiting del backend. Reintento con espera; nunca en bucle.

### 6.4 · 5xx — error del servidor / datos de mercado no disponibles
```
┌ RESULTADOS ─────────────────────────────────────┐
│ ⚠ La simulación no está disponible ahora mismo.  │
│   Inténtalo de nuevo en un momento.              │
│ ( Reintentar )                                   │
└──────────────────────────────────────────────────┘
```
Origen: 500/502/503 (incl. 503 «market data temporarily unavailable» / «quote
expired before it could be served»). Mensaje genérico; sin trazas técnicas.

### 6.5 · Timeout — sin respuesta a tiempo
```
┌ RESULTADOS ─────────────────────────────────────┐
│ ⚠ La simulación ha tardado demasiado. Puede ser  │
│   algo temporal.                                 │
│ ( Reintentar )                                   │
└──────────────────────────────────────────────────┘
```
Origen: se supera el timeout de cliente antes de recibir respuesta. La petición
se cancela y se ofrece reintentar.
