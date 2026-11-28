import { expect } from 'vitest';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { createRenderer, describeConformance } from '#test-utils';
import { screen } from '@mui/internal-test-utils';

describe('<Dialog.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            {node}
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>,
      );
    },
  }));

  it('renders only when the dialog is mounted by default', async () => {
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Viewport data-testid="viewport">
              <Dialog.Popup data-testid="popup">Content</Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    const { user } = await render(<App />);

    expect(screen.queryByTestId('viewport')).toBe(null);

    await user.click(screen.getByText('Open'));

    expect(screen.getByTestId('viewport')).not.toBe(null);
    expect(screen.getByTestId('viewport')).toContain(screen.getByTestId('popup'));
  });

  it('stays mounted when used within a keepMounted portal', async () => {
    const { setProps } = await render(
      <Dialog.Root open modal={false}>
        <Dialog.Portal keepMounted>
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup>Content</Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    expect(screen.getByTestId('viewport')).not.toBe(null);

    await setProps({ open: false });

    expect(screen.getByTestId('viewport')).not.toBe(null);
  });
});
