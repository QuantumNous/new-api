import './App.css';
import stylesForLess from './App.module.less';
import stylesForSass from './App.module.scss';

const App = () => (
  <div className="container">
    <p className={stylesForSass.header} id="header">
      header
    </p>
    <p className={stylesForLess.title} id="title">
      title
    </p>
    <p className="description" id="description">
      description
    </p>
  </div>
);

export default App;
