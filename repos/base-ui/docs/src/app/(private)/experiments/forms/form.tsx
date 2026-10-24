'use client';
import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { Form } from '@base-ui/react/form';
import { Select } from '@base-ui/react/select';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Switch } from '@base-ui/react/switch';
import { NumberField } from '@base-ui/react/number-field';
import { Slider } from '@base-ui/react/slider';
import { Combobox } from '@base-ui/react/combobox';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { z } from 'zod';
import styles from './form.module.css';

import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';

const fonts = [
  { value: 'sans', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
  { value: 'cursive', label: 'Cursive' },
];

const schema = z.object({
  input: z.string().min(1, 'This field is required'),
  'required-checkbox': z.enum(['on']),
  switch: z.enum(['on']),
  slider: z.number().max(90, 'Too loud'),
  'range-slider': z.array(z.number()),
  'number-field': z.number().min(0).max(100),
  select: z.enum(['sans', 'serif', 'mono', 'cursive']),
  'radio-group': z.enum(['auto', 'scrolling', 'always']),
  'multi-select': z.array(z.enum(['sans', 'serif', 'mono', 'cursive'])).min(1),
  combobox: z.string().min(1, 'Please select a framework'),
  autocomplete: z.string().min(1, 'Please input a framework'),
});

interface Settings {
  native: boolean;
  validationMode: Form.Props['validationMode'];
}

const frameworks = ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js', 'Gatsby', 'Remix'];

interface MyFormValues {
  input: string;
  'required-checkbox': boolean;
  switch: boolean;
  slider: number;
  'range-slider': number[];
  'number-field': number;
  select: string[];
  'radio-group': string[];
  'multi-select': string[];
  combobox: string;
  autocomplete: string;
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  native: {
    type: 'boolean',
    label: 'Native validation',
    default: true,
  },
  validationMode: {
    type: 'string',
    label: 'Validation mode',
    options: ['onSubmit', 'onBlur', 'onChange'],
    default: 'onSubmit',
  },
};

async function submitForm(values: MyFormValues, native: boolean) {
  if (native) {
    return {
      errors: {},
    };
  }

  const result = schema.safeParse(values);

  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors,
    };
  }

  return {
    errors: {},
  };
}

