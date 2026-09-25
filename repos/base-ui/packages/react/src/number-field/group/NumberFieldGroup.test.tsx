import { expect } from 'vitest';
import { screen } from '@mui/internal-test-utils';
import { NumberField } from '@base-ui/react/number-field';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NumberField.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.Group />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has role prop', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Group />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('group')).not.toBe(null);
  });
});
