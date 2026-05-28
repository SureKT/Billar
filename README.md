# Billar App

Aplicación local para gestionar partidas de billar pool entre amigos. Diseñada para uso en red doméstica desde el móvil — sin hosting, sin autenticación.

Soporta **Bola 8** y **Bola 9** con lógica completa y automática.

---

## Funcionalidades

### Inicio — Historial de partidas
- Partidas agrupadas por sesión de juego (día), colapsables
- Duración total de sesión (formato h + min)
- Sección de partidas en curso con temporizador en vivo
- Filtros sticky (permanecen visibles al hacer scroll): estado, modalidad, jugadores
- Filtro multi-selección de jugadores (lógica AND — muestra partidas donde participaron todos los seleccionados)
- Numeración secuencial de partidas (ignora huecos de partidas de prueba eliminadas)

### Jugadores
- Crear, renombrar y eliminar jugadores (con aviso claro de qué se borra y qué se conserva)
- Asignar color personalizado (paleta de 12 colores, sin duplicados)
- Activar / desactivar jugador (los inactivos no aparecen al crear partidas)
- Ordenar por nombre, win rate, bolas o partidas jugadas (barra sticky en scroll)
- **Estadísticas expandibles por jugador:**
  - Partidas jugadas / ganadas / perdidas / bolas metidas
  - Win rate con barra visual
  - Racha actual y racha histórica (mejor racha de victorias consecutivas)
  - Forma reciente — puntos verde/rojo de las últimas 12 partidas
  - Tendencia — comparativa bolas/turno en las últimas 5 partidas vs global
  - Desglose por modalidad (Bola 8 / Bola 9): win rate y falta más común
  - Duración media de partida
  - Últimas 5 partidas finalizadas con rival y resultado
  - Cara a cara vs cada rival: récord, win %, mini barra
  - **Historial de torneos:** posición, W/L/pts, modalidad y fecha por torneo

### Nueva Partida
- Selección de modalidad (Bola 8 / Bola 9)
- Dos equipos con nombre personalizable
- Añadir y reordenar jugadores por arrastre (drag & drop)
- Solo muestra jugadores activos; jugadores del equipo rival ocultos
- Badges de racha en los botones de jugador
- Selección de quién saca primero (con indicador de color de equipo)

### Partida en curso
- Header con modalidad, número de partida, estado y temporizador en vivo
- Cajas de equipo con nombre, jugadores, indicador de turno (◆) y rachas
- Grupos asignados (Lisas / Rayadas) cuando aplica
- **Formulario de turno:**
  - Selector visual de bolas (SVG coloreadas, filtra bolas ya metidas)
  - Badges automáticos (⚡): Bola 8 ilegal, Blanca dentro, Respot (Bola 9)
  - Aviso de faltas consecutivas (1 → amarillo, 2 → rojo "¡siguiente pierde!")
  - Faltas manuales principales + sección "Otras faltas" colapsable
  - Múltiples faltas simultáneas; se aplica la más grave
- **Banner de resultado** al finalizar: ganador, duración, stats por jugador, MVP (★)
- Botones de revancha (equipos invertidos) y rematch (mismos equipos)
- **Historial de turnos** colapsable:
  - Listado en orden inverso con badges (repite, bola en mano, faltas, 2 consecutivas, ⚡ Respot en Bola 9)
  - Modo edición: editar o eliminar turnos individuales con re-evaluación completa; permite cambiar el jugador del turno
  - Insertar turno entre dos existentes
- Deshacer último turno (doble toque con confirmación de 3 s)
- Editar tiempos de inicio y fin
- Eliminar partida (confirmación simple)
- **Compartir resultado:** genera una share card con resultado, stats y código QR
- Navegar al torneo de origen desde el header de la partida (si pertenece a un torneo)

### Estadísticas globales
- **Filtro global por modalidad** (sticky en scroll): Todas / Bola 8 / Bola 9 — filtra todas las secciones
- Cards resumen: partidas, en curso, finalizadas, jugadores, duración media, faltas totales y por partida
- **Récords:** mejor win rate, más bolas, más eficiente (bolas/turno), racha actual, racha histórica, partida más rápida, partida más lenta
- **Gráficas horizontales:**
  - Bolas metidas por jugador
  - Eficiencia (bolas/turno)
  - Duración media por jugador
  - Faltas más frecuentes (top 6)
- **Ranking:** posición con medallas 🥇🥈🥉, win rate, W-L, forma reciente (puntos)
- **Evolución mensual:** barras de los últimos 8 meses con actividad
- Acceso directo al **modo TV** desde el header de la página

