# Billar App

Aplicación local para gestionar partidas de billar pool (Bola 8) entre amigos. Diseñada para uso en red doméstica desde el móvil — sin hosting, sin autenticación.

## Funcionalidades

### Jugadores
- Crear, editar y eliminar jugadores
- Historial de estadísticas por jugador: partidas jugadas, ganadas, perdidas, bolas metidas
- Seguimiento de turnos con bola en mano y bolas metidas desde bola en mano
- Eliminación con borrado en cascada de todos los datos relacionados

### Partidas
- Crear partida seleccionando jugadores y asignándolos a dos equipos
- Soporte para equipos de uno o varios jugadores
- Vista de partidas en curso y finalizadas

### Registro de turnos
- Selección visual de bolas metidas (SVG con colores oficiales)
- Selección de faltas con detección automática:
  - *Blanca dentro* — se activa al seleccionar la bola 0
  - *Bola 8 ilegal* — se activa al seleccionar la 8 con bolas pendientes del equipo
- Múltiples faltas por turno; se aplica la más grave (pierde partida > bola en mano)
- Deshacer el último turno
- Indicador de bola en mano para el siguiente turno

### Lógica de Bola 8 (automática)
- Asignación de grupos (lisas/rayadas) tras el primer turno válido post-break
- Repetición de turno al meter bolas del propio grupo
- Detección de victoria/derrota: bola 8 legal, bola 8 ilegal, bola blanca junto a la 8, bola 8 en el break
- Tres faltas consecutivas por equipo → derrota automática
- Bola en mano: flag en el siguiente turno

---

## Requisitos

- Python 3.11+
- Node.js 18+

---

## Desarrollo local

### 1. Instalar dependencias

```bash
# Backend
pip install fastapi uvicorn sqlmodel

# Frontend
cd frontend
npm install
```

### 2. Arrancar en modo desarrollo

Requiere dos terminales:

```bash
# Terminal 1 — Backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (con hot-reload y proxy a la API)
cd frontend
npm run dev
```

El frontend queda en `http://localhost:5173` con proxy de `/api` al backend.

---

## Compilación y despliegue (un solo proceso)

El frontend se compila a `app/static/` y FastAPI lo sirve como estático. Con esto basta un único proceso para toda la app.

### Compilar el frontend

```bash
cd frontend
npm run build
```

### Arrancar la app completa

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Accesible en `http://localhost:8000` o desde cualquier dispositivo en la red local en `http://<IP-del-servidor>:8000`.

Para encontrar la IP del servidor:

```bash
# Windows
ipconfig

# Linux / macOS
ip a
```

---

## Estructura del proyecto

```
billar/
├── app/
│   ├── main.py          # FastAPI, serve SPA, startup
│   ├── models.py        # Modelos SQLModel (Jugador, Partida, Turno…)
│   ├── database.py      # Init DB, seed bolas y faltas
│   ├── logic.py         # Lógica de partida (evaluar_turno)
│   └── routers/
│       ├── jugadores.py
│       ├── partidas.py
│       ├── turnos.py
│       └── catalogos.py
├── frontend/
│   ├── src/
│   │   ├── pages/       # Inicio, Partida, Jugadores
│   │   ├── components/  # Bola, SelectorBolas, …
│   │   ├── api/         # client.js
│   │   └── hooks/       # useApi, …
│   └── vite.config.js
├── billar.db            # Base de datos SQLite (se crea al arrancar)
└── CLAUDE.md
```

---

## Base de datos

SQLite en `billar.db` en la raíz del proyecto. Se crea automáticamente al arrancar el backend. No requiere configuración adicional.

Para resetear todos los datos:

```bash
rm billar.db
```

El servidor recreará la base de datos vacía en el próximo arranque.
