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
type NumberedStepsProps = {
  items: string[]
}

export function NumberedSteps(props: NumberedStepsProps) {
  return (
    <ol className='mt-5 flex flex-col gap-4'>
      {props.items.map((item, index) => (
        <li
          key={item}
          className='grid grid-cols-[2rem_minmax(0,1fr)] gap-3 leading-7'
        >
          <span className='bg-muted flex size-8 items-center justify-center rounded-lg text-sm font-semibold'>
            {index + 1}
          </span>
          <span className='min-w-0 pt-0.5 break-words'>{item}</span>
        </li>
      ))}
    </ol>
  )
}
