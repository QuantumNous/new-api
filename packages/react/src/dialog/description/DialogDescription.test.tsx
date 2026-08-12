import { Dialog } from '@base-ui/react/dialog';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Dialog.Description />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Description />, () => ({
    refInstanceof: window.HTMLParagraphElement,
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
