import { expect } from 'vitest';
import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';
import { screen } from '@mui/internal-test-utils';

describe('<Combobox.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.GroupLabel />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Combobox.Root open>
          <Combobox.Group>{node}</Combobox.Group>
        </Combobox.Root>,
      );
    },
  }));

  describe('a11y attributes', () => {
    it('wires to group aria-labelledby', async () => {
      await render(
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>
                  <Combobox.GroupLabel>Label</Combobox.GroupLabel>
                </Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const group = screen.getByRole('group');
      const label = screen.getByText('Label');
      expect(group).toHaveAttribute('aria-labelledby', label.id);
    });

    it('uses provided id in aria-labelledby', async () => {
      await render(
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>
                  <Combobox.GroupLabel id="test-group">Label</Combobox.GroupLabel>
                </Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'test-group');
    });
  });
});
