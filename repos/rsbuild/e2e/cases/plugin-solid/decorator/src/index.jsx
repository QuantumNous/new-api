import { render } from 'solid-js/web';

function withMessage(Component) {
  return class extends Component {
    message = 'decorator works';
  };
}

@withMessage
class ViewModel {}

const viewModel = new ViewModel();

const App = () => <div id="decorator">{viewModel.message}</div>;

render(App, document.getElementById('root'));