export default function Page() {
  const { settings } = useExperimentSettings<Settings>();
  const native = settings.native;
  const [errors, setErrors] = React.useState({});

  const numberFieldValueRef = React.useRef<number | null>(null);
  const [checkboxGroupValue, setCheckboxGroupValue] = React.useState<string[]>([]);

  return (
    <div>
      <h1>Form</h1>

      <hr style={{ margin: '1rem 0' }} />

      <Form<MyFormValues>
        className={styles.Form}
        errors={errors}
        onFormSubmit={async (values) => {
          const response = await submitForm(values, native);
          setErrors(response.errors);
        }}
        validationMode={settings.validationMode}
      >
        <Field.Root name="input" className={styles.Field}>
          <Field.Label className={styles.Label}>Local hostname</Field.Label>
          <Field.Control
            required={native}
            placeholder="e.g. martin.local"
            className={styles.Input}
          />
          <Field.Description className={styles.Description}>
            Use this name to reach this computer from your local subnet
          </Field.Description>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="checkbox" className={styles.Field}>
          <Field.Label className={styles.Label}>
            <Checkbox.Root className={styles.Checkbox}>
              <Checkbox.Indicator className={styles.CheckboxIndicator}>
                <CheckIcon />
              </Checkbox.Indicator>
            </Checkbox.Root>
            Reduce motion
          </Field.Label>
        </Field.Root>

        <Field.Root name="required-checkbox" className={styles.Field}>
          <Field.Label className={styles.Label}>
            <Checkbox.Root required={native} className={styles.Checkbox}>
              <Checkbox.Indicator className={styles.CheckboxIndicator}>
                <CheckIcon />
              </Checkbox.Indicator>
            </Checkbox.Root>
            I have downloaded or saved these backup codes
          </Field.Label>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="switch" className={styles.Field}>
          <Field.Label className={styles.Label}>
            <Switch.Root required={native} className={styles.Switch}>
              <Switch.Thumb className={styles.Thumb} />
            </Switch.Root>
            Increase contrast
          </Field.Label>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="slider" className={styles.Field}>
          <Slider.Root defaultValue={25} className={styles.Slider}>
            <Field.Label className={styles.Label}>Volume</Field.Label>
            <Slider.Value className={styles.SliderValue} />
            <Slider.Control className={styles.SliderControl}>
              <Slider.Track className={styles.SliderTrack}>
                <Slider.Indicator className={styles.SliderIndicator} />
                <Slider.Thumb className={styles.SliderThumb} />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="range-slider" className={styles.Field}>
          <Fieldset.Root
            render={
              <Slider.Root
                defaultValue={[500, 1200]}
                min={100}
                max={2000}
                step={1}
                minStepsBetweenValues={1}
                className={styles.Slider}
                format={{
                  style: 'currency',
                  currency: 'EUR',
                }}
                locale="nl-NL"
              />
            }
          >
            <Fieldset.Legend className={styles.Label}>Price range</Fieldset.Legend>
            <Slider.Value className={styles.SliderValue} />
            <Slider.Control className={styles.SliderControl}>
              <Slider.Track className={styles.SliderTrack}>
                <Slider.Indicator className={styles.SliderIndicator} />
                <Slider.Thumb index={0} className={styles.SliderThumb} />
                <Slider.Thumb index={1} className={styles.SliderThumb} />
              </Slider.Track>
            </Slider.Control>
          </Fieldset.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="number-field" className={styles.Field}>
          <Field.Label className={styles.Label}>Quantity</Field.Label>
          <NumberField.Root
            required={native}
            className={styles.Field}
            onValueChange={(value) => {
              numberFieldValueRef.current = value;
            }}
          >
            <NumberField.Group className={styles.NumberField}>
              <NumberField.Decrement className={styles.Decrement}>-</NumberField.Decrement>
              <NumberField.Input className={styles.Input} />
              <NumberField.Increment className={styles.Increment}>+</NumberField.Increment>
            </NumberField.Group>
          </NumberField.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="select" className={styles.Field}>
          <Field.Label className={styles.Label}>Font</Field.Label>
          <Select.Root required={native}>
            <Select.Trigger className={styles.Select}>
              <Select.Value />
              <Select.Icon className={styles.SelectIcon}>
                <ChevronUpDownIcon />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className={styles.Positioner} sideOffset={8}>
                <Select.ScrollUpArrow className={styles.ScrollArrow} />
                <Select.Popup className={styles.Popup}>
                  <Select.Item className={styles.Item} value="sans">
                    <Select.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Select.ItemIndicator>

                    <Select.ItemText className={styles.ItemText}>Sans-serif</Select.ItemText>
                  </Select.Item>
                  <Select.Item className={styles.Item} value="serif">
                    <Select.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Select.ItemIndicator>

                    <Select.ItemText className={styles.ItemText}>Serif</Select.ItemText>
                  </Select.Item>
                  <Select.Item className={styles.Item} value="mono">
                    <Select.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Select.ItemIndicator>

                    <Select.ItemText className={styles.ItemText}>Monospace</Select.ItemText>
                  </Select.Item>
                  <Select.Item className={styles.Item} value="cursive">
                    <Select.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Select.ItemIndicator>

                    <Select.ItemText className={styles.ItemText}>Cursive</Select.ItemText>
                  </Select.Item>
                </Select.Popup>
                <Select.ScrollDownArrow className={styles.ScrollArrow} />
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="radio-group" className={styles.Field}>
          <Fieldset.Root render={<RadioGroup required={native} className={styles.RadioGroup} />}>
            <Fieldset.Legend className={styles.Legend}>Show scroll bars</Fieldset.Legend>

            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Radio.Root value="auto" className={styles.Radio}>
                  <Radio.Indicator className={styles.Indicator} />
                </Radio.Root>
                Automatically based on mouse or trackpad
              </Field.Label>
            </Field.Item>

            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Radio.Root value="scrolling" className={styles.Radio}>
                  <Radio.Indicator className={styles.Indicator} />
                </Radio.Root>
                When scrolling
              </Field.Label>
            </Field.Item>

            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Radio.Root value="always" className={styles.Radio}>
                  <Radio.Indicator className={styles.Indicator} />
                </Radio.Root>
                Always
              </Field.Label>
            </Field.Item>
          </Fieldset.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="combobox" className={styles.Field}>
          <Field.Label className={styles.Label}>Framework (Combobox)</Field.Label>
          <Combobox.Root required={native} items={frameworks}>
            <Combobox.Input placeholder="Select a framework" className={styles.Input} />
            <Combobox.Portal>
              <Combobox.Positioner className={styles.Positioner} sideOffset={8}>
                <Combobox.Popup className={styles.Popup}>
                  <Combobox.Empty className={styles.Empty}>No frameworks found</Combobox.Empty>
                  <Combobox.List>
                    {(framework) => (
                      <Combobox.Item key={framework} className={styles.Item} value={framework}>
                        {framework}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="autocomplete" className={styles.Field}>
          <Field.Label className={styles.Label}>Framework (Autocomplete)</Field.Label>
          <Autocomplete.Root required={native} items={frameworks}>
            <Autocomplete.Input placeholder="Input framework" className={styles.Input} />
            <Autocomplete.Portal>
              <Autocomplete.Positioner className={styles.Positioner} sideOffset={8}>
                <Autocomplete.Popup className={styles.Popup}>
                  <Autocomplete.Empty className={styles.Empty}>
                    No frameworks found
                  </Autocomplete.Empty>
                  <Autocomplete.List>
                    {(framework) => (
                      <Autocomplete.Item key={framework} className={styles.Item} value={framework}>
                        {framework}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <Field.Root name="checkbox-group" className={styles.Field}>
          <Fieldset.Root
            render={
              <CheckboxGroup
                value={checkboxGroupValue}
                onValueChange={setCheckboxGroupValue}
                allValues={ALL_CHECKBOX_GROUP_VALUES}
                className={styles.CheckboxGroup}
              />
            }
          >
            <Fieldset.Legend className={styles.Legend}>Content blocking</Fieldset.Legend>
            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Checkbox.Root parent className={styles.Checkbox}>
                  <Checkbox.Indicator
                    className={styles.CheckboxIndicator}
                    render={(props, state) => (
                      <span {...props}>
                        {state.indeterminate ? (
                          <HorizontalRuleIcon className={styles.Icon} />
                        ) : (
                          <CheckIcon className={styles.Icon} />
                        )}
                      </span>
                    )}
                  />
                </Checkbox.Root>
                Block everything
              </Field.Label>
            </Field.Item>

            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Checkbox.Root value="ads" className={styles.Checkbox}>
                  <Checkbox.Indicator className={styles.CheckboxIndicator}>
                    <CheckIcon className={styles.Icon} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                Block ads
              </Field.Label>
            </Field.Item>

            <Field.Item className={styles.FieldItem}>
              <Checkbox.Root value="annoyances" className={styles.Checkbox}>
                <Checkbox.Indicator className={styles.CheckboxIndicator}>
                  <CheckIcon className={styles.Icon} />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <div className={styles.FieldItemName}>
                <Field.Label className={styles.Label}>Block annoyances</Field.Label>
                <Field.Description className={styles.Description}>
                  Blocks social media content and in-page pop-ups
                </Field.Description>
              </div>
            </Field.Item>

            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Checkbox.Root value="comments" className={styles.Checkbox}>
                  <Checkbox.Indicator className={styles.CheckboxIndicator}>
                    <CheckIcon className={styles.Icon} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                Block comments
              </Field.Label>
            </Field.Item>

            <Field.Item className={styles.FieldItem}>
              <Field.Label className={styles.Label}>
                <Checkbox.Root value="trackers" className={styles.Checkbox}>
                  <Checkbox.Indicator className={styles.CheckboxIndicator}>
                    <CheckIcon className={styles.Icon} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                Block trackers
              </Field.Label>
            </Field.Item>
          </Fieldset.Root>
        </Field.Root>

        <Field.Root name="multi-select" className={styles.Field}>
          <Field.Label className={styles.Label}>Fonts (multiple)</Field.Label>
          <Select.Root multiple required={native} items={fonts}>
            <Select.Trigger className={styles.Select}>
              <Select.Value>
                {(value: string[]) =>
                  value.length > 0
                    ? value.map((v) => fonts.find((f) => f.value === v)?.label).join(', ')
                    : 'Select fonts…'
                }
              </Select.Value>
              <Select.Icon className={styles.SelectIcon}>
                <ChevronUpDownIcon />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className={styles.Positioner} sideOffset={8}>
                <Select.ScrollUpArrow className={styles.ScrollArrow} />
                <Select.Popup className={styles.Popup}>
                  {fonts.map(({ value, label }) => (
                    <Select.Item key={value} className={styles.Item} value={value}>
                      <Select.ItemIndicator className={styles.ItemIndicator}>
                        <CheckIcon className={styles.ItemIndicatorIcon} />
                      </Select.ItemIndicator>
                      <Select.ItemText className={styles.ItemText}>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
                <Select.ScrollDownArrow className={styles.ScrollArrow} />
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error className={styles.Error} />
        </Field.Root>

        <button type="submit" className={styles.Button}>
          Submit
        </button>
      </Form>
    </div>
  );
}

const ALL_CHECKBOX_GROUP_VALUES = ['ads', 'annoyances', 'comments', 'trackers'];

function ChevronUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M0.5 4.5L4 1.5L7.5 4.5" />
      <path d="M0.5 7.5L4 10.5L7.5 7.5" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function HorizontalRuleIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <line
        x1="3"
        y1="12"
        x2="21"
        y2="12"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
