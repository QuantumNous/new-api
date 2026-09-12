import { expect } from 'vitest';
import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';
import { screen, waitFor } from '@mui/internal-test-utils';

describe('<Combobox.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>{node}</Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
    },
  }));

  it('exposes open state via data attributes mapping', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const popup = await screen.findByTestId('popup');
    expect(popup).toHaveAttribute('data-open');
  });

  it('sets role to presentation when input renders outside the popup', async () => {
    await render(
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'presentation');
    });
  });

  it('sets role to dialog when input renders inside the popup', async () => {
    await render(
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'dialog');
    });
  });
});
