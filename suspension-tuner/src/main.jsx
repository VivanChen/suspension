import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err) {
    return { err }
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ fontFamily: 'system-ui,sans-serif', padding: 24, maxWidth: 560, margin: '40px auto', color: '#fecaca', background: '#1a0a0a', borderRadius: 12, border: '1px solid #ef444466' }}>
          <h1 style={{ color: '#f87171', fontSize: 18, marginBottom: 12 }}>畫面載入失敗</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, color: '#fca5a5' }}>{String(this.state.err)}</pre>
          <p style={{ marginTop: 16, fontSize: 13, color: '#94a3b8' }}>若曾開過本站 PWA，請在開發者工具 → Application → Clear site data 後重新整理。</p>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
)
