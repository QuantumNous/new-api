import { expect, vi } from 'vitest';
import { screen } from '@mui/internal-test-utils';
import { Progress } from '@base-ui/react/progress';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Progress.Value />', () => {
  const { render } = createRenderer();

  describeConformance(<Progress.Value />, () => ({
    render: (node) => {
      return render(<Progress.Root value={40}>{node}</Progress.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  describe('prop: children', () => {
    it('renders the value when children is not provided', async () => {
      await render(
        <Progress.Root value={30}>
          <Progress.Value data-testid="value" />
        </Progress.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value).toHaveTextContent((0.3).toLocaleString(undefined, { style: 'percent' }));
    });

    it('renders a formatted value when a format is provided', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }

      await render(
        <Progress.Root value={30} format={format}>
          <Progress.Value data-testid="value" />
        </Progress.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value).toHaveTextContent(formatValue(30));
    });

    describe('it accepts a render function', () => {
      it('numerical value', async () => {
        const renderSpy = vi.fn();
        const format: Intl.NumberFormatOptions = {
          style: 'currency',
          currency: 'USD',
        };
        function formatValue(v: number) {
          return new Intl.NumberFormat(undefined, format).format(v);
        }
        await render(
          <Progress.Root value={30} format={format}>
            <Progress.Value data-testid="value">{renderSpy}</Progress.Value>
          </Progress.Root>,
        );
        expect(renderSpy.mock.lastCall?.[0]).toEqual(formatValue(30));
        expect(renderSpy.mock.lastCall?.[1]).toEqual(30);
      });

      it('indeterminate value', async () => {
        const renderSpy = vi.fn();
        const format: Intl.NumberFormatOptions = {
          style: 'currency',
          currency: 'USD',
        };
        await render(
          <Progress.Root value={null} format={format}>
            <Progress.Value data-testid="value">{renderSpy}</Progress.Value>
          </Progress.Root>,
        );
        expect(renderSpy.mock.lastCall?.[0]).toEqual('indeterminate');
        expect(renderSpy.mock.lastCall?.[1]).toEqual(null);
      });
    });
  });
});
