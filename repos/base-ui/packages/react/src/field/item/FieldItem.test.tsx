import { expect, vi } from 'vitest';
import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { createRenderer, screen } from '@mui/internal-test-utils';
import { describeConformance } from '../../../test/describeConformance';

describe('<Field.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Item />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Field.Root>{node}</Field.Root>);
    },
  }));

  describe('prop: disabled', () => {
    it('reflects disabled state on the item', async () => {
      const renderItem = vi.fn();
      function renderFieldItem(
        props: React.HTMLAttributes<HTMLDivElement>,
        state: Field.Item.State,
      ) {
        renderItem(state);
        return <div {...props} />;
      }

      await render(
        <Field.Root>
          <Field.Item disabled data-testid="item" render={renderFieldItem} />
        </Field.Root>,
      );

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
      expect(renderItem.mock.lastCall?.[0].disabled).toBe(true);
    });

    it('disables a wrapped checkbox', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={[]} onValueChange={onValueChange}>
            <Field.Item disabled>
              <Checkbox.Root value="fuji-apple" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="gala-apple" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );
      const [checkbox1, checkbox2] = screen.getAllByRole('checkbox');
      await user.click(checkbox1);
      expect(onValueChange.mock.calls.length).toBe(0);
      await user.click(checkbox2);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('disables a wrapped radio', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Field.Root name="apple">
          <RadioGroup defaultValue="" onValueChange={onValueChange}>
            <Field.Item disabled>
              <Radio.Root value="fuji-apple" />
            </Field.Item>
            <Field.Item>
              <Radio.Root value="gala-apple" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>,
      );
      const [radio1, radio2] = screen.getAllByRole('radio');
      await user.click(radio1);
      expect(onValueChange.mock.calls.length).toBe(0);
      await user.click(radio2);
      expect(onValueChange.mock.calls.length).toBe(1);
    });
  });
});
