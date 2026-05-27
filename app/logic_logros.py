from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from sqlmodel import Session, select

from app.models import (
    Partida, PartidaJugador, Turno,
    TorneoJugador, TorneoEnfrentamiento, Torneo,
)


# ---------------------------------------------------------------------------
# Modelos de respuesta
# ---------------------------------------------------------------------------

class NivelLogro(BaseModel):
    nivel: str   # "bronce" | "plata" | "oro" | "platino"
    emoji: str
    umbral: int


class LogroCatalogo(BaseModel):
    id: str
    nombre: str
    descripcion: str
    icono: str
    niveles: list[NivelLogro]
    modalidad: Optional[str] = None  # None = ambas, "bola8", "bola9"


class LogroEstado(LogroCatalogo):
    desbloqueado: bool
    nivel_actual: Optional[str] = None
    niveles_desbloqueados: list[str] = []
    partida_id: Optional[int] = None       # id DB de la partida que lo desbloqueó
    partida_numero: Optional[int] = None   # número visible (posición cronológica global)
    progreso: Optional[int] = None         # valor actual (solo para nivelados)
    niveles_partida_id: dict[str, int] = {} # {nivel: partida_id} para logros nivelados


class JugadorMinimo(BaseModel):
    id: int
    nombre: str
    color: Optional[str] = None
    partida_id: Optional[int] = None
    partida_numero: Optional[int] = None
    progreso: Optional[int] = None      # valor actual (solo para nivelados)
    nivel_actual: Optional[str] = None  # nivel más alto desbloqueado


class LogroGlobal(LogroCatalogo):
    jugadores: list[JugadorMinimo]        # jugadores activos que lo tienen
    porcentaje: float                      # % sobre total de jugadores activos


# ---------------------------------------------------------------------------
# Niveles
# ---------------------------------------------------------------------------

NIVELES_RODAJE = [
    NivelLogro(nivel="bronce", emoji="🥉", umbral=10),
    NivelLogro(nivel="plata",  emoji="🥈", umbral=50),
    NivelLogro(nivel="oro",    emoji="🥇", umbral=100),
    NivelLogro(nivel="platino",emoji="💎", umbral=250),
]
NIVELES_CRACK = [
    NivelLogro(nivel="bronce", emoji="🥉", umbral=10),
    NivelLogro(nivel="plata",  emoji="🥈", umbral=25),
    NivelLogro(nivel="oro",    emoji="🥇", umbral=50),
    NivelLogro(nivel="platino",emoji="💎", umbral=100),
]
NIVELES_RACHA = [
    NivelLogro(nivel="bronce", emoji="🥉", umbral=3),
    NivelLogro(nivel="plata",  emoji="🥈", umbral=5),
    NivelLogro(nivel="oro",    emoji="🥇", umbral=10),
    NivelLogro(nivel="platino",emoji="💎", umbral=15),
]
NIVELES_ARTILLERO = [
    NivelLogro(nivel="bronce", emoji="🥉", umbral=100),
    NivelLogro(nivel="plata",  emoji="🥈", umbral=500),
    NivelLogro(nivel="oro",    emoji="🥇", umbral=1000),
    NivelLogro(nivel="platino",emoji="💎", umbral=2500),
]
NIVELES_UBICATE = [
    NivelLogro(nivel="bronce", emoji="🥉", umbral=3),
    NivelLogro(nivel="plata",  emoji="🥈", umbral=5),
    NivelLogro(nivel="oro",    emoji="🥇", umbral=7),
]
NIVELES_DESTRUCTOR = [
    NivelLogro(nivel="bronce", emoji="🥉", umbral=2),
    NivelLogro(nivel="plata",  emoji="🥈", umbral=3),
    NivelLogro(nivel="oro",    emoji="🥇", umbral=4),
    NivelLogro(nivel="platino",emoji="💎", umbral=5),
]

# ---------------------------------------------------------------------------
# Constantes auxiliares
# ---------------------------------------------------------------------------

# Orden arcoíris para bolas de billar (colores del orgullo: rojo→naranja→amarillo→verde→azul→violeta→granate)
RAINBOW_LISAS   = [3, 5, 1, 6, 2, 4, 7]
RAINBOW_RAYADAS = [11, 13, 9, 14, 10, 12, 15]

# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------

