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
export const summaryCardsLayoutClasses = {
  grid: 'grid xl:grid-cols-[minmax(0,1fr)_19rem]',
  usage: 'flex min-w-0 flex-col gap-2.5 p-3 sm:gap-3 sm:p-5',
  account:
    'bg-muted/40 flex min-w-0 flex-col justify-between gap-3 border-t p-3 sm:gap-4 sm:p-5 xl:border-t-0 xl:border-l',
  savings: 'min-w-0 border-t p-3 sm:p-5 xl:col-span-2',
} as const
