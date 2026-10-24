'use client';
import * as React from 'react';
import { useForm, revalidateLogic, DeepKeys, ValidationError } from '@tanstack/react-form';
import { Button } from '../../components/button';
import { CheckboxGroup } from '../../components/checkbox-group';
import { RadioGroup } from '../../components/radio-group';
import { ToastProvider, useToastManager } from '../../components/toast';
import * as Autocomplete from '../../components/autocomplete';
import * as Checkbox from '../../components/checkbox';
import * as Combobox from '../../components/combobox';
import * as Field from '../../components/field';
import * as Fieldset from '../../components/fieldset';
import * as NumberField from '../../components/number-field';
import * as Radio from '../../components/radio';
import * as Select from '../../components/select';
import * as Slider from '../../components/slider';
import * as Switch from '../../components/switch';

interface FormValues {
  serverName: string;
  region: string | null;
  containerImage: string;
  serverType: string | null;
  numOfInstances: number | null;
  scalingThreshold: number[];
  storageType: 'ssd' | 'hdd';
  restartOnFailure: boolean;
  allowedNetworkProtocols: string[];
}

const defaultValues: FormValues = {
  serverName: '',
  region: null,
  containerImage: '',
  serverType: null,
  numOfInstances: null,
  scalingThreshold: [0.2, 0.8],
  storageType: 'ssd',
  restartOnFailure: true,
  allowedNetworkProtocols: [],
};

