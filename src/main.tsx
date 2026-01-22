import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runMigrations, seedDatabase, checkSeedNeeded } from './services/db'

async function initApp() {
  await runMigrations()
  if (await checkSeedNeeded()) {
    await seedDatabase()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initApp().catch(console.error)
