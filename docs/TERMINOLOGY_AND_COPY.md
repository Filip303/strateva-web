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
   API no devuelva.
4. **Preparado para i18n.** El copy se redacta como cadenas traducibles; se
   evita concatenar frases o incrustar datos dentro del texto de forma que
   impida traducir.

## Texto permitido

- CTA: **«Comparar rutas»**, **«Simular ruta»**.
- Verbos: comparar, simular, estimar, mostrar, ordenar, explicar.
- «Resultado simulado», «datos sintéticos», «ruta recomendada», «alternativas».
- Etiquetas de objetivo: «Más barato», «Más rápido», «Más fiable»,
  «Equilibrado».

## Texto prohibido

- CTA o verbos de movimiento de dinero: **«Enviar»**, **«Pagar»**,
  **«Transferir»**, «mandar dinero», «cobrar», «depositar».
- Afirmar que algo es real, ejecutado, liquidado o custodiado.
- Métricas o promesas no respaldadas por la API: «el más rápido del mercado»,
  «ahorra un X %», «garantizado», cifras de volumen o de usuarios.
- **«p95»**, salvo que se refiera a una **estadística observada real** (hoy no
  existe; ver abajo). El tiempo prudente se llama **«conservador»**.

## Definiciones (explicación sencilla)

### Coste
Cuánto cuesta la ruta de extremo a extremo: comisiones fijas, comisiones
porcentuales y el coste del *spread* de cambio. La API lo da como importe total
(`total_cost`) y como porcentaje (`total_cost_percentage`).

### FX efectivo (`effective_fx_rate`)
El tipo de cambio **realmente aplicado** de principio a fin, ya incluyendo el
spread. Se interpreta como «unidades de moneda de destino por unidad de moneda
de origen». No es el tipo «medio de mercado», sino el que resulta tras costes.

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

## Datos sintéticos, declarativos y observados

El backend etiqueta la procedencia de cada tiempo (`provenance` / `source`); el
copy debe respetar la distinción y no ascender una categoría a otra:

- **Sintético** (`synthetic`): inventado pero plausible. Es el caso por defecto.
- **Declarativo** (`declarative`): valor fijado en la definición del corredor
  (incluye lo sintético y lo contractual declarado); no es una medición.
- **Observado** (`observed`): medido a partir de datos reales de latencia. Hoy
  está **desactivado por defecto** en el backend.

Regla: no llamar «observado» a lo que es sintético/declarativo. Si un tramo usa
evidencia observada, puede mostrarse su procedencia y sus fechas
(`as_of`/`valid_until`); si no, se presenta como declarativo/sintético.

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
