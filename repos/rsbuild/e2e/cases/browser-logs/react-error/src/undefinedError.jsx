import { createRoot } from 'react-dom/client';

function ComponentWithUndefinedError() {
  const data = undefined;
  return <div>{data.name}</div>;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<ComponentWithUndefinedError />);
