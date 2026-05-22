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


class LogroEstado(LogroCatalogo):
    desbloqueado: bool
    nivel_actual: Optional[str] = None
    niveles_desbloqueados: list[str] = []


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

# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------

CATALOGO: list[LogroCatalogo] = [
    LogroCatalogo(id="primera_partida",  nombre="Primera partida",  descripcion="Juega tu primera partida",                                   icono="🎱", niveles=[]),
    LogroCatalogo(id="primera_victoria", nombre="Primera victoria", descripcion="Gana tu primera partida",                                    icono="🏆", niveles=[]),
    LogroCatalogo(id="primeras_bolas",   nombre="Primeras bolas",   descripcion="Mete 10 bolas en total",                                     icono="🎳", niveles=[]),
    LogroCatalogo(id="rodaje",           nombre="Rodaje",           descripcion="Partidas jugadas",                                           icono="🎱", niveles=NIVELES_RODAJE),
    LogroCatalogo(id="crack",            nombre="Crack",            descripcion="Victorias totales",                                          icono="🥊", niveles=NIVELES_CRACK),
    LogroCatalogo(id="en_racha",         nombre="En racha",         descripcion="Victorias consecutivas",                                     icono="🔥", niveles=NIVELES_RACHA),
    LogroCatalogo(id="artillero",        nombre="Artillero",        descripcion="Bolas metidas en total",                                     icono="🎳", niveles=NIVELES_ARTILLERO),
    LogroCatalogo(id="limpio",           nombre="Limpio",           descripcion="Ganar una partida de Bola 8 sin ninguna falta",              icono="🧼", niveles=[]),
    LogroCatalogo(id="golden_break",     nombre="Golden Break",     descripcion="Ganar metiendo la 9 en el saque",                           icono="💥", niveles=[]),
    LogroCatalogo(id="relampago",        nombre="Relámpago",        descripcion="Ganar en menos de 5 minutos",                               icono="⚡", niveles=[]),
    LogroCatalogo(id="tirador",          nombre="Tirador",          descripcion="Promedio ≥1.5 bolas/turno en una partida ganada",           icono="🎯", niveles=[]),
    LogroCatalogo(id="campeon",          nombre="Campeón",          descripcion="Ganar un torneo",                                           icono="🥇", niveles=[]),
    LogroCatalogo(id="tricampeon",       nombre="Tricampeón",       descripcion="Ganar 3 torneos",                                           icono="👑", niveles=[]),
    LogroCatalogo(id="torpon",           nombre="Torpón",           descripcion="Perder una partida por tres faltas consecutivas del equipo", icono="🤦", niveles=[]),
    LogroCatalogo(id="nervios",          nombre="Nervios",          descripcion="Perder metiendo la 8 antes de tiempo",                      icono="😬", niveles=[]),
    LogroCatalogo(id="polivalente",      nombre="Polivalente",      descripcion="Ganar ≥1 Bola 8 y ≥1 Bola 9",                             icono="🎭", niveles=[]),
    LogroCatalogo(id="verdugo",          nombre="Verdugo",          descripcion="Ganar 3 veces seguidas contra el mismo rival",             icono="😈", niveles=[]),
    LogroCatalogo(id="maratoniano",      nombre="Maratoniano",      descripcion="Jugar una partida de más de 30 minutos",                   icono="⏱",  niveles=[]),
    LogroCatalogo(id="intocable",        nombre="Intocable",        descripcion="5 victorias acumuladas sin ninguna falta",                 icono="🎖️", niveles=[]),
    LogroCatalogo(id="noctambulo",       nombre="Noctámbulo",       descripcion="Partida registrada entre las 00:00 y las 02:00",           icono="🌙", niveles=[]),
    LogroCatalogo(id="madrugador",       nombre="Madrugador",       descripcion="Partida registrada entre las 06:00 y las 09:00",           icono="🌅", niveles=[]),
    LogroCatalogo(id="barrida",          nombre="Barrida",          descripcion="Ganar sin que el rival meta ninguna bola de su grupo (Bola 8)", icono="🧹", niveles=[]),
    LogroCatalogo(id="sesion_perfecta",  nombre="Sesión perfecta",  descripcion="Ganar 3 partidas en el mismo día",                        icono="📅", niveles=[]),
    LogroCatalogo(id="revancha",         nombre="Revancha",         descripcion="Ganar inmediatamente después de perder contra el mismo rival", icono="🔄", niveles=[]),
    LogroCatalogo(id="blue_balls",       nombre="Blue balls",       descripcion="Ambos grupos vaciados y la 8 sin meterse en 3+ turnos seguidos", icono="🔵", niveles=[]),
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

    # --- Cargar TODOS los turnos (para Barrida y Blue balls) ---
    todos_turnos = session.exec(
        select(Turno).where(Turno.partida_id.in_(partida_ids))
    ).all()
    todos_turnos_por_partida: dict[int, list[Turno]] = {}
    for t in todos_turnos:
        todos_turnos_por_partida.setdefault(t.partida_id, []).append(t)

    # --- Cargar PartidaJugador de todas las partidas (Verdugo, Revancha, Barrida) ---
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
    victorias_sin_faltas_count = sum(1 for p in victorias if _victoria_sin_faltas(p))

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

    # --- Evaluar cada logro ---
    r: dict[str, bool] = {}

    r["primera_partida"]  = total_partidas >= 1
    r["primera_victoria"] = total_victorias >= 1
    r["primeras_bolas"]   = total_bolas >= 10

    r["limpio"] = len(limpias_bola8) >= 1

    # Golden Break: turno 1 del jugador tiene la 9, y ganó esa partida (bola9)
    golden = False
    for p in victorias:
        if p.modalidad != "bola9":
            continue
        break_t = next((t for t in turnos_por_partida.get(p.id, []) if t.numero == 1), None)
        if break_t and 9 in break_t.bolas_metidas:
            golden = True
            break
    r["golden_break"] = golden

    # Relámpago: victoria en <5 min
    r["relampago"] = any(
        p.fecha_fin and (p.fecha_fin - p.fecha).total_seconds() < 300
        for p in victorias
    )

    # Tirador: promedio ≥1.5 bolas/turno en alguna partida ganada
    tirador = False
    for p in victorias:
        ts = turnos_por_partida.get(p.id, [])
        if ts and sum(len(t.bolas_metidas) for t in ts) / len(ts) >= 1.5:
            tirador = True
            break
    r["tirador"] = tirador

    torneos_ganados = _torneos_ganados(jugador_id, session)
    r["campeon"]    = torneos_ganados >= 1
    r["tricampeon"] = torneos_ganados >= 3

    # Torpón: derrota donde los últimos 3 turnos del equipo del jugador tienen falta
    torpon = False
    for p in derrotas:
        mi_equipo = equipo_por_partida.get(p.id)
        if mi_equipo is None:
            continue
        mi_equipo_ids = {pj.jugador_id for pj in pj_por_partida.get(p.id, []) if pj.equipo == mi_equipo}
        equipo_ts = sorted(
            (t for t in todos_turnos_por_partida.get(p.id, []) if t.jugador_id in mi_equipo_ids),
            key=lambda t: t.numero,
        )
        if len(equipo_ts) >= 3 and all(_turno_tiene_falta(t) for t in equipo_ts[-3:]):
            torpon = True
            break
    r["torpon"] = torpon

    # Nervios: derrota donde el último turno del jugador (post-break) tiene la 8
    nervios = False
    for p in derrotas:
        if p.modalidad != "bola8":
            continue
        ts = sorted(turnos_por_partida.get(p.id, []), key=lambda t: t.numero)
        if ts and ts[-1].numero > 1 and 8 in ts[-1].bolas_metidas:
            nervios = True
            break
    r["nervios"] = nervios

    r["polivalente"] = (
        any(p.modalidad == "bola8" for p in victorias) and
        any(p.modalidad == "bola9" for p in victorias)
    )

    # Verdugo: 3 victorias consecutivas contra el mismo rival
    verdugo = False
    for ps in partidas_por_rival.values():
        consec = 0
        for p in sorted(ps, key=lambda p: p.fecha):
            if p.id in victorias_set:
                consec += 1
                if consec >= 3:
                    verdugo = True
                    break
            else:
                consec = 0
        if verdugo:
            break
    r["verdugo"] = verdugo

    r["maratoniano"] = any(
        p.fecha_fin and (p.fecha_fin - p.fecha).total_seconds() > 1800
        for p in partidas_finalizadas
    )

    r["intocable"] = victorias_sin_faltas_count >= 5

    r["noctambulo"] = any(0 <= p.fecha.hour < 2  for p in partidas_all)
    r["madrugador"] = any(6 <= p.fecha.hour < 9  for p in partidas_all)

    # Barrida: victoria bola8 donde el rival no metió ninguna bola de su grupo
    barrida = False
    for p in victorias:
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
            break
    r["barrida"] = barrida

    # Sesión perfecta: 3 victorias en el mismo día
    wins_por_dia: dict[str, int] = {}
    sesion = False
    for p in victorias:
        dia = p.fecha.date().isoformat()
        wins_por_dia[dia] = wins_por_dia.get(dia, 0) + 1
        if wins_por_dia[dia] >= 3:
            sesion = True
            break
    r["sesion_perfecta"] = sesion

    # Revancha: derrota seguida de victoria contra el mismo rival
    revancha = False
    for ps in partidas_por_rival.values():
        ps_ord = sorted(ps, key=lambda p: p.fecha)
        for i in range(1, len(ps_ord)):
            if ps_ord[i - 1].id not in victorias_set and ps_ord[i].id in victorias_set:
                revancha = True
                break
        if revancha:
            break
    r["revancha"] = revancha

    # Blue balls: bola8, ambos grupos vaciados, y la 8 sin meterse en >3 turnos seguidos
    blue_balls = False
    for p in partidas_finalizadas:
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
                    break
        if blue_balls:
            break
    r["blue_balls"] = blue_balls

    # --- Construir respuesta ---
    niveles_map = {
        "rodaje":    (total_partidas,   NIVELES_RODAJE),
        "crack":     (total_victorias,  NIVELES_CRACK),
        "en_racha":  (racha_max,        NIVELES_RACHA),
        "artillero": (total_bolas,      NIVELES_ARTILLERO),
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
            ))
        else:
            output.append(LogroEstado(
                **c.model_dump(),
                desbloqueado=r.get(c.id, False),
                nivel_actual=None,
                niveles_desbloqueados=[],
            ))
    return output
