# Billar App

Aplicación local para gestionar partidas de billar entre amigos.
Sin hosting, sin auth, uso en red doméstica desde móvil.

## Stack
- Backend: Python 3.11+ / FastAPI / SQLModel / SQLite
- Frontend: React + Vite (mobile-first, con layout desktop dedicado ≥1024px)
- DB: SQLite en `billar.db` en la raíz del proyecto

## Comandos
- Arrancar backend: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Arrancar frontend: `cd frontend && npm run dev`
- Build frontend: `cd frontend && npm run build` (output a `app/static/`)

## Estructura
billar/
├── app/
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── logic.py         # evaluar_turno — lógica central de partida
│   └── routers/
│       ├── partidas.py
│       ├── turnos.py
│       ├── jugadores.py
│       └── catalogos.py # GET /bolas y GET /faltas
├── frontend/
│   ├── src/
│   └── vite.config.js
├── billar.db
└── CLAUDE.md

## Convenciones
- Nombres de variables y funciones en español (dominio del negocio)
- Endpoints REST en español: /partidas, /turnos, /jugadores
- Siempre usar SQLModel para modelos — no mezclar con SQLAlchemy puro
- El frontend consume la API en http://localhost:8000/api

## Filosofía de diseño

La app es una **herramienta de uso frecuente en pantalla pequeña**, no un showcase. Los usuarios saben lo que hacen — no hay que explicar, hay que mostrar.

**Densidad funcional.** Cada píxel debe ganárselo. Si dos datos van juntos conceptualmente, van juntos visualmente. Información inline antes que filas separadas. El espacio en blanco no es elegancia — es espacio que el usuario escanea sin obtener nada.

**Coherencia total.** El mismo dato se muestra igual en todos los contextos. Un logro en la página de logros, en el banner de resultado o en un toast comparte jerarquía visual, mismas pills, mismo orden. El usuario aprende una vez y ya sabe leerlo en cualquier parte.

**Completitud de las acciones.** Una acción tiene consecuencias — todas deben tratarse. Deshacer un turno deshace sus efectos secundarios. Volver navega al origen real, no a una ruta arbitraria. La app no deja loose ends.

## Layout responsive (móvil + desktop)

Breakpoint único **1024px** vía `useMediaQuery('(min-width: 1024px)')` (hook ya existente). Móvil es la base; desktop es una capa aparte detrás del media query — **nunca tocar móvil al ajustar desktop**.

- **Shell** (`index.css` + `Nav.jsx` + `App.jsx`): móvil = nav horizontal sticky (compacta al scroll). Desktop = `#root` en `flex-direction: row` con **sidebar lateral fijo** de 200px; `Nav` renderiza `<NavSidebar/>` o `<NavMovil/>` según el media query. Sin sidebar, `--nav-height` se fija a `0px` para que los sticky de las páginas peguen arriba.
- **Ancho por página, no global.** No hay tope de ancho heredado — cada página fija su `maxWidth` centrado en desktop (regla anti-estiramiento). Topes actuales: Partida 1000, Inicio 860, Jugadores/Logros 1100, Reglas 800, NuevaPartida 960, Estadísticas 1200, Torneos 1100, TorneoDetalle 760. Al crear página nueva: ponerle su tope, no dejarla a ancho completo. **Sin asides/columnas laterales de contenido** — quedan semivacías y rompen la densidad; índices y filtros van como barra horizontal sticky sobre el contenido (patrón de Reglas y Estadísticas), bloques contextuales van encima del listado (patrón de Inicio).
- **Recolocar, no rediseñar.** Desktop reutiliza los mismos componentes que móvil en otra disposición (grids de cards, dos paneles, índice lateral). El mismo dato se ve igual en ambos → coherencia total.
- **Escala base desktop** (`index.css`): `zoom` sobre `#root` escalonado — 1.15 (≥1024px), 1.3 (≥1440px), 1.5 (≥1920px). La tipografía de la app está en px de móvil (12-14px); sin esto queda minúscula en monitor. Al diseñar desktop, pensar en el ancho *efectivo* (viewport ÷ zoom), no el físico: a 1920 el contenido dispone de ~1280px CSS. No compensar tamaños de fuente por página — la escala es global.
- **Pull-to-refresh** (`components/PullToRefresh.jsx`, montado en `App.jsx`): solo táctil (`pointer: coarse`), activo en todas las rutas. Tirar hacia abajo desde el tope (`scrollY===0`) pasado el umbral → `location.reload()`. En desktop no hace nada.
- Spec + plan del rework: `docs/superpowers/specs/2026-06-10-desktop-rework-design.md` y `docs/superpowers/plans/2026-06-10-desktop-rework.md`.

## Despliegue (homelab)

Corre en el server `surehub-home` como imagen custom (build desde fuente). No es local.

