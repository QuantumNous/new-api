import { expect } from 'vitest';
import { createRenderer, screen } from '@mui/internal-test-utils';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Slider } from '@base-ui/react/slider';
import { describeConformance } from '../../../test/describeConformance';

describe('<Fieldset.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Fieldset.Root />, () => ({
    inheritComponent: 'fieldset',
    refInstanceof: window.HTMLFieldSetElement,
    render,
  }));

  it('sets the native disabled attribute', async () => {
    await render(
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>,
    );

    expect(screen.getByTestId('fieldset')).toHaveAttribute('disabled');
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('keeps nested fieldsets disabled when an ancestor fieldset is disabled', async () => {
    await render(
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Field.Root>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>,
    );

    expect(screen.getByTestId('control')).toHaveAttribute('disabled');
  });

  it('passes disabled to rendered Base UI roots', async () => {
    await render(
      <div>
        <Fieldset.Root disabled render={<RadioGroup data-testid="radio-group" />} />
        <Fieldset.Root disabled render={<CheckboxGroup />}>
          <Checkbox.Root name="apple" data-testid="checkbox" />
        </Fieldset.Root>
        <Fieldset.Root disabled render={<Slider.Root defaultValue={50} />}>
          <Slider.Control data-testid="slider-control">
            <Slider.Track>
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Fieldset.Root>
      </div>,
    );

    expect(screen.getByTestId('radio-group')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-disabled');
    expect(screen.getByTestId('slider-control')).toHaveAttribute('data-disabled');
  });
});