CATALOGO: list[LogroCatalogo] = [
    LogroCatalogo(id="primera_partida",  nombre="Primera partida",  descripcion="Juega tu primera partida",                                        icono="🎱", niveles=[]),
    LogroCatalogo(id="primera_victoria", nombre="Primera victoria", descripcion="Gana tu primera partida",                                         icono="🏆", niveles=[]),
    LogroCatalogo(id="primeras_bolas",   nombre="Primeras bolas",   descripcion="Mete 10 bolas en total",                                          icono="🎳", niveles=[]),
    LogroCatalogo(id="rodaje",           nombre="Rodaje",           descripcion="Partidas jugadas",                                                icono="🎱", niveles=NIVELES_RODAJE),
    LogroCatalogo(id="crack",            nombre="Crack",            descripcion="Victorias totales",                                               icono="🥊", niveles=NIVELES_CRACK),
    LogroCatalogo(id="en_racha",         nombre="En racha",         descripcion="Victorias consecutivas",                                          icono="🔥", niveles=NIVELES_RACHA),
    LogroCatalogo(id="artillero",        nombre="Artillero",        descripcion="Bolas metidas en total",                                          icono="🎳", niveles=NIVELES_ARTILLERO),
    LogroCatalogo(id="limpio",           nombre="Limpio",           descripcion="Ganar una partida de Bola 8 sin ninguna falta",                   icono="🧼", niveles=[],             modalidad="bola8"),
    LogroCatalogo(id="golden_break",     nombre="Golden Break",     descripcion="Ganar metiendo la 9 en el saque",                                icono="💥", niveles=[],             modalidad="bola9"),
    LogroCatalogo(id="relampago",        nombre="Relámpago",        descripcion="Ganar en menos de 5 minutos",                                    icono="⚡", niveles=[]),
    LogroCatalogo(id="tirador",          nombre="Tirador",          descripcion="Promedio ≥1.5 bolas/turno en una partida ganada",                icono="🎯", niveles=[]),
    LogroCatalogo(id="campeon",          nombre="Campeón",          descripcion="Ganar un torneo",                                                icono="🥇", niveles=[]),
    LogroCatalogo(id="tricampeon",       nombre="Tricampeón",       descripcion="Ganar 3 torneos",                                                icono="👑", niveles=[]),
    LogroCatalogo(id="torpon",           nombre="Torpón",           descripcion="Perder una partida por tres faltas consecutivas del equipo",      icono="🤦", niveles=[]),
    LogroCatalogo(id="nervios",          nombre="Nervios",          descripcion="Perder metiendo la 8 antes de tiempo",                           icono="😬", niveles=[],             modalidad="bola8"),
    LogroCatalogo(id="polivalente",      nombre="Polivalente",      descripcion="Ganar ≥1 Bola 8 y ≥1 Bola 9",                                  icono="🎭", niveles=[]),
    LogroCatalogo(id="verdugo",          nombre="Verdugo",          descripcion="Ganar 3 veces seguidas contra el mismo rival",                  icono="😈", niveles=[]),
    LogroCatalogo(id="maratoniano",      nombre="Maratoniano",      descripcion="Jugar una partida de más de 30 minutos",                        icono="⏱",  niveles=[]),
    LogroCatalogo(id="intocable",        nombre="Intocable",        descripcion="5 victorias acumuladas sin ninguna falta",                      icono="🎖️", niveles=[]),
    LogroCatalogo(id="noctambulo",       nombre="Noctámbulo",       descripcion="Partida registrada entre las 00:00 y las 02:00",                icono="🌙", niveles=[]),
    LogroCatalogo(id="madrugador",       nombre="Madrugador",       descripcion="Partida registrada entre las 06:00 y las 09:00",                icono="🌅", niveles=[]),
    LogroCatalogo(id="barrida",          nombre="Barrida",          descripcion="Ganar sin que el rival meta ninguna bola de su grupo (Bola 8)", icono="🧹", niveles=[],             modalidad="bola8"),
    LogroCatalogo(id="sesion_perfecta",  nombre="Sesión perfecta",  descripcion="Ganar 3 partidas en el mismo día",                             icono="📅", niveles=[]),
    LogroCatalogo(id="revancha",         nombre="Revancha",         descripcion="Ganar inmediatamente después de perder contra el mismo rival",  icono="🔄", niveles=[]),
    LogroCatalogo(id="blue_balls",       nombre="Blue balls",       descripcion="Ambos grupos vaciados y la 8 sin meterse en 3+ turnos seguidos",icono="🔵", niveles=[],             modalidad="bola8"),
    LogroCatalogo(id="woke",             nombre="Woke",             descripcion="Meter todas tus bolas en el orden de los colores del arcoíris (Bola 8)", icono="🏳️‍🌈", niveles=[],  modalidad="bola8"),
    LogroCatalogo(id="remontada",        nombre="Remontada",        descripcion="Ganar en Bola 8 cuando el rival ya no tiene bolas de grupo y tú tienes 4 o más", icono="💪", niveles=[], modalidad="bola8"),
    LogroCatalogo(id="ubicate",          nombre="Ubícate",          descripcion="Meter bolas del rival en tus propios turnos (Bola 8) — máx. en una partida", icono="🙈", niveles=NIVELES_UBICATE, modalidad="bola8"),
    LogroCatalogo(id="destructor",       nombre="Destructor",       descripcion="Bolas metidas en el saque — máx. en un saque",                 icono="💣", niveles=NIVELES_DESTRUCTOR),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _niveles_desbloqueados(valor: int, niveles: list[NivelLogro]) -> list[str]:
    return [n.nivel for n in niveles if valor >= n.umbral]


def _nivel_actual(valor: int, niveles: list[NivelLogro]) -> Optional[str]:
    desbloqueados = _niveles_desbloqueados(valor, niveles)
    return desbloqueados[-1] if desbloqueados else None


def _turno_tiene_falta(t: Turno) -> bool:
    return bool(t.falta_id) or bool(t.faltas_ids)


# Approximation: awards "won tournament" to any player who won all their
# own enfrentamientos in a finalizado torneo. Works correctly for
# elimination-style tournaments. May award incorrectly in round-robin
# formats where overall ranking determines the winner.
def _torneos_ganados(jugador_id: int, session: Session) -> int:
    tj_rows = session.exec(
        select(TorneoJugador).where(TorneoJugador.jugador_id == jugador_id)
    ).all()
    torneo_ids = [row.torneo_id for row in tj_rows]
    if not torneo_ids:
        return 0

    ganados = 0
    for torneo_id in torneo_ids:
        torneo = session.get(Torneo, torneo_id)
        if not torneo or torneo.estado != "finalizado":
            continue
        enfs = session.exec(
            select(TorneoEnfrentamiento).where(
                TorneoEnfrentamiento.torneo_id == torneo_id,
                (TorneoEnfrentamiento.jugador1_id == jugador_id) |
                (TorneoEnfrentamiento.jugador2_id == jugador_id),
            )
        ).all()
        jugadas = [e for e in enfs if e.partida_id is not None]
        if not jugadas:
            continue
        all_won = True
        for enf in jugadas:
            partida = session.get(Partida, enf.partida_id)
            if not partida or partida.estado != "finalizada":
                all_won = False
                break
            pj = session.exec(
                select(PartidaJugador).where(
                    PartidaJugador.partida_id == enf.partida_id,
                    PartidaJugador.jugador_id == jugador_id,
                )
            ).first()
            if not pj or partida.ganador_equipo != pj.equipo:
                all_won = False
                break
        if all_won:
            ganados += 1
    return ganados

# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------

def calcular_logros(jugador_id: int, session: Session) -> list[LogroEstado]:
    # --- Número visible de cada partida (posición en orden global por id) ---
    all_ids_ord = session.exec(select(Partida.id).order_by(Partida.id)).all()
    numero_map: dict[int, int] = {pid: i + 1 for i, pid in enumerate(all_ids_ord)}

    # --- Cargar participaciones ---
    pj_rows = session.exec(
        select(PartidaJugador).where(PartidaJugador.jugador_id == jugador_id)
    ).all()
    partida_ids = [row.partida_id for row in pj_rows]
    equipo_por_partida: dict[int, int] = {row.partida_id: row.equipo for row in pj_rows}

    if not partida_ids:
        return [
            LogroEstado(**c.model_dump(), desbloqueado=False, nivel_actual=None, niveles_desbloqueados=[])
            for c in CATALOGO
        ]

    # --- Cargar partidas ---
    partidas_all = session.exec(
        select(Partida).where(Partida.id.in_(partida_ids))
    ).all()
    partidas_finalizadas = [p for p in partidas_all if p.estado == "finalizada"]
    victorias_set = {
        p.id for p in partidas_finalizadas
        if p.ganador_equipo == equipo_por_partida.get(p.id)
    }
    victorias = [p for p in partidas_finalizadas if p.id in victorias_set]
    derrotas  = [p for p in partidas_finalizadas if p.id not in victorias_set]

    # --- Cargar turnos del jugador ---
    mis_turnos = session.exec(
        select(Turno).where(
            Turno.partida_id.in_(partida_ids),
            Turno.jugador_id == jugador_id,
        )
    ).all()
    turnos_por_partida: dict[int, list[Turno]] = {}
    for t in mis_turnos:
        turnos_por_partida.setdefault(t.partida_id, []).append(t)

    # --- Cargar TODOS los turnos (para Barrida, Blue balls, Remontada) ---
    todos_turnos = session.exec(
        select(Turno).where(Turno.partida_id.in_(partida_ids))
    ).all()
    todos_turnos_por_partida: dict[int, list[Turno]] = {}
    for t in todos_turnos:
        todos_turnos_por_partida.setdefault(t.partida_id, []).append(t)

    # --- Cargar PartidaJugador de todas las partidas ---
    todos_pj = session.exec(
        select(PartidaJugador).where(PartidaJugador.partida_id.in_(partida_ids))
    ).all()
    pj_por_partida: dict[int, list[PartidaJugador]] = {}
    for pj in todos_pj:
        pj_por_partida.setdefault(pj.partida_id, []).append(pj)

    # --- Métricas base ---
    total_partidas = len(partidas_all)
    total_victorias = len(victorias)
    total_bolas = sum(
        sum(1 for b in t.bolas_metidas if b != 0)
        for t in mis_turnos
    )

    # --- Racha máxima ---
    racha = 0
    racha_max = 0
    for p in sorted(partidas_finalizadas, key=lambda p: p.fecha):
        if p.id in victorias_set:
            racha += 1
            racha_max = max(racha_max, racha)
        else:
            racha = 0

    # --- Victorias sin faltas ---
    def _victoria_sin_faltas(partida: Partida) -> bool:
        return all(not _turno_tiene_falta(t) for t in turnos_por_partida.get(partida.id, []))

    limpias_bola8 = [p for p in victorias if p.modalidad == "bola8" and _victoria_sin_faltas(p)]

    # --- Partidas agrupadas por rival (para Verdugo y Revancha) ---
    partidas_por_rival: dict[str, list[Partida]] = {}
    for p in partidas_finalizadas:
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        rival_ids = sorted(
            pj.jugador_id for pj in pj_por_partida.get(p.id, [])
            if pj.equipo != mi_equipo
        )
        if not rival_ids:
            continue
        key = ",".join(str(i) for i in rival_ids)
        partidas_por_rival.setdefault(key, []).append(p)

    # --- Métrica: máx. bolas del rival en mis turnos (Ubícate) ---
    max_opp_bolas = 0
    for p in partidas_all:
        if p.modalidad != "bola8" or not p.equipo1_grupo or not p.equipo2_grupo:
            continue
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        rival_equipo = 2 if mi_equipo == 1 else 1
        rival_grupo  = p.equipo1_grupo if rival_equipo == 1 else p.equipo2_grupo
        rival_bolas  = set(range(1, 8)) if rival_grupo == "lisas" else set(range(9, 16))
        opp_pocketed = sum(
            sum(1 for b in t.bolas_metidas if b in rival_bolas)
            for t in turnos_por_partida.get(p.id, [])
        )
        max_opp_bolas = max(max_opp_bolas, opp_pocketed)

    # --- Métrica: máx. bolas en el saque (Destructor) ---
    max_break_bolas = 0
    for p in partidas_all:
        break_t = next((t for t in turnos_por_partida.get(p.id, []) if t.numero == 1), None)
        if break_t:
            n = sum(1 for b in break_t.bolas_metidas if b != 0)
            max_break_bolas = max(max_break_bolas, n)

    # --- Evaluar cada logro ---
    r: dict[str, bool] = {}
    _pid: dict[str, Optional[int]] = {}   # partida que desbloqueó cada logro

    # primera_partida
    r["primera_partida"] = total_partidas >= 1
    if r["primera_partida"]:
        _pid["primera_partida"] = min(partidas_all, key=lambda p: p.fecha).id

    # primera_victoria
    r["primera_victoria"] = total_victorias >= 1
    if r["primera_victoria"]:
        _pid["primera_victoria"] = min(victorias, key=lambda p: p.fecha).id

    # primeras_bolas: buscar la partida donde el acumulado cruza 10
    r["primeras_bolas"] = total_bolas >= 10
    if r["primeras_bolas"]:
        acum = 0
        for p in sorted(partidas_all, key=lambda p: p.fecha):
            acum += sum(
                sum(1 for b in t.bolas_metidas if b != 0)
                for t in turnos_por_partida.get(p.id, [])
            )
            if acum >= 10:
                _pid["primeras_bolas"] = p.id
                break

    # limpio
    r["limpio"] = len(limpias_bola8) >= 1
    if r["limpio"]:
        _pid["limpio"] = min(limpias_bola8, key=lambda p: p.fecha).id

    # Golden Break: turno 1 del jugador tiene la 9, y ganó esa partida (bola9)
    golden = False
    for p in sorted(victorias, key=lambda p: p.fecha):
        if p.modalidad != "bola9":
            continue
        break_t = next((t for t in turnos_por_partida.get(p.id, []) if t.numero == 1), None)
        if break_t and 9 in break_t.bolas_metidas:
            golden = True
            _pid["golden_break"] = p.id
            break
    r["golden_break"] = golden

    # Relámpago: victoria en <5 min
    relampago_p = next(
        (p for p in sorted(victorias, key=lambda p: p.fecha)
         if p.fecha_fin and (p.fecha_fin - p.fecha).total_seconds() < 300),
        None,
    )
    r["relampago"] = relampago_p is not None
    if relampago_p:
        _pid["relampago"] = relampago_p.id

    # Tirador: promedio ≥1.5 bolas/turno en alguna partida ganada
    tirador = False
    for p in sorted(victorias, key=lambda p: p.fecha):
        ts = turnos_por_partida.get(p.id, [])
        if ts and sum(len(t.bolas_metidas) for t in ts) / len(ts) >= 1.5:
            tirador = True
            _pid["tirador"] = p.id
            break
    r["tirador"] = tirador

    torneos_ganados = _torneos_ganados(jugador_id, session)
    r["campeon"]    = torneos_ganados >= 1
    r["tricampeon"] = torneos_ganados >= 3
    # campeon/tricampeon: partida_id = None (son logros de torneo)

    # Torpón: derrota causada específicamente por la regla "Tres faltas consecutivas".
    # Cuando logic.py detecta tres faltas del equipo, sobreescribe turno.falta_id = 10
    # ("Tres faltas consecutivas"). Basta con que el último turno del equipo tenga ese id.
    FALTA_TRES_CONSECUTIVAS = 10
    torpon = False
    for p in sorted(derrotas, key=lambda p: p.fecha):
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        mi_equipo_ids = {pj.jugador_id for pj in pj_por_partida.get(p.id, []) if pj.equipo == mi_equipo}
        equipo_ts = sorted(
            (t for t in todos_turnos_por_partida.get(p.id, []) if t.jugador_id in mi_equipo_ids),
            key=lambda t: t.numero,
        )
        if equipo_ts and (
            equipo_ts[-1].falta_id == FALTA_TRES_CONSECUTIVAS or
            FALTA_TRES_CONSECUTIVAS in (equipo_ts[-1].faltas_ids or [])
        ):
            torpon = True
            _pid["torpon"] = p.id
            break
    r["torpon"] = torpon

    # Nervios: derrota donde el último turno del jugador (post-break) tiene la 8
    nervios = False
    for p in sorted(derrotas, key=lambda p: p.fecha):
        if p.modalidad != "bola8":
            continue
        ts = sorted(turnos_por_partida.get(p.id, []), key=lambda t: t.numero)
        if ts and ts[-1].numero > 1 and 8 in ts[-1].bolas_metidas:
            nervios = True
            _pid["nervios"] = p.id
            break
    r["nervios"] = nervios

    # Polivalente
    first_b8 = next((p for p in sorted(victorias, key=lambda p: p.fecha) if p.modalidad == "bola8"), None)
    first_b9 = next((p for p in sorted(victorias, key=lambda p: p.fecha) if p.modalidad == "bola9"), None)
    r["polivalente"] = first_b8 is not None and first_b9 is not None
    if r["polivalente"]:
        _pid["polivalente"] = max(first_b8, first_b9, key=lambda p: p.fecha).id  # type: ignore[arg-type]

    # Verdugo: 3 victorias consecutivas contra el mismo rival
    verdugo = False
    for ps in partidas_por_rival.values():
        consec = 0
        for p in sorted(ps, key=lambda p: p.fecha):
            if p.id in victorias_set:
                consec += 1
                if consec >= 3:
                    verdugo = True
                    _pid["verdugo"] = p.id
                    break
            else:
                consec = 0
        if verdugo:
            break
    r["verdugo"] = verdugo

    # Maratoniano
    maratoniano_p = next(
        (p for p in sorted(partidas_finalizadas, key=lambda p: p.fecha)
         if p.fecha_fin and (p.fecha_fin - p.fecha).total_seconds() > 1800),
        None,
    )
    r["maratoniano"] = maratoniano_p is not None
    if maratoniano_p:
        _pid["maratoniano"] = maratoniano_p.id

    # Intocable: 5 victorias acumuladas sin cometer ninguna falta
    intocable_count = 0
    r["intocable"] = False
    for p in sorted(victorias, key=lambda p: p.fecha):
        if _victoria_sin_faltas(p):
            intocable_count += 1
            if intocable_count >= 5:
                r["intocable"] = True
                _pid["intocable"] = p.id
                break

    # Noctámbulo / Madrugador
    noctambulo_p = next(
        (p for p in sorted(partidas_all, key=lambda p: p.fecha) if 0 <= p.fecha.hour < 2),
        None,
    )
    r["noctambulo"] = noctambulo_p is not None
    if noctambulo_p:
        _pid["noctambulo"] = noctambulo_p.id

    madrugador_p = next(
        (p for p in sorted(partidas_all, key=lambda p: p.fecha) if 6 <= p.fecha.hour < 9),
        None,
    )
    r["madrugador"] = madrugador_p is not None
    if madrugador_p:
        _pid["madrugador"] = madrugador_p.id

    # Barrida: victoria bola8 donde el rival no metió ninguna bola de su grupo
    barrida = False
    for p in sorted(victorias, key=lambda p: p.fecha):
        if p.modalidad != "bola8" or not p.equipo1_grupo or not p.equipo2_grupo:
            continue
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        rival_equipo = 2 if mi_equipo == 1 else 1
        rival_grupo  = p.equipo1_grupo if rival_equipo == 1 else p.equipo2_grupo
        rival_bolas  = set(range(1, 8)) if rival_grupo == "lisas" else set(range(9, 16))
        rival_ids    = {pj.jugador_id for pj in pj_por_partida.get(p.id, []) if pj.equipo == rival_equipo}
        if not rival_ids:
            continue
        rival_metio  = any(
            bool(set(t.bolas_metidas) & rival_bolas)
            for t in todos_turnos_por_partida.get(p.id, [])
            if t.jugador_id in rival_ids
        )
        if not rival_metio:
            barrida = True
            _pid["barrida"] = p.id
            break
    r["barrida"] = barrida

    # Sesión perfecta: 3 victorias en el mismo día
    wins_por_dia: dict[str, int] = {}
    sesion = False
    for p in sorted(victorias, key=lambda p: p.fecha):
        dia = p.fecha.date().isoformat()
        wins_por_dia[dia] = wins_por_dia.get(dia, 0) + 1
        if wins_por_dia[dia] >= 3 and not sesion:
            sesion = True
            _pid["sesion_perfecta"] = p.id
    r["sesion_perfecta"] = sesion

    # Revancha: derrota seguida de victoria contra el mismo rival
    revancha = False
    for ps in partidas_por_rival.values():
        ps_ord = sorted(ps, key=lambda p: p.fecha)
        for i in range(1, len(ps_ord)):
            if ps_ord[i - 1].id not in victorias_set and ps_ord[i].id in victorias_set:
                revancha = True
                _pid["revancha"] = ps_ord[i].id
                break
        if revancha:
            break
    r["revancha"] = revancha

    # Blue balls: bola8, ambos grupos vaciados, y la 8 sin meterse en >3 turnos seguidos
    blue_balls = False
    for p in sorted(partidas_finalizadas, key=lambda p: p.fecha):
        if p.modalidad != "bola8" or not p.equipo1_grupo or not p.equipo2_grupo:
            continue
        if p.id not in equipo_por_partida:
            continue
        lisas   = set(range(1, 8))
        rayadas = set(range(9, 16))
        eq1_pend = lisas.copy()   if p.equipo1_grupo == "lisas"   else rayadas.copy()
        eq2_pend = lisas.copy()   if p.equipo2_grupo == "lisas"   else rayadas.copy()
        ambos_vaciados = False
        endgame_turnos = 0
        for t in sorted(todos_turnos_por_partida.get(p.id, []), key=lambda t: t.numero):
            for b in t.bolas_metidas:
                eq1_pend.discard(b) if b in eq1_pend else eq2_pend.discard(b)
            if not eq1_pend and not eq2_pend:
                ambos_vaciados = True
            if ambos_vaciados and 8 not in t.bolas_metidas:
                endgame_turnos += 1
                if endgame_turnos > 3:
                    blue_balls = True
                    _pid["blue_balls"] = p.id
                    break
        if blue_balls:
            break
    r["blue_balls"] = blue_balls

    # Woke: meter todas las bolas del propio grupo en orden arcoíris (bola8)
    woke = False
    for p in sorted(partidas_all, key=lambda p: p.fecha):
        if p.modalidad != "bola8" or not p.equipo1_grupo or not p.equipo2_grupo:
            continue
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        mi_grupo = p.equipo1_grupo if mi_equipo == 1 else p.equipo2_grupo
        rainbow  = RAINBOW_LISAS if mi_grupo == "lisas" else RAINBOW_RAYADAS
        rainbow_set = set(rainbow)
        pocketed_sequence = [
            b
            for t in sorted(turnos_por_partida.get(p.id, []), key=lambda t: t.numero)
            for b in t.bolas_metidas
            if b in rainbow_set
        ]
        if pocketed_sequence == rainbow:
            woke = True
            _pid["woke"] = p.id
            break
    r["woke"] = woke

    # Remontada: victoria bola8 donde en algún momento el rival tenía 0 bolas de grupo y tú ≥4
    remontada = False
    for p in sorted(victorias, key=lambda p: p.fecha):
        if p.modalidad != "bola8" or not p.equipo1_grupo or not p.equipo2_grupo:
            continue
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        mi_grupo    = p.equipo1_grupo if mi_equipo == 1 else p.equipo2_grupo
        rival_equipo = 2 if mi_equipo == 1 else 1
        rival_grupo  = p.equipo1_grupo if rival_equipo == 1 else p.equipo2_grupo
        mi_bolas_set    = set(range(1, 8)) if mi_grupo    == "lisas" else set(range(9, 16))
        rival_bolas_set = set(range(1, 8)) if rival_grupo == "lisas" else set(range(9, 16))
        mi_pend    = mi_bolas_set.copy()
        rival_pend = rival_bolas_set.copy()
        for t in sorted(todos_turnos_por_partida.get(p.id, []), key=lambda t: t.numero):
            for b in t.bolas_metidas:
                mi_pend.discard(b)
                rival_pend.discard(b)
            if len(rival_pend) == 0 and len(mi_pend) >= 4:
                remontada = True
                _pid["remontada"] = p.id
                break
        if remontada:
            break
    r["remontada"] = remontada

    # --- Niveles partida_id para logros nivelados ---
    _npid: dict[str, dict[str, int]] = {}

    # rodaje: la N-ésima partida (por fecha) cruza el umbral N
    if total_partidas > 0:
        p_ord = sorted(partidas_all, key=lambda p: p.fecha)
        _npid["rodaje"] = {
            n.nivel: p_ord[n.umbral - 1].id
            for n in NIVELES_RODAJE if n.umbral <= len(p_ord)
        }

    # crack: la N-ésima victoria cruza el umbral N
    if total_victorias > 0:
        v_ord = sorted(victorias, key=lambda p: p.fecha)
        _npid["crack"] = {
            n.nivel: v_ord[n.umbral - 1].id
            for n in NIVELES_CRACK if n.umbral <= len(v_ord)
        }

    # artillero: primera partida donde el acumulado de bolas cruza el umbral
    if total_bolas > 0:
        npid_art: dict[str, int] = {}
        acum_art = 0
        umbs = sorted(NIVELES_ARTILLERO, key=lambda n: n.umbral)
        u = 0
        for p in sorted(partidas_all, key=lambda p: p.fecha):
            acum_art += sum(
                sum(1 for b in t.bolas_metidas if b != 0)
                for t in turnos_por_partida.get(p.id, [])
            )
            while u < len(umbs) and acum_art >= umbs[u].umbral:
                npid_art[umbs[u].nivel] = p.id
                u += 1
            if u >= len(umbs):
                break
        _npid["artillero"] = npid_art

    # en_racha: primera vez que la racha consecutiva alcanza cada umbral
    if racha_max > 0:
        npid_racha: dict[str, int] = {}
        racha_act = 0
        umbs = sorted(NIVELES_RACHA, key=lambda n: n.umbral)
        u = 0
        for p in sorted(partidas_finalizadas, key=lambda p: p.fecha):
            if p.id in victorias_set:
                racha_act += 1
                while u < len(umbs) and racha_act >= umbs[u].umbral:
                    npid_racha[umbs[u].nivel] = p.id
                    u += 1
            else:
                racha_act = 0
            if u >= len(umbs):
                break
        _npid["en_racha"] = npid_racha

    # ubicate: primera partida (cronológica) donde opp_bolas >= umbral
    if max_opp_bolas > 0:
        opp_bolas_hist: list[tuple[Partida, int]] = []
        for p in sorted(partidas_all, key=lambda p: p.fecha):
            if p.modalidad != "bola8" or not p.equipo1_grupo or not p.equipo2_grupo:
                continue
            mi_eq = equipo_por_partida.get(p.id)
            if mi_eq is None:
                continue
            rival_eq = 2 if mi_eq == 1 else 1
            rival_grupo = p.equipo1_grupo if rival_eq == 1 else p.equipo2_grupo
            rival_bolas_set = set(range(1, 8)) if rival_grupo == "lisas" else set(range(9, 16))
            opp = sum(
                sum(1 for b in t.bolas_metidas if b in rival_bolas_set)
                for t in turnos_por_partida.get(p.id, [])
            )
            opp_bolas_hist.append((p, opp))
        _npid["ubicate"] = {
            n.nivel: next((p.id for p, v in opp_bolas_hist if v >= n.umbral), None)  # type: ignore[misc]
            for n in NIVELES_UBICATE
        }
        _npid["ubicate"] = {k: v for k, v in _npid["ubicate"].items() if v is not None}

    # destructor: primera partida donde las bolas del saque >= umbral
    if max_break_bolas > 0:
        breaks_hist: list[tuple[Partida, int]] = []
        for p in sorted(partidas_all, key=lambda p: p.fecha):
            bt = next((t for t in turnos_por_partida.get(p.id, []) if t.numero == 1), None)
            if bt:
                breaks_hist.append((p, sum(1 for b in bt.bolas_metidas if b != 0)))
        _npid["destructor"] = {
            n.nivel: next((p.id for p, v in breaks_hist if v >= n.umbral), None)  # type: ignore[misc]
            for n in NIVELES_DESTRUCTOR
        }
        _npid["destructor"] = {k: v for k, v in _npid["destructor"].items() if v is not None}

    # --- Construir respuesta ---
    niveles_map = {
        "rodaje":     (total_partidas,   NIVELES_RODAJE),
        "crack":      (total_victorias,  NIVELES_CRACK),
        "en_racha":   (racha_max,        NIVELES_RACHA),
        "artillero":  (total_bolas,      NIVELES_ARTILLERO),
        "ubicate":    (max_opp_bolas,    NIVELES_UBICATE),
        "destructor": (max_break_bolas,  NIVELES_DESTRUCTOR),
    }
    output = []
    for c in CATALOGO:
        if c.id in niveles_map:
            valor, niveles = niveles_map[c.id]
            nd = _niveles_desbloqueados(valor, niveles)
            output.append(LogroEstado(
                **c.model_dump(),
                desbloqueado=len(nd) > 0,
                nivel_actual=_nivel_actual(valor, niveles),
                niveles_desbloqueados=nd,
                progreso=valor,
                niveles_partida_id=_npid.get(c.id, {}),
            ))
        else:
            output.append(LogroEstado(
                **c.model_dump(),
                desbloqueado=r.get(c.id, False),
                nivel_actual=None,
                niveles_desbloqueados=[],
                partida_id=_pid.get(c.id),
                partida_numero=numero_map.get(_pid[c.id]) if _pid.get(c.id) else None,
            ))
    return output


# ---------------------------------------------------------------------------
# Vista global (todos los jugadores activos)
# ---------------------------------------------------------------------------

def calcular_logros_todos(jugadores: list, session: Session) -> list[LogroGlobal]:
    n_total = len(jugadores)
    jugadores_por_logro: dict[str, list[JugadorMinimo]] = {c.id: [] for c in CATALOGO}

    for j in jugadores:
        logros = calcular_logros(j.id, session)
        for logro in logros:
            if logro.desbloqueado:
                jugadores_por_logro[logro.id].append(
                    JugadorMinimo(id=j.id, nombre=j.nombre, color=j.color,
                                  partida_id=logro.partida_id, partida_numero=logro.partida_numero,
                                  progreso=logro.progreso, nivel_actual=logro.nivel_actual)
                )

    output = []
    for c in CATALOGO:
        j_list = sorted(
            jugadores_por_logro[c.id],
            key=lambda j: j.partida_numero if j.partida_numero is not None else float('inf'),
        )
        porcentaje = round(len(j_list) / n_total * 100, 1) if n_total > 0 else 0.0
        output.append(LogroGlobal(
            **c.model_dump(),
            jugadores=j_list,
            porcentaje=porcentaje,
        ))
    return output
