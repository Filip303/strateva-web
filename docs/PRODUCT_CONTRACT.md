# Contrato de producto — Strateva Web (v1)

> **Solo simulación. Strateva no ejecuta, custodia, convierte ni transmite
> fondos.** Todos los datos mostrados (proveedores, comisiones, FX, tiempos,
> fiabilidad) son sintéticos y provienen de un contrato HTTP público de solo
> lectura.

Este documento recoge las **decisiones de producto aprobadas** para la primera
versión de la web. Es el contrato funcional que la implementación React deberá
respetar. No incluye diseño visual definitivo ni decisiones de código.

## 1. Identidad y posicionamiento

- **Nombre del producto:** «Strateva Payment Router».
- **Posicionamiento:** un **laboratorio / simulador** público de enrutamiento
  de pagos internacionales. No es una pasarela de pago, no es un remesador, no
  es un servicio financiero autorizado.
- **Promesa honesta:** enseñar *cómo se decide* la mejor ruta entre varias
  infraestructuras de pago (banca, SEPA, SWIFT, proveedores, FX, raíles de
  stablecoin) comparando **coste, tiempo y fiabilidad** sobre datos simulados.

## 2. Decisiones de producto aprobadas

1. **Web pública sin registro.** No hay login, cuentas, perfiles ni sesión de
   usuario. Cualquiera puede usar el simulador sin identificarse.
2. **Sin pagos.** No se cobra, no se envía dinero, no hay pasarela. El único
   verbo de la web es *simular / comparar*.
3. **Solo lectura del contrato público.** La web consume exclusivamente la API
   REST pública del backend `Filip303/strateva-payment-router`. No escribe
   estado en el backend.
4. **Datos siempre desde la API.** Los corredores, rutas, comisiones, tiempos,
   FX y fiabilidad se obtienen **en tiempo de ejecución desde la API**. Nada de
   esto se codifica de forma fija («hardcode») en el frontend. Excepción
   explícita: los **objetivos** son un enum fijo del contrato público — la API
   no los expone como metadatos — y el frontend los implementa y valida
   (ver §4).
5. **Idioma inicial español**, con estructura preparada para i18n.
6. **Simulación explícita en toda la superficie.** El disclaimer de «solo
   simulación» acompaña al CTA y a los resultados; los datos on-chain se marcan
   como simulados.

## 3. Corredores iniciales

- Corredores objetivo de la v1: **EUR→MXN** y **GBP→EUR**.
- Ambos se **obtienen siempre desde la API** (`GET /api/v1/corridors`); la web
  no asume su existencia ni sus parámetros. Si la API deja de exponer uno, la
  web deja de ofrecerlo. Si expone más, la web puede mostrarlos sin cambios de
  código (comportamiento data-driven).
- La web **no inventa** corredores, pares de mercado ni orientación de FX: todo
  procede de la respuesta de la API.

## 4. Objetivos de optimización

El simulador permite elegir el objetivo con el que el backend ordena las rutas
candidatas. Los objetivos corresponden 1:1 con el enum público del backend
(`cheapest`, `fastest`, `most_reliable`, `balanced`). Ninguno **garantiza** un
óptimo absoluto: salvo `fastest`, son puntuaciones ponderadas sobre valores
normalizados (min-max) respecto al conjunto de rutas candidatas.

| Objetivo API    | Etiqueta de producto (ES) | Semántica real del backend |
|-----------------|---------------------------|-----------------------------|
| `cheapest`      | Priorizar coste           | Puntuación combinada: 75 % coste, 15 % tiempo, 10 % riesgo. |
| `fastest`       | Priorizar velocidad       | Orden lexicográfico: tiempo conservador hasta fiat disponible → tiempo esperado → coste → fiabilidad. |
| `most_reliable` | Priorizar fiabilidad      | Puntuación combinada: 75 % riesgo, 15 % coste, 10 % tiempo. |
| `balanced`      | Equilibrado               | Puntuación combinada: 45 % coste, 30 % tiempo, 25 % riesgo (defecto). |

- **Sin promesas de óptimo:** el copy no debe afirmar que `cheapest` devuelve
  siempre «el coste mínimo» ni que `most_reliable` devuelve «la fiabilidad
  máxima»: priorizan esa dimensión dentro de una puntuación combinada. Las
  etiquetas honestas son **«Priorizar coste»**, **«Priorizar velocidad»**,
  **«Priorizar fiabilidad»** y **«Equilibrado»**.
- **Enum fijo, no descubrible por API:** la API **no** proporciona un endpoint
  de metadatos para descubrir los objetivos. El frontend implementa y valida
  exactamente estos cuatro valores del enum público; solo los **corredores** se
  descargan dinámicamente. (Registrado como *gap* en `API_UI_MAPPING.md`.)

El objetivo por defecto es **Equilibrado** (`balanced`), igual que el backend.

## 5. Alcance de la v1 (en alcance)

- Un **simulador**: formulario (corredor, importe, objetivo) → llamada a
  `POST /api/v1/routes/quote` → ruta recomendada + alternativas + desglose.
- Páginas informativas: cómo funciona, corredores disponibles, metodología,
  acerca de, y páginas legales (aviso legal, privacidad, cookies).
- Estados de error y de carga tratados como parte del producto (no como
  detalles técnicos): 404, 422, 429, 5xx y timeout.
- Preparación de i18n (español primero).

## 6. Fuera de alcance (explícito)

- Cualquier movimiento de dinero real: envíos, cobros, pagos, custodia, FX real.
- Registro, login, cuentas de usuario o autenticación de cualquier tipo.
- Wallets, conexión a cadenas, firma on-chain.
- Firebase, Supabase o cualquier backend-as-a-service; analytics o tracking.
- Persistencia de importes o respuestas en el navegador (`localStorage` u otros).
- KYC/AML, precios reales, integraciones con proveedores reales en producción.
- CTAs que impliquen ejecutar dinero («Enviar», «Pagar», «Transferir»).
- Decisiones de diseño visual definitivo, elección de framework de estilos,
  configuración de hosting y workflows de despliegue (se deciden más adelante).

## 7. Principios que la implementación debe respetar

- **Honestidad de datos:** no mostrar ninguna cifra que la API no devuelva; no
  presentar datos sintéticos como observados; no usar «p95» salvo para una
  estadística observada real (ver `TERMINOLOGY_AND_COPY.md`).
- **Unidades siempre visibles:** ninguna cifra financiera se muestra sin su
  moneda o activo (ver «Monedas y unidades» en `API_UI_MAPPING.md`).
- **Data-driven:** corredores y campos de ruta se derivan de la API; los
  objetivos son el enum fijo del contrato público, validado en el frontend.
- **Auditabilidad:** cambios pequeños, un propósito por PR, siempre en borrador.
- **Frontera limpia:** cero dependencias del repositorio privado; solo el
  contrato HTTP público (ver `AGENTS.md`).
