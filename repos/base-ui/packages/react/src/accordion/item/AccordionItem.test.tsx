import { expect, vi } from 'vitest';
import { screen } from '@mui/internal-test-utils';
import { Accordion } from '@base-ui/react/accordion';
import { describeConformance, createRenderer, isJSDOM } from '#test-utils';

describe('<Accordion.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Item />, () => ({
    render: (node) => {
      return render(<Accordion.Root>{node}</Accordion.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('state', () => {
    it.skipIf(isJSDOM)(
      'does not report hidden=true after the item has started opening',
      async () => {
        const renderSpy = vi.fn();
        const { user } = await render(
          <Accordion.Root>
            <Accordion.Item
              render={(props, state) => {
                renderSpy(state);
                return <div {...props} />;
              }}
            >
              <Accordion.Header>
                <Accordion.Trigger>Trigger</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>Panel</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>,
        );

        await user.click(screen.getByRole('button', { name: 'Trigger' }));

        expect(
          renderSpy.mock.calls.some(([state]) => state.open === true && state.hidden === true),
        ).toBe(false);
      },
    );
  });
});