- Acceso app: **http://100.73.48.106:8020** (solo Tailscale, sin auth por diseño).
- Flujo: `git push` → en server `cd /srv/billar/src && git pull` → `cd ~/homelab/docker-compose/billar && docker compose up -d --build`. El frontend se compila dentro del Dockerfile (multi-stage Node→Python); sin `npm run build` manual en el server.
- **DB canónica = server** (`/srv/billar/data/billar.db`, volumen). El `billar.db` local quedó congelado como snapshot inicial — sus cambios en `git status` son ruido, no commitear ni copiar local→server.
- Doc completo: repo homelab `docs/billar.md`.

## Decisiones de arquitectura
- Frontend servido como estático desde FastAPI (un solo comando para todo; mismo binario en local y server)
- No hay sistema de usuarios ni autenticación
- SQLite es suficiente — no migrar a Postgres salvo necesidad explícita
- **1 worker uvicorn fijo** — SSE pub/sub (`app/events.py`) y detección de logros guardan estado en memoria del proceso; con 2+ workers se pierden los broadcasts

## Lógica de partida — Reglas completas Bola 8

### Estados de una partida
- `en_curso`: partida activa
- `finalizada`: tiene ganador registrado

### Fases de la partida

#### 1. Break (turno numero=1)
- Si hay falta → bola en mano para el siguiente jugador (repite=False)
- Si mete bolas → NO asigna grupo todavía (el break nunca asigna grupos)
- Si mete la bola 8 en el break → pierde la partida inmediatamente

#### 2. Fase sin grupos asignados (post-break, grupos = null)
- Un turno asigna grupos si cumple TODO lo siguiente:
  - numero > 1
  - sin falta asociada
  - bolas metidas > 0
  - todas las bolas son del mismo tipo (todas Lisas O todas Rayadas)
  - ninguna bola es la 8 ni la 0
- Si el turno no cumple → grupos siguen sin asignarse, el juego continúa
- El equipo del jugador que ejecuta ese turno → recibe el tipo de bola metida
- El equipo rival → recibe el tipo contrario

#### 3. Fase con grupos asignados
- Cada equipo tiene su grupo: Lisas (1-7) o Rayadas (9-15)
- Un jugador puede meter la 8 solo si su equipo no tiene bolas pendientes en la mesa
- Si mete la 8 con bolas pendientes → pierde la partida inmediatamente
- Si mete la 8 y la blanca en el mismo turno → pierde la partida inmediatamente

### Lógica de turno siguiente
- Si falta en turno:
  - Repite = False
  - Si falta == "Bola en mano": siguiente jugador recibe bola_en_mano = True
  - Si falta == "Pierde partida": partida.ganador = equipo rival → finalizada
- Si no hay falta:
  - Repite = True **solo si** `_mete_bola_propia()` es True
    - Sin grupos asignados: cualquier bola numerada (1-7 o 9-15) cuenta
    - Con grupos: solo cuentan bolas del propio grupo
    - La bola 8 y la blanca (0) nunca cuentan para repetir
  - Si no mete bolas propias: repite = False
- Siguiente jugador = siguiente en el equipo RIVAL (rota circular dentro del rival según quién jugó por última vez en ese equipo)

### Tres faltas consecutivas
- Se cuenta a nivel de **equipo**, no de jugador individual
- Si los últimos 3 turnos del equipo (en orden) tienen todos falta → pierde la partida
- Un turno sin falta resetea el contador del equipo a 0
- Se evalúa al registrar cada turno

### Condiciones de victoria
| Condición | Resultado |
|---|---|
| Metes la 8 sin bolas pendientes de tu equipo | Ganas |
| Metes la 8 con bolas pendientes de tu equipo | Pierdes |
| Metes la 8 y la blanca en el mismo turno | Pierdes |
| Metes la 8 en el break | Pierdes |
| Falta "Bola 8 ilegal" | Pierdes |
| Tres faltas consecutivas del equipo | Pierdes |

### Bola en mano
- El siguiente jugador puede colocar la blanca donde quiera
- Se registra como flag `bola_en_mano = True` en el turno siguiente
- No afecta a la lógica de grupos ni de conteo de faltas

### Detección automática de faltas (frontend)
- **Blanca dentro**: se activa al seleccionar bola 0 (y la 8 NO está seleccionada)
- **Bola 8 ilegal**: se activa al seleccionar bola 8 con bolas pendientes del equipo
- Estas faltas se muestran como badges informativos (⚡), no son botones manuales
- Las faltas "Blanca dentro", "Bola 8 ilegal" y "Tres faltas consecutivas" están ocultas de la lista de faltas manuales
- Se permiten múltiples faltas simultáneas (automáticas + manuales)
- Al registrar: se aplica la más grave (`pierde_partida` > `bola_en_mano`)

### Lo que la app debe calcular automáticamente al registrar un turno
1. ¿Hay condición de victoria/derrota? → si sí, cerrar partida con ganador
2. ¿Tres faltas consecutivas del equipo? → si sí, cerrar partida
3. ¿Se asignan grupos ahora? → evaluar condiciones
4. ¿Repite o pasa turno? → calcular siguiente jugador
5. ¿Bola en mano para el siguiente? → flag en el turno nuevo