import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const fallback = document.getElementById('debug-fallback')

window.onerror = function(msg, url, line, col, err) {
  if (fallback) {
    fallback.style.background = '#FF0000'
    fallback.style.color = '#FFF'
    fallback.innerHTML = 'JS ERROR: ' + String(msg).slice(0, 100) + ' @' + line + ':' + col
  }
  return false
}

window.onunhandledrejection = function(e: PromiseRejectionEvent) {
  if (fallback) {
    fallback.style.background = '#FF0000'
    fallback.style.color = '#FFF'
    fallback.innerHTML = 'PROMISE ERROR: ' + String(e.reason).slice(0, 100)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// React mounted — update fallback instead of removing it
if (fallback) {
  fallback.style.background = '#00D4AA'
  fallback.style.color = '#000'
  fallback.innerHTML = 'React mounted OK'
  setTimeout(() => { if (fallback) fallback.style.opacity = '0.3' }, 3000)
}
