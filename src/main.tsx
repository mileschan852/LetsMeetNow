import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const fallback = document.getElementById('debug-fallback')

window.onerror = function(msg, _url, line, col, err) {
  if (fallback) {
    fallback.style.background = '#FF0000'
    fallback.style.color = '#FFF'
    const fullMsg = err?.stack || String(msg)
    fallback.innerHTML = 'JS ERROR: ' + fullMsg.slice(0, 200) + ' @' + line + ':' + col
  }
  return false
}

window.onunhandledrejection = function(e: PromiseRejectionEvent) {
  if (fallback) {
    fallback.style.background = '#FF0000'
    fallback.style.color = '#FFF'
    const reason = e.reason
    const fullMsg = reason?.stack || String(reason)
    fallback.innerHTML = 'PROMISE ERROR: ' + fullMsg.slice(0, 200)
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No #root element')

// Aggressive: replace #root with a fresh clone to prevent React 19 hydration issues
const freshRoot = document.createElement('div')
freshRoot.id = 'root'
rootEl.parentNode!.replaceChild(freshRoot, rootEl)

try {
  createRoot(freshRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // React mounted — hide fallback
  if (fallback) {
    fallback.style.display = 'none'
  }
} catch (err) {
  if (fallback) {
    fallback.style.background = '#FF0000'
    fallback.style.color = '#FFF'
    fallback.innerHTML = 'MOUNT ERROR: ' + String(err).slice(0, 200)
  }
  console.error('React mount failed:', err)
}
