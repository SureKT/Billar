import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          margin: '24px 16px',
          padding: '20px',
          borderRadius: 12,
          background: 'rgba(127,29,29,.35)',
          border: '1px solid #991b1b',
          color: '#fca5a5',
          fontFamily: 'inherit',
        }}>
          <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: 8 }}>
            ⚠ Error en la interfaz
          </p>
          <p style={{ fontSize: '13px', color: '#fda4af', marginBottom: 16, wordBreak: 'break-all' }}>
            {this.state.error?.message ?? String(this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: '14px', fontWeight: 600,
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
              color: '#fca5a5', cursor: 'pointer',
            }}
          >
            ↺ Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
