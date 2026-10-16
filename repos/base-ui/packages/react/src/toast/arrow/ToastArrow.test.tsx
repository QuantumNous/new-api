import { Toast } from '@base-ui/react/toast';
import { createRenderer, describeConformance } from '#test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Arrow />, () => ({
    refInstanceof: window.Element,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Positioner toast={toast}>{node}</Toast.Positioner>
        </Toast.Provider>,
      );
    },
  }));
});
