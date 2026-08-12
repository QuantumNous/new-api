'use client';

import { useState } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';

export function Client({ actions }) {
  const [log, setLog] = useState('');

  // Test `createStreamableValue` and `readStreamableValue` APIs
  async function testStreamableValue() {
    const value = await actions.streamableValue();

    const values = [];
    for await (const val of readStreamableValue(value)) {
      values.push(val);
      setLog(JSON.stringify(values));
    }
  }

  // Test `createStreamableUI` API
  async function testStreamableUI() {
    const value = await actions.streamableUI();
    setLog(value);
  }

  return (
    <div>
      <pre id="log" style={{ border: '1px solid #ccc', padding: 5 }}>
        {log}
      </pre>

      {/* Test suites */}
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 5 }}>
        <button id="test-streamable-value" onClick={testStreamableValue}>
          Test Streamable Value
        </button>
        <button id="test-streamable-ui" onClick={testStreamableUI}>
          Test Streamable UI
        </button>
      </div>
    </div>
  );
}
