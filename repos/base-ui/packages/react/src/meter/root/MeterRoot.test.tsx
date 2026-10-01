import { expect, vi } from 'vitest';
import { Meter } from '@base-ui/react/meter';
import { screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Meter.Root />', () => {
  const { render } = createRenderer();

  function formatPercent(value: number) {
    return value.toLocaleString(undefined, { style: 'percent' });
  }

  describeConformance(<Meter.Root value={50} />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('ARIA attributes', () => {
    it('sets the correct aria attributes', async () => {
      await render(
        <Meter.Root value={30}>
          <Meter.Label>Battery Level</Meter.Label>
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>,
      );

      const meter = screen.getByRole('meter');

      expect(meter).toHaveAttribute('aria-valuenow', '30');
      expect(meter).toHaveAttribute('aria-valuemin', '0');
      expect(meter).toHaveAttribute('aria-valuemax', '100');
      expect(meter).toHaveAttribute('aria-valuetext', formatPercent(0.3));
      expect(meter.getAttribute('aria-labelledby')).toBe(
        screen.getByText('Battery Level').getAttribute('id'),
      );
    });

    it('defaults aria-valuetext to the localized formatted value, matching Meter.Value', async () => {
      // German percent formatting inserts a narrow no-break space before `%`, so the localized
      // output differs from the raw `30%` string.
      const expected = new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.3);

      await render(
        <Meter.Root value={30} locale="de-DE">
          <Meter.Value data-testid="value" />
        </Meter.Root>,
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuetext', expected);
      expect(meter.getAttribute('aria-valuetext')).toBe(screen.getByTestId('value').textContent);
    });

    it('rounds the default aria-valuetext like the displayed value', async () => {
      const expected = formatPercent(0.33333);

      await render(
        <Meter.Root value={33.333}>
          <Meter.Value data-testid="value" />
        </Meter.Root>,
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuetext', expected);
      expect(meter.getAttribute('aria-valuetext')).toBe(screen.getByTestId('value').textContent);
    });

    it('refreshes aria-valuenow, aria-valuetext, the value text, and the indicator when value changes', async () => {
      const fiftyPercent = formatPercent(0.5);
      const seventySevenPercent = formatPercent(0.77);

      const { setProps } = await render(
        <Meter.Root value={50}>
          <Meter.Value data-testid="value" />
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>,
      );
      const meter = screen.getByRole('meter');
      const value = screen.getByTestId('value');
      const indicator = screen.getByTestId('indicator');

      expect(meter).toHaveAttribute('aria-valuenow', '50');
      expect(meter).toHaveAttribute('aria-valuetext', fiftyPercent);
      expect(value.textContent).toBe(fiftyPercent);
      expect(indicator.style.width).toBe('50%');

      await setProps({ value: 77 });

      expect(meter).toHaveAttribute('aria-valuenow', '77');
      expect(meter).toHaveAttribute('aria-valuetext', seventySevenPercent);
      expect(value.textContent).toBe(seventySevenPercent);
      expect(indicator.style.width).toBe('77%');
    });
  });

  describe('prop: getAriaValueText', () => {
    it('uses the returned text and receives the formatted and raw value', async () => {
      const formatted = formatPercent(0.3);
      const getAriaValueText = vi.fn(
        (formattedValue: string, value: number) => `${value} of 100 (${formattedValue})`,
      );

      await render(
        <Meter.Root value={30} getAriaValueText={getAriaValueText}>
          <Meter.Value data-testid="value" />
        </Meter.Root>,
      );

      const meter = screen.getByRole('meter');
      expect(getAriaValueText).toHaveBeenCalledWith(formatted, 30);
      expect(meter).toHaveAttribute('aria-valuetext', `30 of 100 (${formatted})`);
      // getAriaValueText only affects the spoken text, not the visible value.
      expect(screen.getByTestId('value').textContent).toBe(formatted);
    });
  });

  describe('range', () => {
    it('formats the value as its position within a custom range and keeps the indicator in sync', async () => {
      const expected = formatPercent(0.5);

      await render(
        <Meter.Root value={0.5} min={0} max={1}>
          <Meter.Value data-testid="value" />
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>,
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '0.5');
      expect(meter).toHaveAttribute('aria-valuetext', expected);
      expect(screen.getByTestId('value').textContent).toBe(expected);
      expect(screen.getByTestId('indicator').style.width).toBe('50%');
    });

    it('formats the value relative to a non-zero min', async () => {
      const expected = formatPercent(0.5);

      await render(
        <Meter.Root value={30} min={20} max={40}>
          <Meter.Value data-testid="value" />
        </Meter.Root>,
      );

      expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', expected);
      expect(screen.getByTestId('value').textContent).toBe(expected);
    });

    it.each([
      {
        label: 'value exceeds max',
        props: { value: 150 },
        ariaValueNow: '100',
        ariaValueText: formatPercent(1),
      },
      {
        label: 'value is below min',
        props: { value: -10 },
        ariaValueNow: '0',
        ariaValueText: formatPercent(0),
      },
      {
        label: 'min equals max',
        props: { value: 5, min: 5, max: 5 },
        ariaValueNow: '5',
        ariaValueText: formatPercent(0),
      },
      {
        label: 'value is NaN',
        props: { value: Number.NaN },
        ariaValueNow: '0',
        ariaValueText: formatPercent(0),
      },
    ] as const)(
      'normalizes aria attributes when $label',
      async ({ props, ariaValueNow, ariaValueText }) => {
        await render(<Meter.Root {...props} />);

        const meter = screen.getByRole('meter');
        expect(meter).toHaveAttribute('aria-valuenow', ariaValueNow);
        expect(meter).toHaveAttribute('aria-valuetext', ariaValueText);
      },
    );
  });

  describe('prop: format', () => {
    it('formats the value', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }

      await render(
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value" />
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>,
      );

      const value = screen.getByTestId('value');
      const meter = screen.getByRole('meter');
      expect(value.textContent).toBe(formatValue(30));
      expect(meter).toHaveAttribute('aria-valuetext', formatValue(30));
    });

    it('formats the raw value while clamping range attributes and indicator width', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      const expectedValue = new Intl.NumberFormat(undefined, format).format(150);

      await render(
        <Meter.Root value={150} format={format}>
          <Meter.Value data-testid="value" />
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>,
      );

      const meter = screen.getByRole('meter');
      expect(screen.getByTestId('value').textContent).toBe(expectedValue);
      expect(meter).toHaveAttribute('aria-valuenow', '100');
      expect(meter).toHaveAttribute('aria-valuetext', expectedValue);
      expect(screen.getByTestId('indicator').style.width).toBe('100%');
    });
  });

  describe('prop: locale', () => {
    it('sets the locale when formatting the value', async () => {
      // In German locale, numbers use dot as thousands separator and comma as decimal separator
      const expectedValue = new Intl.NumberFormat('de-DE').format(86.49);

      await render(
        <Meter.Root
          value={86.49}
          format={{
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }}
          locale="de-DE"
        >
          <Meter.Value data-testid="value" />
        </Meter.Root>,
      );

      expect(screen.getByTestId('value').textContent).toBe(expectedValue);
    });
  });
});
