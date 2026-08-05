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
import type { SVGProps } from 'react'

type IconGondolaProps = SVGProps<SVGSVGElement> & {
  size?: number
}

export function IconGondola({ size = 20, ...props }: IconGondolaProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 32 32'
      width={size}
      height={size}
      fill='none'
      stroke='#c9a96a'
      strokeLinecap='round'
      {...props}
    >
      <path d='M2 21c4 3 9 4.5 14 4.5S26 24 30 21' strokeWidth='1.4' />
      <path d='M2 21c0-2 1-3 2-3.5' strokeWidth='1.4' />
      <path d='M30 21c0-2-1-3-2-3.5' strokeWidth='1.4' />
      <path d='M5 18.5h22' strokeWidth='1' opacity='0.6' />
      <path d='M2.5 18.5l-1.2-4 2.5.8' strokeWidth='1.2' />
      <path d='M17 17l8-9' strokeWidth='1.2' opacity='0.7' />
      <path d='M6 28c3-1.5 5-1.5 8 0s5 1.5 8 0' strokeWidth='0.8' opacity='0.35' />
    </svg>
  )
}