function TanstackForm() {
  const toastManager = useToastManager();

  const form = useForm({
    defaultValues,
    onSubmit: ({ value: formValues }) => {
      toastManager.add({
        title: 'Form submitted',
        description: 'The form contains these values:',
        data: formValues,
      });
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value: formValues }) => {
        const errors: Partial<Record<DeepKeys<FormValues>, ValidationError>> = {};

        (
          ['serverName', 'region', 'containerImage', 'serverType', 'numOfInstances'] as const
        ).forEach((requiredField) => {
          if (!formValues[requiredField]) {
            errors[requiredField] = 'This is a required field.';
          }
        });

        if (formValues.serverName && formValues.serverName.length < 3) {
          errors.serverName = 'At least 3 characters.';
        }

        return isEmpty(errors) ? undefined : { form: errors, fields: errors };
      },
    },
  });

  /* eslint-disable react/no-children-prop */
  return (
    <form
      aria-label="Launch new cloud server"
      className="flex w-full max-w-3xs flex-col gap-5 sm:max-w-[20rem]"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="serverName"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Field.Label>Server name</Field.Label>
              <Field.Control
                value={field.state.value}
                onValueChange={field.handleChange}
                onBlur={field.handleBlur}
                placeholder="e.g. api-server-01"
              />
              <Field.Description>Must be 3 or more characters long</Field.Description>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="region"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Combobox.Root
                items={REGIONS}
                value={field.state.value}
                onValueChange={field.handleChange}
              >
                <div className="relative text-sm leading-5 font-bold text-neutral-950 dark:text-white">
                  <Field.Label className="mb-1 block">Region</Field.Label>
                  <Combobox.InputGroup>
                    <Combobox.Input placeholder="e.g. eu-central-1" onBlur={field.handleBlur} />
                    <div className="absolute right-0 bottom-0 inline-flex h-full items-center justify-center text-neutral-500 dark:text-neutral-400">
                      <Combobox.Clear />
                      <Combobox.Trigger>
                        <Combobox.CaretDownIcon />
                      </Combobox.Trigger>
                    </div>
                  </Combobox.InputGroup>
                </div>
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.Empty>No matches</Combobox.Empty>
                      <Combobox.List>
                        {(region: string) => {
                          return (
                            <Combobox.Item key={region} value={region}>
                              <Combobox.ItemIndicator>
                                <CheckIcon />
                              </Combobox.ItemIndicator>
                              <span className="col-start-2">{region}</span>
                            </Combobox.Item>
                          );
                        }}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>

              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="containerImage"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Autocomplete.Root
                items={IMAGES}
                mode="both"
                value={field.state.value}
                onValueChange={field.handleChange}
                itemToStringValue={(itemValue: Image) => itemValue.url}
              >
                <Field.Label>Container image</Field.Label>
                <Autocomplete.Input
                  placeholder="e.g. docker.io/library/node:latest"
                  onBlur={field.handleBlur}
                />
                <Field.Description>Enter a registry URL with optional tags</Field.Description>
                <Autocomplete.Portal>
                  <Autocomplete.Positioner>
                    <Autocomplete.Popup>
                      <Autocomplete.List>
                        {(image: Image) => {
                          return (
                            <Autocomplete.Item key={image.url} value={image}>
                              <span>{image.name}</span>
                              <span className="font-mono whitespace-nowrap text-xs opacity-80">
                                {image.url}
                              </span>
                            </Autocomplete.Item>
                          );
                        }}
                      </Autocomplete.List>
                    </Autocomplete.Popup>
                  </Autocomplete.Positioner>
                </Autocomplete.Portal>
              </Autocomplete.Root>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="serverType"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Select.Root
                items={SERVER_TYPES}
                value={field.state.value}
                onValueChange={field.handleChange}
              >
                <div className="w-fit space-y-1">
                  <Select.Label>Server type</Select.Label>
                  <Select.Trigger className="w-48" onBlur={field.handleBlur}>
                    <Select.Value />
                    <Select.Icon>
                      <CaretUpDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                </div>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.ScrollUpArrow />
                      <Select.List>
                        {SERVER_TYPES.map(({ label, value }) => {
                          return (
                            <Select.Item key={value} value={value}>
                              <Select.ItemIndicator>
                                <CheckIcon />
                              </Select.ItemIndicator>
                              <Select.ItemText>{label}</Select.ItemText>
                            </Select.Item>
                          );
                        })}
                      </Select.List>
                      <Select.ScrollDownArrow />
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="numOfInstances"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <NumberField.Root
                value={field.state.value}
                onValueChange={field.handleChange}
                min={1}
                max={64}
              >
                <Field.Label>Number of instances</Field.Label>
                <NumberField.Group>
                  <NumberField.Decrement>
                    <MinusIcon />
                  </NumberField.Decrement>
                  <NumberField.Input onBlur={field.handleBlur} />
                  <NumberField.Increment>
                    <PlusIcon />
                  </NumberField.Increment>
                </NumberField.Group>
              </NumberField.Root>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="scalingThreshold"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Fieldset.Root
                render={
                  <Slider.Root
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onValueCommitted={field.handleChange}
                    thumbAlignment="edge"
                    min={0}
                    max={1}
                    step={0.01}
                    format={{
                      style: 'percent',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }}
                    className="w-full gap-y-2"
                  />
                }
              >
                <Fieldset.Legend>Scaling threshold</Fieldset.Legend>
                <Slider.Value className="col-start-2 text-end" />
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Indicator />
                    <Slider.Thumb
                      index={0}
                      aria-label="Minimum threshold"
                      onBlur={field.handleBlur}
                    />
                    <Slider.Thumb
                      index={1}
                      aria-label="Maximum threshold"
                      onBlur={field.handleBlur}
                    />
                  </Slider.Track>
                </Slider.Control>
              </Fieldset.Root>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="storageType"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Fieldset.Root
                render={
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    className="gap-4"
                  />
                }
              >
                <Fieldset.Legend className="-mt-px">Storage type</Fieldset.Legend>
                {['ssd', 'hdd'].map((radioValue) => (
                  <Field.Item key={radioValue}>
                    <Field.Label className="uppercase">
                      <Radio.Root value={radioValue}>
                        <Radio.Indicator />
                      </Radio.Root>
                      {radioValue}
                    </Field.Label>
                  </Field.Item>
                ))}
              </Fieldset.Root>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="restartOnFailure"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Field.Label className="gap-2">
                Restart on failure
                <Switch.Root
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                >
                  <Switch.Thumb />
                </Switch.Root>
              </Field.Label>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <form.Field
        name="allowedNetworkProtocols"
        children={(field) => {
          return (
            <Field.Root
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <Fieldset.Root
                render={
                  <CheckboxGroup value={field.state.value} onValueChange={field.handleChange} />
                }
              >
                <Fieldset.Legend className="mb-2">Allowed network protocols</Fieldset.Legend>
                <div className="flex gap-4">
                  {['http', 'https', 'ssh'].map((checkboxValue) => {
                    return (
                      <Field.Item key={checkboxValue}>
                        <Field.Label className="uppercase">
                          <Checkbox.Root value={checkboxValue} onBlur={field.handleBlur}>
                            <Checkbox.Indicator>
                              <CheckIcon />
                            </Checkbox.Indicator>
                          </Checkbox.Root>
                          {checkboxValue}
                        </Field.Label>
                      </Field.Item>
                    );
                  })}
                </div>
              </Fieldset.Root>
              <Field.Error match={!field.state.meta.isValid}>
                {field.state.meta.errors.join(',')}
              </Field.Error>
            </Field.Root>
          );
        }}
      />

      <Button type="submit" className="mt-3">
        Launch server
      </Button>
    </form>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <TanstackForm />
    </ToastProvider>
  );
}

function CaretUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function PlusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}

function MinusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M1.5 8h13" />
    </svg>
  );
}

function isEmpty(object: Partial<Record<DeepKeys<FormValues>, ValidationError>>) {
  // eslint-disable-next-line
  for (const _ in object) {
    return false;
  }
  return true;
}

function cartesian<T extends string[][]>(...arrays: T): string[][] {
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
  );
}

const REGIONS = cartesian(['us', 'eu', 'ap'], ['central', 'east', 'west'], ['1', '2', '3']).map(
  (part) => part.join('-'),
);

interface Image {
  url: string;
  name: string;
}
/* prettier-ignore */
const IMAGES: Image[] = ['nginx:1.29-alpine', 'node:22-slim', 'postgres:18', 'redis:8.2.2-alpine'].map((name) => ({
  url: `docker.io/library/${name}`,
  name,
}));

const SERVER_TYPES = [
  { label: 'Select server type', value: null },
  ...cartesian(['t', 'm'], ['1', '2'], ['small', 'medium', 'large']).map((part) => {
    const value = part.join('.').replace('.', '');
    return { label: value, value };
  }),
];
