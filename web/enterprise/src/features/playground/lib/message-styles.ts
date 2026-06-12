/*
Copyright (C) 2023-2026 QuantumNous

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
/**
 * Get message content styles based on role
 * Encapsulates styling logic for user and assistant messages
 */
export function getMessageContentStyles() {
  return [
    // Both: max-width and rounded
    'max-w-[85%]',
    'rounded-[8px]',
    'text-sm',
    'leading-relaxed',
    'break-words',
    'whitespace-pre-wrap',
    // User bubble: primary background, right-aligned
    'group-[.is-user]:self-end',
    'group-[.is-user]:bg-primary',
    'group-[.is-user]:text-primary-foreground',
    'group-[.is-user]:rounded-br-[3px]',
    'group-[.is-user]:px-4',
    'group-[.is-user]:py-3',
    // Assistant bubble: background with border, left-aligned
    'group-[.is-assistant]:self-start',
    'group-[.is-assistant]:bg-background',
    'group-[.is-assistant]:border',
    'group-[.is-assistant]:border-border',
    'group-[.is-assistant]:rounded-bl-[3px]',
    'group-[.is-assistant]:px-4',
    'group-[.is-assistant]:py-3',
    // Preferred readable widths and wrapping
    'sm:leading-7',
  ].join(' ')
}
