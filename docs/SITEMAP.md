# Mapa del sitio — Strateva Web (v1)

> Solo simulación. Ninguna página ejecuta, custodia ni mueve fondos. Todas las
> páginas que muestran datos los obtienen del contrato HTTP público.

Estructura de navegación de la primera versión. Todas las rutas son públicas y
accesibles sin registro. Las URL son orientativas y están pensadas para ser
localizables (i18n): el prefijo de idioma (p. ej. `/es/`) podrá anteponerse
cuando se añadan traducciones.

## Árbol de páginas

```
/                     Inicio
/simulador            Simulador
/como-funciona        Cómo funciona
/corredores           Corredores
/metodologia          Metodología
/acerca-de            Acerca de
/legal/aviso-legal    Aviso legal
/legal/privacidad     Privacidad
/legal/cookies        Cookies
/404                  Página no encontrada (catch-all)
—                     Estado de error (no es una URL; ver nota)
```

## Páginas

### Inicio (`/`)
Presentación del laboratorio: qué es Strateva, disclaimer de simulación visible,
y un acceso directo destacado al simulador. CTA permitido: **«Comparar rutas»**
o **«Simular ruta»** (nunca «Enviar»/«Pagar»/«Transferir»). Puede resumir los
corredores disponibles obtenidos de la API, sin inventar ninguno.

### Simulador (`/simulador`)
Núcleo del producto. Formulario (corredor, importe, objetivo) que llama a
`POST /api/v1/routes/quote` y muestra la ruta recomendada, las alternativas y el
desglose por tramo. Contiene los estados de carga y de error (ver
`WIREFRAMES.md`). El disclaimer acompaña al CTA y a los resultados.

### Cómo funciona (`/como-funciona`)
Explicación divulgativa del recorrido del dinero simulado: origen → tramos
(transferencia, FX, on/off-ramp, payout) → fiat disponible en destino. Aclara la
diferencia entre confirmación en cadena y fiat disponible. No expone detalles
internos del backend.

### Corredores (`/corredores`)
Lista de los corredores disponibles obtenida de `GET /api/v1/corridors`, con
detalle por corredor desde `GET /api/v1/corridors/{id}` (familias de ruta, pares
de mercado, redes). Data-driven: no se codifican corredores en el frontend.

### Metodología (`/metodologia`)
Cómo se puntúan y ordenan las rutas (coste/tiempo/fiabilidad, objetivos,
normalización relativa al conjunto de candidatas), y qué significan «tiempo
esperado», «tiempo conservador» y «fiat disponible». Declara honestamente las
limitaciones (datos sintéticos, ranking relativo).

### Acerca de (`/acerca-de`)
Propósito del proyecto, naturaleza de portafolio/laboratorio, enlace al
repositorio backend público. Sin métricas ni promesas inventadas.

### Legales
- **Aviso legal** (`/legal/aviso-legal`): naturaleza no financiera del servicio,
  ausencia de movimiento de fondos, limitación de responsabilidad.
- **Privacidad** (`/legal/privacidad`): la web no requiere registro y no
  persiste importes ni respuestas; qué datos (mínimos) se tratan.
- **Cookies** (`/legal/cookies`): en v1 no hay analytics ni tracking; se declara
  el uso (previsiblemente nulo o estrictamente técnico).

### Página 404 (`/404` y catch-all)
Página de «no encontrado» para rutas inexistentes. Ofrece volver al inicio o al
simulador. Mantiene el disclaimer y la navegación.

### Estado de error (transversal, no es una URL)
No es una página con URL propia, sino un **estado de UI reutilizable** que se
muestra dentro de la página afectada (sobre todo el simulador) cuando la API
falla. Cubre 422, 429, 5xx y timeout, además de un 404 funcional cuando el
corredor no está modelado. Detalle de cada estado en `WIREFRAMES.md`.

## Navegación

- **Cabecera:** enlace a Inicio, Simulador, Cómo funciona, Corredores,
  Metodología, Acerca de.
- **Pie:** enlaces legales (aviso legal, privacidad, cookies), enlace al
  repositorio backend público y recordatorio del disclaimer de simulación.
