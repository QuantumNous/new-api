import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TanstackPageRoot } from './pages/TanstackPage'
import { VirtuaPageRoot } from './pages/VirtuaPage'
import { VirtuosoPageRoot } from './pages/VirtuosoPage'
import { WindowPageRoot } from './pages/WindowPage'
import { installBenchAPI } from './lib/harness'
import {
  SCENARIOS,
  type LibraryName,
  type ScenarioInput,
} from './scenarios/types'

// Install window.bench BEFORE React renders so the Playwright runner can
// wait for it deterministically.
installBenchAPI()

function readQuery(): { lib: LibraryName; scenario: ScenarioInput } {
  const q = new URLSearchParams(window.location.search)
  const lib = (q.get('lib') ?? 'tanstack') as LibraryName
  const id = q.get('scenario') ?? 'mount-fixed-1k'
  const scenario = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!
  return { lib, scenario }
}

function App() {
  const { lib, scenario } = readQuery()
  switch (lib) {
    case 'tanstack':
      return <TanstackPageRoot scenario={scenario} />
    case 'virtua':
      return <VirtuaPageRoot scenario={scenario} />
    case 'virtuoso':
      return <VirtuosoPageRoot scenario={scenario} />
    case 'window':
      return <WindowPageRoot scenario={scenario} />
    default:
      return (
        <div style={{ padding: 24 }}>
          <h3>Unknown library: {lib}</h3>
          <p>Try ?lib=tanstack&scenario=mount-fixed-1k</p>
        </div>
      )
  }
}

const root = createRoot(document.getElementById('root')!)
// We measure raw library cost, not StrictMode's double-render. Run without it.
root.render(<App />)
