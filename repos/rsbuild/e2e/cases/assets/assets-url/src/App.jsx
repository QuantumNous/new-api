import img from '@e2e/assets/icon.png?url';
import imgWithQuery from '@e2e/assets/icon.png?url&variant=small';

function App() {
  return (
    <div>
      <div id="test">Hello Rsbuild!</div>
      <img id="test-img" src={img} alt="test" />
      <img id="test-img-with-query" src={imgWithQuery} alt="test" />
    </div>
  );
}

export default App;
