# Terminología y copy — Strateva Web (v1)

> Solo simulación. El lenguaje de la web debe reflejar en todo momento que
> Strateva **no ejecuta, custodia, convierte ni transmite fondos**. El copy
> inicial es en español y está preparado para traducción (i18n).

Este documento fija qué se puede decir y qué no, y define los términos clave con
precisión para que el copy sea honesto y consistente con el contrato del backend.

## Principios de copy

1. **Simulación explícita.** Todo texto que muestre cifras va acompañado (o está
   dentro de un contexto) que deja claro que son simuladas.
2. **Sin lenguaje de ejecución.** Nada sugiere que se mueva dinero.
3. **Sin cifras inventadas.** No se afirman métricas, plazos ni ahorros que la
   API no devuelva. Toda cifra financiera se muestra con su moneda o activo.
4. **Preparado para i18n.** El copy se redacta como cadenas traducibles; se
   evita concatenar frases o incrustar datos dentro del texto de forma que
   impida traducir.

## Texto permitido

- CTA: **«Comparar rutas»**, **«Simular ruta»**.
- Verbos: comparar, simular, estimar, mostrar, ordenar, explicar.
- «Resultado simulado», «datos sintéticos», «ruta recomendada», «alternativas».
- Etiquetas de objetivo: **«Priorizar coste»**, **«Priorizar velocidad»**,
  **«Priorizar fiabilidad»**, **«Equilibrado»**.

## Texto prohibido

- CTA o verbos de movimiento de dinero: **«Enviar»**, **«Pagar»**,
  **«Transferir»**, «mandar dinero», «cobrar», «depositar».
- Afirmar que algo es real, ejecutado, liquidado o custodiado.
- Afirmar que un objetivo **garantiza** un óptimo absoluto: `cheapest` no
  garantiza «el coste mínimo» ni `most_reliable` «la fiabilidad máxima» — son
  puntuaciones combinadas que **priorizan** esa dimensión (por eso las etiquetas
  son «Priorizar coste», «Priorizar velocidad», «Priorizar fiabilidad» y
  «Equilibrado»; semántica exacta en `PRODUCT_CONTRACT.md` §4).
- Métricas o promesas no respaldadas por la API: «el más rápido del mercado»,
  «ahorra un X %», «garantizado», cifras de volumen o de usuarios.
- **«p95»**, salvo que se refiera a una **estadística observada real** (hoy no
  existe; ver abajo). El tiempo prudente se llama **«conservador»**.

## Definiciones (explicación sencilla)

### Coste
Cuánto cuesta la ruta de extremo a extremo: comisiones fijas, comisiones
porcentuales y el coste del *spread* de cambio. La API lo da como importe total
(`total_cost`, **denominado en la moneda de destino**, `destination_currency`)
y como porcentaje (`total_cost_percentage`). Por tramo, `fixed_fee` y
`percentage_fee_amount` están denominados en el activo de **entrada** del tramo
(`source_node.asset`) y `spread_cost` en el activo de **salida**
(`destination_node.asset`); el copy y la UI muestran siempre esas unidades.

### FX efectivo (`effective_fx_rate`)
La **tasa efectiva simulada de extremo a extremo**:
`estimated_received_amount / sent_amount` — cuántas unidades de la moneda de
destino resultan por cada unidad de la moneda de origen **después de todos los
costes** (comisiones y spread). **No** es un tipo real de mercado ni un tipo
«medio»: es el resultado neto de la simulación y debe presentarse como tal.

### Fiabilidad (`reliability_score`)
Una puntuación **simulada** (0–1) de qué tan probable es que la ruta complete
sin incidencias, agregada a partir de la fiabilidad de cada tramo. Es sintética:
no refleja rendimiento real de ningún proveedor.

### Tiempo esperado (`expected_time_seconds`)
El tiempo **típico** de la ruta: la suma de los tiempos esperados de cada tramo.

