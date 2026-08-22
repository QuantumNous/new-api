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

type IconSiftQProps = SVGProps<SVGSVGElement> & {
  size?: number
}

export function IconSiftQ({ size = 20, ...props }: IconSiftQProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 48 48'
      width={size}
      height={size}
      fill='none'
      aria-hidden='true'
      {...props}
    >
      <rect x='4' y='4' width='31' height='40' rx='10' fill='#176b62' />
      <path
        fill='#f7f7f3'
        d='M13 14.4c0-2.2 2.5-3.5 4.3-2.2l12.2 8.5a3 3 0 0 1 0 4.6l-12.2 8.5c-1.8 1.3-4.3 0-4.3-2.2V14.4Z'
      />
      <path
        fill='#9edfd1'
        d='m34 18.2 9.8-5.5a1.9 1.9 0 0 1 2.8 1.7v1.1c0 .7-.4 1.4-1 1.7L34 23.1v-4.9Z'
      />
      <path
        fill='#9edfd1'
        d='m34 23.1 10.5-1.8a1.9 1.9 0 0 1 2.2 1.9v1.4a1.9 1.9 0 0 1-2.2 1.9L34 24.7v-1.6Z'
      />
      <path
        fill='#9edfd1'
        d='m34 26.5 11.6 5.9c.6.3 1 .9 1 1.6v1.1a1.9 1.9 0 0 1-2.8 1.7L34 31.4v-4.9Z'
      />
    </svg>
  )
}
