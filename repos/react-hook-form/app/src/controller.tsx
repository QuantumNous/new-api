import React from 'react';
import { useForm, Controller, ValidationMode } from 'react-hook-form';
import ReactSelect from 'react-select';
import {
  TextField,
  Checkbox,
  Select,
  MenuItem,
  Switch,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { useParams } from 'react-router-dom';

let renderCount = 0;

const options = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' },
] as const;

const defaultValues = {
  Native: '',
  TextField: '',
  Select: '',
  ReactSelect: '',
  Checkbox: false,
  switch: false,
  RadioGroup: '',
};

type Form = {
  Native: string;
  TextField: string;
  Select: string;
  ReactSelect: string;
  Checkbox: boolean;
  switch: boolean;
  RadioGroup: string;
};

const PureReactSelect = React.memo(ReactSelect);

export default function Field() {
  const { mode } = useParams();
  const methods = useForm<Form>({
    defaultValues,
    mode: mode as keyof ValidationMode,
  });
  const {
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = methods;

  const [, setRerender] = React.useState(0);
  renderCount++;

  const rerender = () => setRerender(Math.random());

  return (
    <form onSubmit={handleSubmit(() => {})}>
      <div className="container">
        <section id="input-checkbox">
          <label>MUI Checkbox</label>
          <Controller
            name="Checkbox"
            control={control}
            rules={{ required: true }}
            render={({ field: props }) => (
              <Checkbox
                {...props}
                onChange={(e) => props.onChange(e.target.checked)}
              />
            )}
          />
        </section>

        {errors.Checkbox && <p id="Checkbox">Checkbox Error</p>}

        <section id="input-radio-group">
          <label>Radio Group</label>
          <Controller
            render={({ field }) => (
              <RadioGroup aria-label="gender" {...field} name="gender1">
                <FormControlLabel
                  value="female"
                  control={<Radio />}
                  label="Female"
                />
                <FormControlLabel
                  value="male"
                  control={<Radio />}
                  label="Male"
                />
                <FormControlLabel
                  value="other"
                  control={<Radio />}
                  label="Other"
                />
              </RadioGroup>
            )}
            rules={{ required: true }}
            name="RadioGroup"
            control={control}
          />
        </section>

        {errors.RadioGroup && <p id="RadioGroup">RadioGroup Error</p>}

        <section id="input-textField">
          <label>MUI TextField</label>
          <Controller
            render={({ field }) => <TextField {...field} />}
            name="TextField"
            control={control}
            rules={{ required: true }}
          />
        </section>

        {errors.TextField && <p id="TextField">TextField Error</p>}

        <section id="input-select">
          <label>MUI Select</label>
          <Controller
            render={({ field }) => (
              <Select {...field}>
                <MenuItem value={10}>Ten</MenuItem>
                <MenuItem value={20}>Twenty</MenuItem>
                <MenuItem value={30}>Thirty</MenuItem>
              </Select>
            )}
            rules={{ required: true }}
            name="Select"
            control={control}
          />
        </section>

        {errors.Select && <p id="Select">Select Error</p>}

        <section id="input-switch">
          <label>MUI Switch</label>
          <Controller
            name="switch"
            rules={{ required: true }}
            render={({ field: props }) => (
              <Switch
                {...props}
                onChange={(e) => props.onChange(e.target.checked)}
              />
            )}
            control={control}
          />
        </section>

        {errors.switch && <p id="switch">switch Error</p>}

        <section id="input-ReactSelect">
          <label>React Select</label>
          <Controller
            render={({ field }) => (
              <PureReactSelect isClearable options={options} {...field} />
            )}
            name="ReactSelect"
            control={control}
            rules={{ required: true }}
          />
        </section>

        {errors.ReactSelect && <p id="ReactSelect">ReactSelect Error</p>}
      </div>

      <span id="renderCount">{renderCount}</span>

      <button type="button" onClick={rerender}>
        Rerender
      </button>

      <button
        type="button"
        onClick={() => {
          reset({
            Native: '',
            TextField: '',
            Select: '',
            ReactSelect: '',
            Checkbox: false,
            switch: false,
            RadioGroup: '',
          });
        }}
      >
        Reset Form
      </button>
      <button id="submit">submit</button>
    </form>
  );
}
