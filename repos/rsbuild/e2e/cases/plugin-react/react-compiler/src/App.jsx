import { useCounter } from './useCounter';

const App = () => {
  const { count, increment } = useCounter();

  return (
    <>
      <button id="button" type="button" onClick={increment}>
        count: {count}
      </button>
      <div className="content">
        <h1>Rsbuild with React</h1>
        <p>Start building amazing things with Rsbuild.</p>
      </div>
    </>
  );
};

export default App;