### Modo TV
- Vista de espectador de pantalla completa
- Muestra ranking en tiempo real, racha actual y forma reciente de cada jugador
- **Share card de torneo:** podio, tabla de clasificación con barras de puntos, compartible

### Torneos
- Crear torneos Round Robin (todos contra todos, 1v1) en modalidad Bola 8 o Bola 9
- Número de jugadores libre (mínimo 3); se generan todos los enfrentamientos posibles
- Widget en Inicio con torneo activo, progreso y partidas pendientes
- **Clasificación en tiempo real:** W/L badges, puntos, barra de progreso
- Secciones colapsables de clasificación y enfrentamientos
- Picker de quién saca primero al iniciar cada enfrentamiento
- **Podio al finalizar:** 1º centro destacado con trofeo, 2º y 3º flanqueando
- **Panel de estadísticas del torneo:** bolas totales, eficiencia, duración total, jugador más letal, porcentaje perfecto (partidas sin faltas)
- Revancha y repetir partida ocultos en contexto de torneo
- Eliminar torneo con opción de conservar o borrar las partidas asociadas
- Bloqueo de eliminación de partidas pertenecientes a torneos finalizados

### Sugerencias de partida
- Modo 1v1 / 2v2 y modalidad Bola 8 / Bola 9
- Ordenadas por enfrentamientos menos jugados
- Badge de interacción (⚡ sin historial / 🆕 primer duelo / ⚔ N veces)
- Historial del emparejamiento exacto y partidas jugadas juntos
- Crear partida directamente desde la sugerencia

---

## Lógica de juego (automática)

### Bola 8
- Asignación de grupos (Lisas 1-7 / Rayadas 9-15) tras el primer turno válido post-break
- Repetición de turno al meter bolas del propio grupo
- Golden Break: meter la 8 en el break = victoria (o derrota si hay scratch simultáneo)
- Condiciones de derrota: bola 8 ilegal, bola 8 + blanca, bola 8 con pendientes, 3 faltas consecutivas del equipo
- Tres faltas consecutivas por equipo → derrota automática

### Bola 9
- Victoria al meter la bola 9 en cualquier turno
- Respot automático si se mete la 9 y la blanca en el mismo turno (bola en mano para rival)
- Tres faltas consecutivas → derrota automática

### Edición retroactiva
- Editar, insertar o eliminar cualquier turno re-evalúa toda la secuencia posterior automáticamente

---

## Requisitos

- Python 3.11+
- Node.js 18+

---

## Desarrollo local

```bash
# Backend
pip install fastapi uvicorn sqlmodel

# Frontend
cd frontend
npm install
```

Dos terminales en desarrollo:

```bash
# Terminal 1 — Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (hot-reload, proxy /api → backend)
cd frontend
npm run dev
```

Frontend en `http://localhost:5173`.

---

## Compilación (un solo proceso)

```bash
cd frontend && npm run build
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Accesible en `http://localhost:8000` o desde cualquier dispositivo en la red local en `http://<IP>:8000`.

---

## Estructura

```
billar/
├── app/
│   ├── main.py
│   ├── models.py        # Jugador, Partida, Turno, Bola, Falta
│   ├── database.py      # Init DB, seed bolas y faltas
│   ├── logic.py         # evaluar_turno — lógica central
│   └── routers/
│       ├── jugadores.py # Stats, H2H, color, activo
│       ├── partidas.py  # CRUD, sugerencias, SSE eventos
│       ├── turnos.py    # Registro, edición, inserción, undo
│       ├── torneos.py   # CRUD, enfrentamientos, clasificación
│       └── catalogos.py # GET /bolas, GET /faltas
├── frontend/
│   └── src/
│       ├── pages/       # Inicio, Jugadores, NuevaPartida, Partida, Estadisticas, Sugerencias,
│       │                # Torneos, TorneoDetalle
│       └── components/  # Bola, SelectorBolas, BolasEquipo, FormularioTurno,
│                        # HistorialTurnos, ResultadoBanner, AvatarJugador,
│                        # Skeleton, Nav
├── billar.db
├── CLAUDE.md
└── README.md
```

---

## UX / Navegación

- **Nav compacto en scroll:** al bajar 60 px el menú inferior reduce altura y oculta las etiquetas de texto con transición suave; se restaura al subir a 20 px
- **Filtros sticky:** en Partidas, Estadísticas y Jugadores los controles de filtro/orden quedan fijos bajo el nav al hacer scroll
- Abreviaciones W/L (wins/losses) consistentes en toda la app
- Modo oscuro nativo

---

## Base de datos

SQLite en `billar.db`, se crea automáticamente. Para resetear:

```bash
rm billar.db   # Linux/macOS
del billar.db  # Windows
```

El servidor recrea la base de datos vacía en el próximo arranque.
