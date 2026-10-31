import { expect } from 'vitest';
import * as React from 'react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { describeConformance, createRenderer } from '#test-utils';

describe('<Radio.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Radio.Root value="" />, () => ({
    refInstanceof: window.HTMLSpanElement,
    testComponentPropWith: 'span',
    button: true,
    render,
  }));

  it('does not forward `value` prop', async () => {
    await render(
      <RadioGroup>
        <Radio.Root value="test" data-testid="radio-root" />
      </RadioGroup>,
    );

    expect(screen.getByTestId('radio-root')).not.toHaveAttribute('value');
  });

  it('allows `null` value', async () => {
    await render(
      <RadioGroup>
        <Radio.Root value={null} data-testid="radio-null" />
        <Radio.Root value="a" data-testid="radio-a" />
      </RadioGroup>,
    );

    const radioNull = screen.getByTestId('radio-null');
    const radioA = screen.getByTestId('radio-a');
    fireEvent.click(radioNull);
    expect(radioNull).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radioA);
    expect(radioNull).toHaveAttribute('aria-checked', 'false');
  });

  it('associates `id` with the native button when `nativeButton=true`', async () => {
    await render(
      <div>
        <label data-testid="label" htmlFor="myRadio">
          A
        </label>

        <RadioGroup defaultValue="b">
          <Radio.Root value="a" id="myRadio" nativeButton render={<button />} data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </div>,
    );

    const radioA = screen.getByTestId('a');
    expect(radioA).toHaveAttribute('id', 'myRadio');

    const hiddenInput = radioA.nextElementSibling as HTMLInputElement | null;
    expect(hiddenInput?.tagName).toBe('INPUT');
    expect(hiddenInput).not.toHaveAttribute('id', 'myRadio');

    expect(radioA).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('label'));
    expect(radioA).toHaveAttribute('aria-checked', 'true');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    await render(
      <div>
        <label htmlFor="radio-input">Label</label>
        <RadioGroup>
          <Radio.Root value="a" id="radio-input" />
        </RadioGroup>
      </div>,
    );

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('radio')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    function TestCase() {
      const [id, setId] = React.useState('radio-input-a');

      return (
        <React.Fragment>
          <label htmlFor="radio-input-a">Label A</label>
          <label htmlFor="radio-input-b">Label B</label>
          <RadioGroup>
            <Radio.Root value="a" id={id} />
          </RadioGroup>
          <button type="button" onClick={() => setId('radio-input-b')}>
            Toggle
          </button>
        </React.Fragment>
      );
    }

    await render(<TestCase />);

    const radio = screen.getByRole('radio');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.toBe('');
    expect(radio).toHaveAttribute('aria-labelledby', labelA.id);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      const labelB = screen.getByText('Label B');

      expect(labelB.id).not.toBe('');
      expect(labelA.id).not.toBe(labelB.id);
      expect(radio).toHaveAttribute('aria-labelledby', labelB.id);
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      await render(
        <RadioGroup>
          <Radio.Root value="a" disabled data-testid="radio" />
        </RadioGroup>,
      );

      const radio = screen.getByTestId('radio');
      expect(radio).not.toHaveAttribute('disabled');
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
