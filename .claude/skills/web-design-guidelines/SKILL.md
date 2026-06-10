---
name: web-design-guidelines
description: Checklist de calidad de interfaz web (Vercel Web Interface Guidelines). Usar al revisar, auditar o construir UI — accesibilidad, focus, formularios, animación, tipografía, performance, estados vacíos y micro-interacciones. Disparar en "audita la UI", "revisa accesibilidad", "repaso de UX", "review interface".
---

# Web Interface Guidelines (Vercel)

Checklist para auditar interfaces web. Fuente: vercel-labs/web-interface-guidelines.
Al revisar código UI, recorrer cada sección y reportar violaciones concretas con `archivo:línea`.

## Accesibilidad
- Botones de solo icono necesitan `aria-label`
- Controles de formulario necesitan `<label>` o `aria-label`
- Elementos interactivos necesitan manejo de teclado (`onKeyDown`/`onKeyUp`)
- `<button>` para acciones, `<a>`/`<Link>` para navegación (no `<div onClick>`)
- Imágenes necesitan `alt` (o `alt=""` si decorativas)
- Iconos decorativos necesitan `aria-hidden="true"`
- Actualizaciones async necesitan `aria-live="polite"` (toasts, validación)
- HTML semántico antes que ARIA
- Headings jerárquicos `<h1>`–`<h6>`; skip link al contenido principal
- `scroll-margin-top` en anclas de heading

## Focus
- Elementos interactivos necesitan foco visible: `focus-visible:ring-*` o equivalente
- Nunca `outline: none` sin reemplazo de foco
- `:focus-visible` sobre `:focus`
- `:focus-within` para controles compuestos

## Formularios
- Inputs necesitan `autocomplete` y `name` con sentido
- `type` correcto (`email`, `tel`, `url`, `number`) e `inputmode`
- Nunca bloquear pegado (`onPaste` + `preventDefault`)
- Labels clicables (`htmlFor` o envolviendo el control)
- Desactivar spellcheck en emails, códigos, usernames (`spellCheck={false}`)
- Checkbox/radio: label + control comparten hit target
- Botón submit habilitado hasta que arranca la petición; spinner durante
- Errores inline junto al campo; foco al primer error al enviar
- Placeholders terminan en `…` y muestran patrón de ejemplo
- Avisar antes de navegar con cambios sin guardar

## Animación
- Honrar `prefers-reduced-motion` (variante reducida o desactivar)
- Animar solo `transform`/`opacity` (compositor-friendly)
- Nunca `transition: all` — listar propiedades
- `transform-origin` correcto
- Animaciones interrumpibles

## Tipografía
- `…` no `...`
- Comillas curvas `"` `"` no rectas
- Espacios no-rompibles: `10&nbsp;MB`, `⌘&nbsp;K`
- Estados de carga terminan en `…`: `"Cargando…"`
- `font-variant-numeric: tabular-nums` en columnas/comparaciones de números y cronómetros
- `text-wrap: balance`/`text-pretty` en headings

## Contenido
- Contenedores de texto manejan contenido largo: `truncate`, `line-clamp-*`, `break-words`
- Hijos flex necesitan `min-w-0` para truncar
- Manejar estados vacíos — no renderizar UI rota para strings/arrays vacíos
- Anticipar input corto, medio y muy largo

## Imágenes
- `<img>` necesita `width` y `height` explícitos (evita CLS)
- Below-fold: `loading="lazy"`; above-fold crítico: `fetchpriority="high"`

## Performance
- Listas grandes (>50): virtualizar o `content-visibility: auto`
- Sin lecturas de layout en render (`getBoundingClientRect`, `offsetHeight`)
- Inputs no controlados preferidos; controlados baratos por tecla
- `preconnect` para dominios de CDN; preload de fuentes críticas con `font-display: swap`

## Navegación y estado
- URL refleja estado — filtros, tabs, paginación, paneles en query params
- Links usan `<a>`/`<Link>` (soporte Cmd/Ctrl+click, middle-click)
- Deep-link de toda UI con estado
- Acciones destructivas: confirmación o ventana de deshacer

## Touch e interacción
- `touch-action: manipulation`
- `-webkit-tap-highlight-color` intencional
- `overscroll-behavior: contain` en modales/drawers
- Durante drag: desactivar selección, `inert` en arrastrado
- `autoFocus` con moderación — desktop, único input primario

## Safe areas y layout
- Full-bleed necesita `env(safe-area-inset-*)` para notches
- Evitar scrollbars no deseados: `overflow-x-hidden` en contenedores
- Flex/grid sobre medición JS

## Dark mode y theming
- `color-scheme: dark` en `<html>` para temas oscuros (controles nativos)
- `<meta name="theme-color">` coincide con el fondo
- `<select>` nativo: `background-color` y `color` explícitos

## Locale e i18n
- Fechas/horas: `Intl.DateTimeFormat` no formatos hardcodeados
- Números/moneda: `Intl.NumberFormat`
- `translate="no"` en marcas y tokens de código

## Hover e interacción
- Botones/links necesitan estado `hover:`
- Estados interactivos aumentan contraste

## Anti-patrones (señalar)
- `user-scalable=no` / `maximum-scale=1`
- `onPaste` con `preventDefault`
- `transition: all`
- `outline: none` sin `focus-visible`
- Navegación inline `onClick` sin `<a>`
- `<div>`/`<span>` con click handlers
- Imágenes sin dimensiones
- `.map()` de arrays grandes sin virtualizar
- Inputs sin label
- Botones de icono sin `aria-label`
- Formatos de fecha/número hardcodeados
- `autoFocus` sin justificación
