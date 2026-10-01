'use client';
import * as React from 'react';
import { useForm, Controller, type Mode } from 'react-hook-form';
import { Form } from '@base-ui/react/form';
import { Fieldset } from '@base-ui/react/fieldset';
import { Field } from '@base-ui/react/field';
import { Checkbox } from '@base-ui/react/checkbox';
import { Switch } from '@base-ui/react/switch';
import { Slider } from '@base-ui/react/slider';
import { NumberField } from '@base-ui/react/number-field';
import { Select } from '@base-ui/react/select';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';

import styles from './form.module.css';
import { CheckIcon, ChevronUpDownIcon, HorizontalRuleIcon } from './_icons';

import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';

interface Settings {
  validationMode: Mode;
}

interface FormValues {
  username: string;
  checkbox: boolean;
  requiredCheckbox: boolean;
  switch: boolean;
  slider: number;
  numberField: number;
  selectCountry: string;
  radioGroup: string;
  checkboxGroup: string[];
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  validationMode: {
    type: 'string',
    label: 'Validation mode',
    options: ['onSubmit', 'onBlur'],
    default: 'onBlur',
  },
};

export default function ExampleForm() {
  const { settings } = useExperimentSettings<Settings>();

  const [loading, setLoading] = React.useState(false);

  const { handleSubmit, control, reset, setError, setFocus } = useForm<FormValues>({
    defaultValues: {
      username: '',
      checkbox: true,
      requiredCheckbox: false,
      switch: false,
      slider: 45,
      numberField: 5,
      selectCountry: '',
      radioGroup: 'auto',
      checkboxGroup: [],
    },
    mode: settings.validationMode,
  });

  async function submitForm(data: FormValues) {
    setLoading(true);

    // Mimic a server response
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    console.log('submitted', data);

    if (data.username === 'alice') {
      setError('username', {
        type: 'serverError',
        message: 'Username is already taken',
      });
      setFocus('username');
    }

    setLoading(false);
    return { success: true };
  }

  return (
    <div>
      <h1>react-hook-form</h1>

      <hr style={{ margin: '1rem 0' }} />
      <Form className={styles.Form} onSubmit={handleSubmit(submitForm)}>
        <Controller
          name="username"
          control={control}
          rules={{
            required: 'Username is required',
            minLength: { value: 2, message: 'Too short' },
          }}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>Username</Field.Label>
                <Field.Control
                  placeholder="Required"
                  className={styles.Input}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={field.onChange}
                  ref={field.ref}
                />
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="checkbox"
          control={control}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>
                  <Checkbox.Root
                    checked={field.value}
                    onBlur={field.onBlur}
                    onCheckedChange={field.onChange}
                    inputRef={field.ref}
                    className={styles.Checkbox}
                  >
                    <Checkbox.Indicator className={styles.CheckboxIndicator}>
                      <CheckIcon />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  Reduce motion
                </Field.Label>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="requiredCheckbox"
          control={control}
          rules={{
            required: 'You must check this to continue',
          }}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>
                  <Checkbox.Root
                    checked={field.value}
                    onBlur={field.onBlur}
                    onCheckedChange={field.onChange}
                    inputRef={field.ref}
                    className={styles.Checkbox}
                  >
                    <Checkbox.Indicator className={styles.CheckboxIndicator}>
                      <CheckIcon />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  I have read the EULA
                </Field.Label>
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="switch"
          control={control}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>
                  <Switch.Root
                    checked={field.value}
                    onBlur={field.onBlur}
                    onCheckedChange={field.onChange}
                    inputRef={field.ref}
                    className={styles.Switch}
                  >
                    <Switch.Thumb className={styles.Thumb} />
                  </Switch.Root>
                  Night shift
                </Field.Label>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="slider"
          control={control}
          rules={{
            validate: (value) => {
              if (value > 90) {
                return 'Too loud';
              }
              return true;
            },
          }}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>Volume</Field.Label>
                <Slider.Root
                  value={field.value}
                  onValueChange={field.onChange}
                  className={styles.Slider}
                >
                  <Slider.Control className={styles.SliderControl}>
                    <Slider.Track className={styles.SliderTrack}>
                      <Slider.Indicator className={styles.SliderIndicator} />
                      <Slider.Thumb
                        inputRef={field.ref}
                        onBlur={field.onBlur}
                        className={styles.SliderThumb}
                      />
                    </Slider.Track>
                  </Slider.Control>
                </Slider.Root>
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="numberField"
          control={control}
          rules={{
            validate: (value) => {
              if (value > 20) {
                return 'Out of stock';
              }
              return true;
            },
          }}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>Quantity</Field.Label>
                <NumberField.Root
                  value={field.value}
                  onValueChange={field.onChange}
                  className={styles.Field}
                >
                  <NumberField.Group className={styles.NumberField}>
                    <NumberField.Decrement className={styles.Decrement}>-</NumberField.Decrement>
                    <NumberField.Input
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className={styles.Input}
                    />
                    <NumberField.Increment className={styles.Increment}>+</NumberField.Increment>
                  </NumberField.Group>
                </NumberField.Root>
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="selectCountry"
          control={control}
          rules={{
            required: 'You must select a country',
          }}
          render={({ field, fieldState }) => {
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                className={styles.Field}
              >
                <Field.Label className={styles.Label}>Country</Field.Label>
                <Select.Root
                  value={field.value}
                  onValueChange={field.onChange}
                  inputRef={field.ref}
                >
                  <Select.Trigger onBlur={field.onBlur} className={styles.Select}>
                    <Select.Value>
                      {(value) => {
                        if (value == null) {
                          return 'Select…';
                        }
                        const country = COUNTRIES.find((c) => c.iso2 === value);
                        return country?.name;
                      }}
                    </Select.Value>
                    <Select.Icon className={styles.SelectIcon}>
                      <ChevronUpDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner className={styles.Positioner} sideOffset={8}>
                      <Select.ScrollUpArrow className={styles.ScrollArrow} />
                      <Select.Popup className={styles.Popup}>
                        {COUNTRIES.map((country) => {
                          return (
                            <Select.Item
                              key={country.iso3}
                              value={country.iso2}
                              className={styles.Item}
                            >
                              <Select.ItemIndicator className={styles.ItemIndicator}>
                                <CheckIcon className={styles.ItemIndicatorIcon} />
                              </Select.ItemIndicator>
                              <Select.ItemText className={styles.ItemText}>
                                {country.name}
                              </Select.ItemText>
                            </Select.Item>
                          );
                        })}
                      </Select.Popup>
                      <Select.ScrollDownArrow className={styles.ScrollArrow} />
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="radioGroup"
          control={control}
          rules={{
            required: 'This field is required',
          }}
          render={({ field, fieldState }) => {
            // TODO: where exactly to put field.onBlur?
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                render={<Fieldset.Root />}
                className={styles.Field}
              >
                <Fieldset.Legend className={styles.Legend}>Show scroll bars</Fieldset.Legend>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  inputRef={field.ref}
                  className={styles.RadioGroup}
                >
                  <Field.Label className={styles.Label}>
                    <Radio.Root value="auto" className={styles.Radio}>
                      <Radio.Indicator className={styles.Indicator} />
                    </Radio.Root>
                    Automatically based on mouse or trackpad
                  </Field.Label>

                  <Field.Label className={styles.Label}>
                    <Radio.Root value="scrolling" className={styles.Radio}>
                      <Radio.Indicator className={styles.Indicator} />
                    </Radio.Root>
                    When scrolling
                  </Field.Label>

                  <Field.Label className={styles.Label}>
                    <Radio.Root value="always" className={styles.Radio}>
                      <Radio.Indicator className={styles.Indicator} />
                    </Radio.Root>
                    Always
                  </Field.Label>
                </RadioGroup>
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <Controller
          name="checkboxGroup"
          control={control}
          rules={{
            required: 'This field is required',
          }}
          render={({ field, fieldState }) => {
            // TODO: where exactly to put field.onBlur?
            return (
              <Field.Root
                name={field.name}
                invalid={fieldState.invalid}
                touched={fieldState.isTouched}
                dirty={fieldState.isDirty}
                render={<Fieldset.Root />}
                className={styles.Field}
              >
                <Fieldset.Legend className={styles.Legend}>Content blocking</Fieldset.Legend>
                <CheckboxGroup
                  aria-labelledby="parent-label"
                  value={field.value}
                  onValueChange={field.onChange}
                  allValues={ALL_CHECKBOX_GROUP_VALUES}
                  className={styles.CheckboxGroup}
                  style={{ marginLeft: '1rem' }}
                >
                  <Field.Label
                    className={styles.Label}
                    style={{ marginLeft: '-1rem' }}
                    id="parent-label"
                  >
                    <Checkbox.Root
                      parent
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      className={styles.Checkbox}
                    >
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

                  <Field.Label className={styles.Label}>
                    <Checkbox.Root value="ads" onBlur={field.onBlur} className={styles.Checkbox}>
                      <Checkbox.Indicator className={styles.CheckboxIndicator}>
                        <CheckIcon className={styles.Icon} />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    Block ads
                  </Field.Label>

                  <Field.Label className={styles.Label}>
                    <Checkbox.Root
                      value="annoyances"
                      onBlur={field.onBlur}
                      className={styles.Checkbox}
                    >
                      <Checkbox.Indicator className={styles.CheckboxIndicator}>
                        <CheckIcon className={styles.Icon} />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    Block annoyances
                  </Field.Label>

                  <Field.Label className={styles.Label}>
                    <Checkbox.Root
                      value="comments"
                      onBlur={field.onBlur}
                      className={styles.Checkbox}
                    >
                      <Checkbox.Indicator className={styles.CheckboxIndicator}>
                        <CheckIcon className={styles.Icon} />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    Block comments
                  </Field.Label>

                  <Field.Label className={styles.Label}>
                    <Checkbox.Root
                      value="trackers"
                      onBlur={field.onBlur}
                      className={styles.Checkbox}
                    >
                      <Checkbox.Indicator className={styles.CheckboxIndicator}>
                        <CheckIcon className={styles.Icon} />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    Block trackers
                  </Field.Label>
                </CheckboxGroup>
                <Field.Error className={styles.Error} match={!!fieldState.error}>
                  {fieldState.error?.message ?? ''}
                </Field.Error>
              </Field.Root>
            );
          }}
        />

        <button disabled={loading} type="submit" className={styles.Button}>
          Submit
        </button>

        <button
          type="button"
          disabled={loading}
          data-color="red"
          className={styles.Button}
          onClick={() => reset()}
        >
          Reset
        </button>
      </Form>
    </div>
  );
}

const ALL_CHECKBOX_GROUP_VALUES = ['ads', 'annoyances', 'comments', 'trackers'];
const COUNTRIES = [
  {
    iso2: 'BR',
    iso3: 'BRA',
    name: 'Brazil',
    capital: 'Brasília',
    region: 'Americas',
    subregion: 'South America',
    states: [
      {
        code: 'AC',
        name: 'Acre',
        subdivision: null,
      },
      {
        code: 'AL',
        name: 'Alagoas',
        subdivision: null,
      },
      {
        code: 'AP',
        name: 'Amapá',
        subdivision: null,
      },
      {
        code: 'AM',
        name: 'Amazonas',
        subdivision: null,
      },
      {
        code: 'BA',
        name: 'Bahia',
        subdivision: null,
      },
      {
        code: 'CE',
        name: 'Ceará',
        subdivision: null,
      },
      {
        code: 'DF',
        name: 'Distrito Federal',
        subdivision: null,
      },
      {
        code: 'ES',
        name: 'Espírito Santo',
        subdivision: null,
      },
      {
        code: 'GO',
        name: 'Goiás',
        subdivision: null,
      },
      {
        code: 'MA',
        name: 'Maranhão',
        subdivision: null,
      },
      {
        code: 'MT',
        name: 'Mato Grosso',
        subdivision: null,
      },
      {
        code: 'MS',
        name: 'Mato Grosso do Sul',
        subdivision: null,
      },
      {
        code: 'MG',
        name: 'Minas Gerais',
        subdivision: null,
      },
      {
        code: 'PR',
        name: 'Paraná',
        subdivision: null,
      },
      {
        code: 'PB',
        name: 'Paraíba',
        subdivision: null,
      },
      {
        code: 'PA',
        name: 'Pará',
        subdivision: null,
      },
      {
        code: 'PE',
        name: 'Pernambuco',
        subdivision: null,
      },
      {
        code: 'PI',
        name: 'Piauí',
        subdivision: null,
      },
      {
        code: 'RN',
        name: 'Rio Grande do Norte',
        subdivision: null,
      },
      {
        code: 'RS',
        name: 'Rio Grande do Sul',
        subdivision: null,
      },
      {
        code: 'RJ',
        name: 'Rio de Janeiro',
        subdivision: null,
      },
      {
        code: 'RO',
        name: 'Rondônia',
        subdivision: null,
      },
      {
        code: 'RR',
        name: 'Roraima',
        subdivision: null,
      },
      {
        code: 'SC',
        name: 'Santa Catarina',
        subdivision: null,
      },
      {
        code: 'SE',
        name: 'Sergipe',
        subdivision: null,
      },
      {
        code: 'SP',
        name: 'São Paulo',
        subdivision: null,
      },
      {
        code: 'TO',
        name: 'Tocantins',
        subdivision: null,
      },
    ],
  },
  {
    iso2: 'JP',
    iso3: 'JPN',
    name: 'Japan',
    capital: 'Tokyo',
    region: 'Asia',
    subregion: 'Eastern Asia',
    states: [
      {
        code: '23',
        name: 'Aiti',
        subdivision: null,
      },
      {
        code: '05',
        name: 'Akita',
        subdivision: null,
      },
      {
        code: '02',
        name: 'Aomori',
        subdivision: null,
      },
      {
        code: '38',
        name: 'Ehime',
        subdivision: null,
      },
      {
        code: '21',
        name: 'Gihu',
        subdivision: null,
      },
      {
        code: '10',
        name: 'Gunma',
        subdivision: null,
      },
      {
        code: '34',
        name: 'Hirosima',
        subdivision: null,
      },
      {
        code: '01',
        name: 'Hokkaidô',
        subdivision: null,
      },
      {
        code: '18',
        name: 'Hukui',
        subdivision: null,
      },
      {
        code: '40',
        name: 'Hukuoka',
        subdivision: null,
      },
      {
        code: '07',
        name: 'Hukusima',
        subdivision: null,
      },
      {
        code: '28',
        name: 'Hyôgo',
        subdivision: null,
      },
      {
        code: '08',
        name: 'Ibaraki',
        subdivision: null,
      },
      {
        code: '17',
        name: 'Isikawa',
        subdivision: null,
      },
      {
        code: '03',
        name: 'Iwate',
        subdivision: null,
      },
      {
        code: '37',
        name: 'Kagawa',
        subdivision: null,
      },
      {
        code: '46',
        name: 'Kagosima',
        subdivision: null,
      },
      {
        code: '14',
        name: 'Kanagawa',
        subdivision: null,
      },
      {
        code: '43',
        name: 'Kumamoto',
        subdivision: null,
      },
      {
        code: '26',
        name: 'Kyôto',
        subdivision: null,
      },
      {
        code: '39',
        name: 'Kôti',
        subdivision: null,
      },
      {
        code: '24',
        name: 'Mie',
        subdivision: null,
      },
      {
        code: '04',
        name: 'Miyagi',
        subdivision: null,
      },
      {
        code: '45',
        name: 'Miyazaki',
        subdivision: null,
      },
      {
        code: '20',
        name: 'Nagano',
        subdivision: null,
      },
      {
        code: '42',
        name: 'Nagasaki',
        subdivision: null,
      },
      {
        code: '29',
        name: 'Nara',
        subdivision: null,
      },
      {
        code: '15',
        name: 'Niigata',
        subdivision: null,
      },
      {
        code: '33',
        name: 'Okayama',
        subdivision: null,
      },
      {
        code: '47',
        name: 'Okinawa',
        subdivision: null,
      },
      {
        code: '41',
        name: 'Saga',
        subdivision: null,
      },
      {
        code: '11',
        name: 'Saitama',
        subdivision: null,
      },
      {
        code: '25',
        name: 'Siga',
        subdivision: null,
      },
      {
        code: '32',
        name: 'Simane',
        subdivision: null,
      },
      {
        code: '22',
        name: 'Sizuoka',
        subdivision: null,
      },
      {
        code: '12',
        name: 'Tiba',
        subdivision: null,
      },
      {
        code: '36',
        name: 'Tokusima',
        subdivision: null,
      },
      {
        code: '09',
        name: 'Totigi',
        subdivision: null,
      },
      {
        code: '31',
        name: 'Tottori',
        subdivision: null,
      },
      {
        code: '16',
        name: 'Toyama',
        subdivision: null,
      },
      {
        code: '13',
        name: 'Tôkyô',
        subdivision: null,
      },
      {
        code: '30',
        name: 'Wakayama',
        subdivision: null,
      },
      {
        code: '06',
        name: 'Yamagata',
        subdivision: null,
      },
      {
        code: '35',
        name: 'Yamaguti',
        subdivision: null,
      },
      {
        code: '19',
        name: 'Yamanasi',
        subdivision: null,
      },
      {
        code: '44',
        name: 'Ôita',
        subdivision: null,
      },
      {
        code: '27',
        name: 'Ôsaka',
        subdivision: null,
      },
    ],
  },
  {
    iso2: 'SG',
    iso3: 'SGP',
    name: 'Singapore',
    capital: 'Singapore',
    region: 'Asia',
    subregion: 'South-Eastern Asia',
    states: [
      {
        code: '01',
        name: 'Central Singapore',
        subdivision: null,
      },
      {
        code: '02',
        name: 'North East',
        subdivision: null,
      },
      {
        code: '03',
        name: 'North West',
        subdivision: null,
      },
      {
        code: '04',
        name: 'South East',
        subdivision: null,
      },
      {
        code: '05',
        name: 'South West',
        subdivision: null,
      },
    ],
  },
];
