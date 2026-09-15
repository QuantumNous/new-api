import { useState } from 'react';

export const Button = () => {
  const [count, setCount] = useState(0);

  return (
    <button id="button" type="button" onClick={() => setCount(count + 1)}>
      count: {count}
    </button>
  );
};
