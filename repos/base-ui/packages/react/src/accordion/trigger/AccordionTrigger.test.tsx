import { expect } from 'vitest';
import { Accordion } from '@base-ui/react/accordion';
import { screen } from '@mui/internal-test-utils';
import { describeConformance, createRenderer } from '#test-utils';

describe('<Accordion.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node) =>
      render(
        <Accordion.Root>
          <Accordion.Item>{node}</Accordion.Item>
        </Accordion.Root>,
      ),
  }));

  it('keeps a non-native trigger tabbable', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} render={<span />}>
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('tabindex', '0');
  });
});
