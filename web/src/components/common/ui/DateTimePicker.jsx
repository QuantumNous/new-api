/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Single date+time picker that mirrors the calendar dropdown styling used by
// `FilterDateRange` in TableFilterForm.jsx (the filter UI on /console/midjourney
// and similar pages). Use this for any in-form `expired_time`-style field that
// previously relied on a native `<input type="datetime-local">`.

import React, { useState } from 'react';
import {
  Button as HeroButton,
  Calendar,
  DateField,
  DatePicker,
} from '@heroui/react';
import { CalendarDateTime, parseDateTime } from '@internationalized/date';

const pad2 = (n) => String(n).padStart(2, '0');

// Accepts: "YYYY-MM-DD HH:mm:ss" (server format), ISO string, Date, unix
// seconds timestamp, -1 (sentinel "no expiry"), null/undefined/"".
// Returns a CalendarDateTime that the HeroUI DatePicker understands, or null.
export const toCalendarDateTime = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === -1
  ) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new CalendarDateTime(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
    );
  }

  if (typeof value === 'number') {
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return new CalendarDateTime(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    );
  }

  // String — accept both "YYYY-MM-DD HH:mm:ss" and ISO "YYYY-MM-DDTHH:mm:ss".
  // Pad the time portion if missing so parseDateTime always succeeds.
  try {
    let s = String(value).replace(' ', 'T').slice(0, 19);
    if (s.length === 10) s += 'T00:00:00';
    else if (s.length === 13) s += ':00:00';
    else if (s.length === 16) s += ':00';
    return parseDateTime(s);
  } catch (error) {
    return null;
  }
};

// CalendarDateTime -> "YYYY-MM-DD HH:mm:ss" (the format the server expects).
export const fromCalendarDateTime = (value) => {
  if (!value) return '';
  return `${value.year}-${pad2(value.month)}-${pad2(value.day)} ${pad2(
    value.hour ?? 0,
  )}:${pad2(value.minute ?? 0)}:${pad2(value.second ?? 0)}`;
};

// Single date+time picker. The calendar dropdown is intentionally identical to
// the one used by `FilterDateRange` so /console/token, /console/midjourney etc.
// share one visual language.
//
// Props:
//   value           — string | Date | number | -1 | null
//   onChange(next)  — called with "YYYY-MM-DD HH:mm:ss" or ""
//   placeholder     — used as aria-label
//   isInvalid       — surfaces the picker's error styling
//   granularity     — passed to the underlying HeroUI DatePicker (default 'minute')
//   presets         — [{ text, onSelect() }] quick-action chips above the calendar
//   className       — extra classes on the picker root
export function DateTimePicker({
  value,
  onChange,
  placeholder,
  isInvalid,
  granularity = 'minute',
  presets = [],
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dateValue = toCalendarDateTime(value);

  const handleChange = (next) => {
    onChange?.(next ? fromCalendarDateTime(next) : '');
  };

  return (
    <DatePicker
      value={dateValue}
      onChange={handleChange}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      granularity={granularity}
      shouldForceLeadingZeros
      isInvalid={isInvalid}
      aria-label={placeholder}
      className={`w-full ${className}`}
    >
      <DateField.Group fullWidth variant='primary'>
        <DateField.InputContainer>
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover className='w-(--trigger-width) p-2'>
        {presets.length > 0 ? (
          <div className='mb-2 flex flex-wrap gap-1'>
            {presets.map((preset) => (
              <HeroButton
                key={preset.text}
                size='sm'
                variant='ghost'
                type='button'
                className='h-7 px-2 text-xs md:h-7'
                onPress={() => {
                  preset.onSelect?.();
                  setIsOpen(false);
                }}
              >
                {preset.text}
              </HeroButton>
            ))}
          </div>
        ) : null}
        <Calendar aria-label={placeholder} className='w-full'>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              {/* Match the muted nav controls used by FilterDateRange. */}
              <Calendar.YearPickerTriggerIndicator className='text-muted!' />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton
              slot='previous'
              className='text-muted! hover:text-foreground!'
            />
            <Calendar.NavButton
              slot='next'
              className='text-muted! hover:text-foreground!'
            />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

export default DateTimePicker;
