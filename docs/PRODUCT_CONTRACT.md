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
   esto se codifica de forma fija («hardcode») en el frontend.
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

El simulador permite elegir el objetivo con el que se ordena la recomendación.
Los objetivos corresponden 1:1 con los del backend:

| Objetivo API      | Etiqueta de producto (ES) | Significado                                   |
|-------------------|---------------------------|-----------------------------------------------|
| `cheapest`        | Más barato                | Minimiza el coste total.                       |
| `fastest`         | Más rápido                | Minimiza el tiempo hasta fiat disponible.      |
| `most_reliable`   | Más fiable                | Maximiza la fiabilidad simulada.               |
| `balanced`        | Equilibrado               | Combina coste, tiempo y fiabilidad (defecto).  |

El objetivo por defecto es **equilibrado** (`balanced`), igual que el backend.

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
- **Data-driven:** corredores, objetivos y campos de ruta se derivan de la API.
- **Auditabilidad:** cambios pequeños, un propósito por PR, siempre en borrador.
- **Frontera limpia:** cero dependencias del repositorio privado; solo el
  contrato HTTP público (ver `AGENTS.md`).
