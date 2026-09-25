import { useState } from 'react';

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <button
      id="button"
      className="bg-[#123456] px-4 py-2 text-white"
      type="button"
      onClick={() => setCount(count + 1)}
    >
      count: {count}
    </button>
  );
};

export default App;
