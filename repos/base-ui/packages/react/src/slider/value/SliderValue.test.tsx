import { expect, vi } from 'vitest';
import { screen } from '@mui/internal-test-utils';
import { Slider } from '@base-ui/react/slider';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Slider.Value />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Value />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLOutputElement,
  }));

  it('renders a single value', async () => {
    await render(
      <Slider.Root defaultValue={40}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).toHaveTextContent('40');
  });

  it('renders a range', async () => {
    await render(
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).toHaveTextContent('40 – 65');
  });

  it('renders all thumb values', async () => {
    await render(
      <Slider.Root defaultValue={[40, 60, 80, 95]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).toHaveTextContent('40 – 60 – 80 – 95');
  });

  describe('prop: children', () => {
    it('accepts a render function', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      const renderSpy = vi.fn();
      await render(
        <Slider.Root defaultValue={[40, 60]} format={format}>
          <Slider.Value data-testid="output">{renderSpy}</Slider.Value>
        </Slider.Root>,
      );

      expect(renderSpy.mock.lastCall?.[0]).toEqual([formatValue(40), formatValue(60)]);
      expect(renderSpy.mock.lastCall?.[1]).toEqual([40, 60]);
    });
  });
});
