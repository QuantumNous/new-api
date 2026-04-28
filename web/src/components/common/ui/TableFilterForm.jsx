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
import {
  Button as HeroButton,
  DateField,
  DateRangePicker,
  RangeCalendar,
} from '@heroui/react';
import { CalendarDateTime, parseDateTime } from '@internationalized/date';

// Two-digit zero-pad helper used for `YYYY-MM-DD HH:mm:ss` formatting.
const pad2 = (n) => String(n).padStart(2, '0');

// Convert a Date or `YYYY-MM-DD HH:mm:ss`/ISO-ish string into a CalendarDateTime
// (the value type expected by HeroUI / React Aria date components). Returns
// null on invalid input so the picker can render an empty state cleanly.
const toCalendarDateTime = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return new CalendarDateTime(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
    );
  }

  try {
    // Accept both space- and `T`-separated forms; trim sub-second parts.
    const normalized = String(value).replace(' ', 'T').slice(0, 19);
    return parseDateTime(normalized);
  } catch (error) {
    return null;
  }
};

// Convert a CalendarDateTime back into the `YYYY-MM-DD HH:mm:ss` string the
// rest of the app (filter state, API requests) already speaks.
const fromCalendarDateTime = (value) => {
  if (!value) {
    return '';
  }
  return (
    `${value.year}-${pad2(value.month)}-${pad2(value.day)} ` +
    `${pad2(value.hour)}:${pad2(value.minute)}:${pad2(value.second ?? 0)}`
  );
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
  const [startRaw = '', endRaw = ''] = value || [];

  const startValue = toCalendarDateTime(startRaw);
  const endValue = toCalendarDateTime(endRaw);
  const rangeValue =
    startValue && endValue ? { start: startValue, end: endValue } : null;

  const [isOpen, setIsOpen] = useState(false);

  const ariaLabel = startPlaceholder || endPlaceholder;

  const handleChange = (next) => {
    if (!next) {
      onChange(['', '']);
      return;
    }
    onChange([fromCalendarDateTime(next.start), fromCalendarDateTime(next.end)]);
  };

  const handlePreset = (preset) => {
    onChange([
      fromCalendarDateTime(toCalendarDateTime(preset.start)),
      fromCalendarDateTime(toCalendarDateTime(preset.end)),
    ]);
    setIsOpen(false);
  };

  return (
    <DateRangePicker
      value={rangeValue}
      onChange={handleChange}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      granularity='minute'
      hourCycle={24}
      hideTimeZone
      shouldForceLeadingZeros
      aria-label={ariaLabel}
      className={`flex flex-col gap-1 ${className}`}
    >
      <DateField.Group fullWidth variant='primary'>
        <DateField.InputContainer>
          <DateField.Input slot='start'>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot='end'>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover>
        {presets.length > 0 ? (
          <div className='flex flex-wrap gap-1 p-2 pb-0'>
            {presets.map((preset) => (
              <HeroButton
                key={preset.text}
                size='sm'
                variant='ghost'
                type='button'
                onPress={() => handlePreset(preset)}
              >
                {preset.text}
              </HeroButton>
            ))}
          </div>
        ) : null}
        <RangeCalendar aria-label={ariaLabel}>
          <RangeCalendar.Header>
            <RangeCalendar.YearPickerTrigger>
              <RangeCalendar.YearPickerTriggerHeading />
              <RangeCalendar.YearPickerTriggerIndicator />
            </RangeCalendar.YearPickerTrigger>
            <RangeCalendar.NavButton slot='previous' />
            <RangeCalendar.NavButton slot='next' />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              {(day) => (
                <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
              )}
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              {(date) => <RangeCalendar.Cell date={date} />}
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}
