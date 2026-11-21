import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/alexandria/arabic-400.css'
import '@fontsource/alexandria/arabic-600.css'
import '@fontsource/alexandria/arabic-700.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-300.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
