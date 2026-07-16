# AGENTS.md — Reglas para contribuir a Strateva Web

Este documento define cómo deben trabajar los agentes automáticos y las
personas que contribuyen a este repositorio (`Filip303/strateva-web`). Es
vinculante: cualquier cambio que las incumpla debe rechazarse.

> Strateva es **solo una simulación**. Esta web no ejecuta, custodia, convierte
> ni transmite fondos. Nada de lo que se construya aquí puede sugerir lo
> contrario.

## Frontera con el backend

1. El frontend **solo** consume el **contrato HTTP público** del backend
   (`Filip303/strateva-payment-router`) a través de su API REST.
2. El frontend **nunca** importa código, tipos, configuración ni ningún
   artefacto del repositorio privado (`strateva-platform-private`) ni de
   ningún otro repositorio backend.
3. Este repositorio **no contiene secretos**: ni claves, ni tokens, ni
   credenciales, ni endpoints privados. Solo se referencian URLs públicas.
4. Las variables de entorno con prefijo `VITE_*` se consideran **públicas**
   por definición (se incrustan en el bundle del navegador). Nunca se debe
   poner en una `VITE_*` nada que deba permanecer secreto.

## Prohibido en v1

- **Firebase**, **Supabase** o cualquier backend-as-a-service.
- **Google login** o cualquier proveedor de autenticación / login.
- **Wallets**, conexión a cadenas, firmas on-chain.
- **Pagos**, cobros o cualquier flujo de dinero real.
- **Analytics**, telemetría o tracking de usuarios.

## Lenguaje de interfaz (CTA)

- **Prohibidos** los CTA que impliquen mover dinero: «Enviar», «Pagar»,
  «Transferir» (y equivalentes).
- **Permitidos**: «Comparar rutas» o «Simular ruta».
- El resto del copy debe dejar claro en todo momento que los resultados son
  simulados.

## Datos y almacenamiento

- **No** guardar importes introducidos por la persona usuaria ni respuestas de
  la API en `localStorage` (ni en `sessionStorage`, cookies u otro almacén
  persistente). La simulación es efímera.

## Proceso de cambios

- Toda PR se abre como **borrador (draft)**, **sin auto-merge** y **sin
  despliegue** asociado.
- Los cambios deben ser **pequeños y auditables**: un propósito por PR,
  diffs revisables, sin refactors masivos mezclados con funcionalidad.
- No se modifica routing, comisiones, FX, tiempos, importes ni ningún dato del
  backend desde este repositorio: la web solo presenta lo que la API devuelve.
