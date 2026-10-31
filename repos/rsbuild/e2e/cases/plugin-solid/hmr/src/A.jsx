import { createSignal } from 'solid-js';
import B from './test-temp-B';

const App = () => {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <button id="A" type="button" onClick={() => setCount(count() + 1)}>
        A: {count()}
      </button>
      <B count={count} />
    </div>
  );
};

export default App;
