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

import React from 'react';
import { Input } from '@heroui/react';

// Status code rule editor that shows the current input together with parsed
// chips (valid tokens) or an inline error. Receives `value` + `onChange`
// directly so it can be used outside any Form context.
export default function HttpStatusCodeRulesInput({
  label,
  value = '',
  placeholder,
  extraText,
  onChange,
  parsed,
  invalidText,
}) {
  return (
    <div className='space-y-2'>
      {label ? (
        <div className='text-sm font-medium text-foreground'>{label}</div>
      ) : null}
      <Input
        type='text'
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
      />
      {extraText ? (
        <div className='text-xs leading-snug text-muted'>{extraText}</div>
      ) : null}
      {parsed?.ok && parsed.tokens?.length > 0 ? (
        <div className='flex flex-wrap gap-2'>
          {parsed.tokens.map((token) => (
            <span
              key={token}
              className='rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-0.5 text-xs text-muted'
            >
              {token}
            </span>
          ))}
        </div>
      ) : null}
      {!parsed?.ok && parsed ? (
        <div className='text-xs text-rose-600'>
          {invalidText}
          {parsed?.invalidTokens && parsed.invalidTokens.length > 0
            ? `: ${parsed.invalidTokens.join(', ')}`
            : ''}
        </div>
      ) : null}
    </div>
  );
}
