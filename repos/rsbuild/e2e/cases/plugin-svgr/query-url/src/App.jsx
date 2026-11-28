import Logo from '@e2e/assets/mobile.svg';
import svgImg from '@e2e/assets/mobile.svg?url';
import './App.css';

function App() {
  return (
    <div>
      <Logo id="test-svg" />
      <img id="test-img" src={svgImg} alt="test" />
      <div id="test-css" />
    </div>
  );
}

export default App;
