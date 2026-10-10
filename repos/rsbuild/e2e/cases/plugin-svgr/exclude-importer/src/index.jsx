import { createRoot } from 'react-dom/client';
import Bar from './Bar';
import Foo from './Foo';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <div>
      <Foo />
      <Bar />
    </div>,
  );
}
