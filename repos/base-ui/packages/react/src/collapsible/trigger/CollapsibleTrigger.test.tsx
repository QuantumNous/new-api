import { expect } from 'vitest';
import { createRenderer, screen } from '@mui/internal-test-utils';
import { Collapsible } from '@base-ui/react/collapsible';
import { describeConformance } from '../../../test/describeConformance';

describe('<Collapsible.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Collapsible.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node) => {
      const { container, ...other } = render(<Collapsible.Root>{node}</Collapsible.Root>);

      return { container, ...other };
    },
  }));

  it('forwards the id prop', async () => {
    await render(
      <Collapsible.Root>
        <Collapsible.Trigger id="custom-trigger-id">Trigger</Collapsible.Trigger>
      </Collapsible.Root>,
    );

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'id',
      'custom-trigger-id',
    );
  });
});
