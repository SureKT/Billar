# Billar App

Aplicación local para gestionar partidas de billar entre amigos.
Sin hosting, sin auth, uso en red doméstica desde móvil.

## Stack
- Backend: Python 3.11+ / FastAPI / SQLModel / SQLite
- Frontend: React + Vite (mobile-first)
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

## Decisiones de arquitectura
- Frontend servido como estático desde FastAPI en local (un solo comando para todo)
- No hay sistema de usuarios ni autenticación
- SQLite es suficiente — no migrar a Postgres salvo necesidad explícita

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
- Siguiente jugador = lista circular de partida.jugadores

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