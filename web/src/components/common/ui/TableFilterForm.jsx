/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useEffect, useMemo, useRef, useState } from 'react';

const toDateTimeInputValue = (value) => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  return String(value).replace(' ', 'T').slice(0, 16);
};

const fromDateTimeInputValue = (value) => {
  if (!value) {
    return '';
  }

  return `${value.replace('T', ' ')}:00`;
};

export function useTableFilterForm({ initValues = {}, setFormApi, onSubmit }) {
  const [values, setValues] = useState(initValues || {});

  // Snapshot the latest values, initValues, and onSubmit into refs so the
  // returned `api` object stays referentially stable. Previously `api` was
  // memoized with `[values, initValues, onSubmit]` deps, which combined with
  // an effect that called `setFormApi(api)` and a parent that passed a
  // freshly-allocated `initValues` literal each render produced an infinite
  // setState loop on /console/token (and any other table using this hook).
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const initValuesRef = useRef(initValues);
  initValuesRef.current = initValues;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const api = useMemo(
    () => ({
      getValues: () => valuesRef.current,
      getValue: (field) => valuesRef.current[field],
      setValue: (field, value) => {
        setValues((previous) => ({ ...previous, [field]: value }));
      },
      reset: () => {
        setValues(initValuesRef.current || {});
      },
      submitForm: () => {
        onSubmitRef.current?.(valuesRef.current);
      },
    }),
    [],
  );

  // Hand the api to the parent exactly once. Use a ref for the callback so
  // a parent that passes an inline `setFormApi` arrow doesn't retrigger the
  // effect on every render.
  const setFormApiRef = useRef(setFormApi);
  setFormApiRef.current = setFormApi;
  useEffect(() => {
    setFormApiRef.current?.(api);
  }, [api]);

  const setFieldValue = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = (event) => {
    event?.preventDefault();
    onSubmit?.(values);
  };

  return { values, setFieldValue, handleSubmit, api };
}

export function FilterInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary ${className}`}
    />
  );
}

export function FilterSelect({
  value,
  onChange,
  placeholder,
  options = [],
  children,
  className = '',
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary ${className}`}
    >
      {placeholder ? <option value=''>{placeholder}</option> : null}
      {options.map((option) => (
        <option key={String(option.value ?? '')} value={option.value ?? ''}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}

export function FilterDateRange({
  value = [],
  onChange,
  startPlaceholder,
  endPlaceholder,
  presets = [],
  className = '',
}) {
  const [start = '', end = ''] = value || [];

  const setRangeValue = (index, nextValue) => {
    const nextRange = [start, end];
    nextRange[index] = fromDateTimeInputValue(nextValue);
    onChange(nextRange);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <input
          type='datetime-local'
          value={toDateTimeInputValue(start)}
          onChange={(event) => setRangeValue(0, event.target.value)}
          aria-label={startPlaceholder}
          className='h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary'
        />
        <input
          type='datetime-local'
          value={toDateTimeInputValue(end)}
          onChange={(event) => setRangeValue(1, event.target.value)}
          aria-label={endPlaceholder}
          className='h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary'
        />
      </div>
      {presets.length > 0 ? (
        <div className='flex flex-wrap gap-1.5'>
          {presets.map((preset) => (
            <button
              key={preset.text}
              type='button'
              onClick={() => onChange([preset.start, preset.end])}
              className='rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs text-muted transition hover:border-primary hover:text-foreground'
            >
              {preset.text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
