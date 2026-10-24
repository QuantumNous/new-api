import React, { useEffect } from 'react';
import { useForm, NestedValue } from 'react-hook-form';
import {
  TextField,
  FormControl,
  Select,
  MenuItem,
  FormHelperText,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';

type Option = {
  label: string;
  value: string;
};

const options = [
  { label: 'Chocolate', value: 'chocolate' },
  { label: 'Strawberry', value: 'strawberry' },
  { label: 'Vanilla', value: 'vanilla' },
];

export default function App() {
  const { register, handleSubmit, watch, setValue, errors } = useForm<{
    autocomplete: NestedValue<Option[]>;
    select: NestedValue<number[]>;
  }>({
    defaultValues: { autocomplete: [], select: [] },
  });
  const select = watch('select');

  const onSubmit = handleSubmit((data) => alert(JSON.stringify(data)));

  useEffect(() => {
    register('autocomplete', {
      validate: (value) => value.length || 'This is required.',
    });
    register('select', {
      validate: (value) => value.length || 'This is required.',
    });
  }, [register]);

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>MUI Autocomplete</label>
        <Autocomplete
          multiple
          options={options}
          getOptionLabel={(option: Option) => option.label}
          onChange={(e, options) => setValue('autocomplete', options)}
          renderInput={(params) => (
            <TextField
              {...params}
              error={Boolean(errors?.autocomplete)}
              helperText={errors?.autocomplete?.message}
            />
          )}
        />
      </div>
      <div>
        <label>MUI Select</label>
        <FormControl>
          <Select
            multiple
            value={select}
            onChange={(e) => setValue('muiSelect', e.target.value as number[])}
            error={Boolean(errors?.select)}
          >
            <MenuItem value={10}>Ten</MenuItem>
            <MenuItem value={20}>Twenty</MenuItem>
            <MenuItem value={30}>Thirty</MenuItem>
          </Select>
          <FormHelperText error={Boolean(errors?.select)}>
            {errors?.select?.message}
          </FormHelperText>
        </FormControl>
      </div>

      <input type="submit" className="button" />
    </form>
  );
}
