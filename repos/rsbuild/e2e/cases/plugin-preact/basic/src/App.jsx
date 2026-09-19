import { useState } from 'preact/hooks';

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <button id="button" type="button" onClick={() => setCount(count + 1)}>
      count: {count}
    </button>
  );
};

export default App;
