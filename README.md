# Strateva Payment Router — Web

> ⚠️ **Solo simulación. Strateva no ejecuta, custodia, convierte ni transmite
> fondos de nadie.**
>
> Esta web es un laboratorio público y demostrativo. No mueve dinero real, no
> tiene claves, no conecta con proveedores ni wallets reales, no hace KYC y no
> es un servicio financiero autorizado. Todos los proveedores, comisiones,
> tipos de cambio, tiempos y fiabilidades que se muestran son **sintéticos**.

## Qué es

Este repositorio contiene el **frontend público** de Strateva Payment Router:
un motor de enrutamiento inteligente de pagos internacionales que modela las
infraestructuras de pago (transferencias bancarias, SEPA, SWIFT, proveedores,
FX, raíles de stablecoin) como un grafo dirigido y busca la mejor ruta entre
un origen y un destino según **coste, tiempo y fiabilidad**.

La web es un **laboratorio / simulador**: permite comparar rutas simuladas y
entender por qué una se recomienda frente a otras. No es un producto de envío
de dinero y no lo será dentro de este alcance.

## Estado

- **v1: pública, sin registro y sin pagos.** No hay login, no hay cuentas, no
  se cobra ni se envía nada. La web solo consulta un contrato HTTP público de
  solo lectura y muestra el resultado.
- El motor de enrutamiento vive en el repositorio backend público
  `Filip303/strateva-payment-router` y expone una API REST. Esta web es
  únicamente su capa de presentación.

## Idioma

- El idioma inicial es **español**.
- La estructura del proyecto se preparará para **i18n** (internacionalización)
  desde el principio, de modo que añadir traducciones no requiera reescribir
  los componentes. En esta fase no se incluye todavía código React.

## Alcance de este repositorio (fase actual)

Esta fase es de **documentación previa**: se define el contrato funcional de
la web antes de escribir React. Todavía **no** hay código de aplicación,
`package.json`, dependencias, componentes ni configuración de despliegue.

La documentación de producto vive en `docs/` (contrato de producto, mapa del
sitio, wireframes textuales, mapeo API↔UI y terminología).

## Reglas de contribución

Las normas para contribuir (humanas y automatizadas) están en
[`AGENTS.md`](./AGENTS.md). En resumen: la web solo consume el contrato HTTP
público, nunca importa nada del backend privado, no incluye secretos, y toda
PR se abre en modo borrador sin despliegue.

## Licencia

Pendiente de definir.