### Tiempo conservador (`conservative_time_seconds`)
Una **cota prudente**: la suma de las cotas conservadoras por tramo. Se llama
«conservador», **no** «p95», porque el p95 de una suma no es la suma de los p95
y hoy no hay datos de variancia por tramo (a menudo coincide con el esperado).

### Fiat disponible (`time_to_fiat_available_seconds`)
El tiempo (conservador) hasta que el receptor tiene **dinero fiat gastable** en
su cuenta bancaria de destino. Es la magnitud «comercial» de velocidad.

### Objetivos («Priorizar…»)
Salvo `fastest`, los objetivos son **puntuaciones ponderadas** sobre valores
normalizados respecto al conjunto de candidatas: `cheapest` pondera 75 % coste,
15 % tiempo y 10 % riesgo; `most_reliable` pondera 75 % riesgo, 15 % coste y
10 % tiempo; `balanced` pondera 45 % coste, 30 % tiempo y 25 % riesgo.
`fastest` ordena lexicográficamente: tiempo conservador hasta fiat disponible,
después tiempo esperado, coste y fiabilidad. El copy dice «prioriza», nunca
«garantiza».

## Confirmación en cadena vs. fiat disponible

Distinción crítica que el copy nunca debe difuminar:

- **Confirmación (blockchain)** = una transacción on-chain alcanza un nivel de
  aseguramiento: `included` (en un bloque), `safe` (bloque justificado, aún
  reversible) o `finalized` (irreversible). Son objetivos **alternativos**, no
  etapas acumulables.
- **Fiat disponible** = el dinero ya está **gastable en el banco de destino**.

Una blockchain rápida **no** significa fiat disponible: después de la
confirmación quedan el off-ramp y el payout. El copy debe presentar la
confirmación en cadena como un paso intermedio, nunca como recepción final.

## «Sintético» (descripción general) vs. procedencia pública por tramo

Son dos planos distintos que el copy no debe mezclar:

**1) Descripción general del modelo.** Los datos económicos y de latencia del
simulador son, hoy, **sintéticos**: plausibles pero inventados. «Sintético» es
una descripción general correcta del producto y puede usarse en disclaimers,
metodología y copy global.

**2) Procedencia pública por tramo.** El DTO público **no** expone ningún campo
`source`: el frontend **no recibe** la distinción interna entre latencia
sintética y contractual, y **no debe inventarla** como si fuera visible. Lo que
sí llega por tramo es:

- `latency_source`: solo **`observed`** o **`declarative`**.
- `provenance`: solo **`observed`**, **`declarative`** o **`fallback`**.
- `provenance = fallback` significa: **existía evidencia observada para el
  tramo, fue rechazada, y se conservaron los tiempos declarativos** (el motivo
  llega como código estable en `fallback_reason`).

Reglas de copy:

- No presentar «sintético» como un valor por tramo: por tramo solo existen
  `observed` / `declarative` / `fallback`.
- No llamar «observado» a lo declarativo. Si un tramo es `observed`, pueden
  mostrarse sus fechas (`as_of` / `valid_until`); si no, se presenta como
  declarativo.
- No inventar una distinción visible entre latencia «sintética» y
  «contractual»: el contrato público no la expone.

## Sobre «p95»

No usar «p95» en la UI mientras el dato no sea una estadística **observada
real**. El backend es explícito: usa «conservador» precisamente para no fingir un
percentil que no calcula. Si en el futuro existieran percentiles observados,
podrían etiquetarse como tales, con su procedencia.

## i18n

- Todo el copy visible es traducible; el español es el idioma de partida.
- Evitar frases construidas por concatenación de fragmentos; usar cadenas
  completas con interpolación de datos claramente separada del texto traducible.
- Los datos numéricos (importes, tipos, tiempos) se **formatean** en la capa de
  presentación según el idioma/locale, sin alterar los valores que da la API.
