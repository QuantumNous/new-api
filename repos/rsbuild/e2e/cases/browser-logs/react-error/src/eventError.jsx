import { createRoot } from 'react-dom/client';

function ComponentWithEventError() {
  const handleClick = () => {
    const obj = null;
    obj.someMethod();
  };

  return (
    <button type="button" onClick={handleClick}>
      Click me to trigger error
    </button>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<ComponentWithEventError />);
