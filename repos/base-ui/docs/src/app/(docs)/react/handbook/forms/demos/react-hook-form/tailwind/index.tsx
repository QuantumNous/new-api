'use client';
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '../../components/button';
import { CheckboxGroup } from '../../components/checkbox-group';
import { Form } from '../../components/form';
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

function ReactHookForm() {
  const toastManager = useToastManager();

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      serverName: '',
      region: null,
      containerImage: '',
      serverType: null,
      numOfInstances: null,
      scalingThreshold: [0.2, 0.8],
      storageType: 'ssd',
      restartOnFailure: true,
      allowedNetworkProtocols: [],
    },
  });

  function submitForm(data: FormValues) {
    toastManager.add({
      title: 'Form submitted',
      description: 'The form contains these values:',
      data,
    });
  }

  return (
    <Form aria-label="Launch new cloud server" onSubmit={handleSubmit(submitForm)}>
      <Controller
        name="serverName"
        control={control}
        rules={{
          required: 'This field is required.',
          minLength: { value: 3, message: 'At least 3 characters.' },
        }}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty, error },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Field.Label>Server name</Field.Label>
            <Field.Control
              ref={ref}
              value={value}
              onBlur={onBlur}
              onValueChange={onChange}
              placeholder="e.g. api-server-01"
            />
            <Field.Description>Must be 3 or more characters long</Field.Description>
            <Field.Error match={!!error}>{error?.message}</Field.Error>
          </Field.Root>
        )}
      />

      <Controller
        name="region"
        control={control}
        rules={{
          required: 'This field is required.',
        }}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty, error },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Combobox.Root items={REGIONS} value={value} onValueChange={onChange}>
              <div className="relative text-sm leading-5 font-bold text-neutral-950 dark:text-white">
                <Field.Label className="mb-1 block">Region</Field.Label>
                <Combobox.InputGroup>
                  <Combobox.Input placeholder="e.g. eu-central-1" ref={ref} onBlur={onBlur} />
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
            <Field.Error match={!!error}>{error?.message}</Field.Error>
          </Field.Root>
        )}
      />

      <Controller
        name="containerImage"
        control={control}
        rules={{
          required: 'This field is required.',
        }}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty, error },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Autocomplete.Root
              items={IMAGES}
              mode="both"
              itemToStringValue={(itemValue: Image) => itemValue.url}
              value={value}
              onValueChange={onChange}
            >
              <Field.Label>Container image</Field.Label>
              <Autocomplete.Input
                placeholder="e.g. docker.io/library/node:latest"
                ref={ref}
                onBlur={onBlur}
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
            <Field.Error match={!!error}>{error?.message}</Field.Error>
          </Field.Root>
        )}
      />

      <Controller
        name="serverType"
        control={control}
        rules={{
          required: 'This field is required.',
        }}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty, error },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Select.Root items={SERVER_TYPES} value={value} onValueChange={onChange} inputRef={ref}>
              <div className="w-fit space-y-1">
                <Select.Label>Server type</Select.Label>
                <Select.Trigger className="w-48" onBlur={onBlur}>
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
                      {SERVER_TYPES.map(({ label, value: serverType }) => {
                        return (
                          <Select.Item key={serverType} value={serverType}>
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
            <Field.Error match={!!error}>{error?.message}</Field.Error>
          </Field.Root>
        )}
      />

      <Controller
        name="numOfInstances"
        control={control}
        rules={{
          required: 'This field is required.',
        }}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty, error },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <NumberField.Root value={value} min={1} max={64} onValueChange={onChange}>
              <Field.Label>Number of instances</Field.Label>
              <NumberField.Group>
                <NumberField.Decrement>
                  <MinusIcon />
                </NumberField.Decrement>
                <NumberField.Input ref={ref} onBlur={onBlur} />
                <NumberField.Increment>
                  <PlusIcon />
                </NumberField.Increment>
              </NumberField.Group>
            </NumberField.Root>
            <Field.Error match={!!error}>{error?.message}</Field.Error>
          </Field.Root>
        )}
      />

      <Controller
        name="scalingThreshold"
        control={control}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Fieldset.Root
              render={
                <Slider.Root
                  value={value}
                  onValueChange={onChange}
                  onValueCommitted={onChange}
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
                    onBlur={onBlur}
                    inputRef={ref}
                  />
                  <Slider.Thumb index={1} aria-label="Maximum threshold" onBlur={onBlur} />
                </Slider.Track>
              </Slider.Control>
            </Fieldset.Root>
          </Field.Root>
        )}
      />

      <Controller
        name="storageType"
        control={control}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Fieldset.Root
              render={
                <RadioGroup
                  className="gap-4"
                  value={value}
                  onValueChange={onChange}
                  inputRef={ref}
                />
              }
            >
              <Fieldset.Legend className="-mt-px">Storage type</Fieldset.Legend>
              <Field.Item>
                <Field.Label>
                  <Radio.Root value="ssd" onBlur={onBlur}>
                    <Radio.Indicator />
                  </Radio.Root>
                  SSD
                </Field.Label>
              </Field.Item>
              <Field.Item>
                <Field.Label>
                  <Radio.Root value="hdd" onBlur={onBlur}>
                    <Radio.Indicator />
                  </Radio.Root>
                  HDD
                </Field.Label>
              </Field.Item>
            </Fieldset.Root>
          </Field.Root>
        )}
      />

      <Controller
        name="restartOnFailure"
        control={control}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Field.Label className="gap-2">
              Restart on failure
              <Switch.Root
                checked={value}
                inputRef={ref}
                onCheckedChange={onChange}
                onBlur={onBlur}
              >
                <Switch.Thumb />
              </Switch.Root>
            </Field.Label>
          </Field.Root>
        )}
      />

      <Controller
        name="allowedNetworkProtocols"
        control={control}
        render={({
          field: { ref, name, value, onBlur, onChange },
          fieldState: { invalid, isTouched, isDirty },
        }) => (
          <Field.Root name={name} invalid={invalid} touched={isTouched} dirty={isDirty}>
            <Fieldset.Root render={<CheckboxGroup value={value} onValueChange={onChange} />}>
              <Fieldset.Legend className="mb-2">Allowed network protocols</Fieldset.Legend>
              <div className="flex gap-4">
                {['http', 'https', 'ssh'].map((val) => {
                  return (
                    <Field.Item key={val}>
                      <Field.Label className="uppercase">
                        <Checkbox.Root
                          value={val}
                          inputRef={val === 'http' ? ref : undefined}
                          onBlur={onBlur}
                        >
                          <Checkbox.Indicator>
                            <CheckIcon />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        {val}
                      </Field.Label>
                    </Field.Item>
                  );
                })}
              </div>
            </Fieldset.Root>
          </Field.Root>
        )}
      />

      <Button type="submit" className="mt-3">
        Launch server
      </Button>
    </Form>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ReactHookForm />
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
