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
    'group-[.is-assistant]:w-full',
    'group-[.is-assistant]:max-w-none',
    'group-[.is-user]:w-fit',
    'group-[.is-user]:text-slate-900',
    'group-[.is-user]:rounded-3xl',
    'group-[.is-assistant]:text-slate-800',
    'group-[.is-assistant]:bg-transparent',
    'group-[.is-assistant]:p-0',
    'group-[.is-assistant]:font-sans',
    'text-[15px] leading-relaxed',
    'break-words',
    'whitespace-pre-wrap',
    'sm:text-base sm:leading-7',
    'group-[.is-user]:max-w-[85%]',
    'sm:group-[.is-user]:max-w-[62ch]',
    'md:group-[.is-user]:max-w-[68ch]',
    'lg:group-[.is-user]:max-w-[72ch]',
  ].join(' ')
}
