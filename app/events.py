"""
Pub/sub en memoria para Server-Sent Events.

broadcast() se puede llamar desde hilos síncronos (FastAPI thread pool);
internamente usa call_soon_threadsafe para cruzar al loop de asyncio.
"""
import asyncio
from collections import defaultdict

# partida_id → conjunto de colas asyncio (una por cliente conectado)
_subscribers: dict[int, set[asyncio.Queue]] = defaultdict(set)
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def broadcast(partida_id: int) -> None:
    """Notifica a todos los clientes suscritos a esta partida."""
    if _loop is None:
        return
    for q in list(_subscribers.get(partida_id, [])):
        try:
            _loop.call_soon_threadsafe(q.put_nowait, "update")
        except Exception:
            pass
