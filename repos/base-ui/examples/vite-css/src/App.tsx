import * as React from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import baseUILogo from './assets/base-ui.svg';
import { Switch } from './widgets/Switch';
import './App.css';

function App() {
  const [count, setCount] = React.useState(0);

  return (
    <React.Fragment>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://base-ui.com" target="_blank">
          <img src={baseUILogo} className="logo base-ui" alt="Base UI logo" />
        </a>
      </div>
      <h1>Vite + React + Base UI</h1>
      <div className="card">
        <Switch onCheckedChange={() => setCount((c) => c + 1)} />
        <p>
          Flicked the Switch {count} time{count !== 1 ? 's' : ''}.
        </p>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR.
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite, React, and Base UI logos to learn more.</p>
    </React.Fragment>
  );
}

export default App;
