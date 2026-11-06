import Component from '@e2e/assets/circle.svg?react';
import url from '@e2e/assets/circle.svg?url';

function App() {
  return (
    <div>
      <Component id="component" />
      <img id="url" src={url} alt="url" />
    </div>
  );
}

export default App;
