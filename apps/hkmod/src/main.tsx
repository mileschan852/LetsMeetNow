import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Remove debug fallback — if this runs, React mounted successfully
const fallback = document.getElementById('debug-fallback')
if (fallback) fallback.remove()
