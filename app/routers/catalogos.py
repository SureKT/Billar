from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.models import Bola, Falta
from app.database import get_session

router = APIRouter(prefix="/api", tags=["catalogos"])


@router.get("/bolas", response_model=list[Bola])
def listar_bolas(session: Session = Depends(get_session)):
    return session.exec(select(Bola).order_by(Bola.numero)).all()


@router.get("/faltas", response_model=list[Falta])
def listar_faltas(session: Session = Depends(get_session)):
    return session.exec(select(Falta)).all()
