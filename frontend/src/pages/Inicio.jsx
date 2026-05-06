import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Inicio() {
  const { data: partidas, loading, error } = useApi(api.getPartidas)
  const navigate = useNavigate()

  if (loading) return <div className="spinner" />
  if (error) return <p style={{ color: 'var(--accent)', padding: '20px 0' }}>Error: {error}</p>

  const enCurso = partidas.filter(p => p.estado === 'en_curso')
  const finalizadas = partidas.filter(p => p.estado === 'finalizada')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {partidas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: 12 }}>🎱</div>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Sin partidas todavía</p>
          <button className="btn btn-primary" onClick={() => navigate('/nueva')}>
            Crear primera partida
          </button>
        </div>
      )}

      {enCurso.length > 0 && (
        <section>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 8 }}>
            En curso
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enCurso.map(p => <PartidaCard key={p.id} p={p} onClick={() => navigate(`/partida/${p.id}`)} />)}
          </div>
        </section>
      )}

      {finalizadas.length > 0 && (
        <section>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 8 }}>
            Finalizadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {finalizadas.map(p => <PartidaCard key={p.id} p={p} onClick={() => navigate(`/partida/${p.id}`)} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function PartidaCard({ p, onClick }) {
  const finalizada = p.estado === 'finalizada'

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface)',
        color: 'var(--text)',
        border: `1px solid ${finalizada ? 'var(--border)' : 'rgba(233,69,96,.3)'}`,
        borderRadius: 'var(--radius)',
        padding: 14,
        transition: 'border-color .15s, transform .1s',
        animation: 'slideUp .2s ease both',
      }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(.985)'}
      onTouchEnd={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
          {p.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
          <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '13px' }}> · #{p.id}</span>
        </span>
        <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`}>
          {finalizada ? 'Finalizada' : 'En curso'}
        </span>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: 8 }}>
        {formatFecha(p.fecha)}
      </p>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <EquipoInfo label="Eq 1" grupo={p.equipo1_grupo} ganador={finalizada && p.ganador_equipo === 1} />
        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>vs</span>
        <EquipoInfo label="Eq 2" grupo={p.equipo2_grupo} ganador={finalizada && p.ganador_equipo === 2} />
      </div>
    </button>
  )
}

function EquipoInfo({ label, grupo, ganador }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: '12px', color: ganador ? '#fcd34d' : 'var(--text-dim)' }}>
        {label} {ganador && '🏆'}
      </span>
      {grupo && <span className={`badge badge-${grupo}`} style={{ fontSize: '11px', padding: '1px 6px' }}>{grupo}</span>}
    </div>
  )
}
