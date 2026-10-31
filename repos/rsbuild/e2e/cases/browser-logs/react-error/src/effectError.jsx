import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function ComponentWithEffectError() {
  useEffect(() => {
    JSON.parse('invalid json');
  }, []);

  return <div>Component with effect error</div>;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<ComponentWithEffectError />);
