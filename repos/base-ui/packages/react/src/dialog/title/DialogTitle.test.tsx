import { Dialog } from '@base-ui/react/dialog';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Dialog.Title />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Title />, () => ({
    refInstanceof: window.HTMLHeadingElement,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>{node}</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );
    },
  }));
});
