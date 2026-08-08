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
import { useId, type SVGProps } from 'react'

type IconYikeProps = SVGProps<SVGSVGElement> & {
  size?: number
}

export function IconYike({ size = 20, ...props }: IconYikeProps) {
  const gradientId = useId()

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 28 28'
      width={size}
      height={size}
      fill='none'
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1='0' x2='1' y1='0' y2='1'>
          <stop stopColor='#3080FF' />
          <stop offset='1' stopColor='#856EFA' />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        fillRule='evenodd'
        d='m6.067 3.76.81-.81A10.07 10.07 0 0 1 13.974 0q1.29.277 2.533.78 2.875 1.162 5.087 3.373 1.338 1.338 2.042 3.079.68 1.68.677 3.505t-.688 3.507q-.708 1.742-2.051 3.085-.801.801-1.841 1.224-1.005.409-2.094.41t-2.092-.404q-.357-.144-.686-.333l3.209-3.208q.945-.946 1.443-2.178.481-1.189.48-2.479-.003-1.29-.487-2.48-.502-1.234-1.451-2.183-1.49-1.49-3.427-2.278-1.869-.76-3.894-.763t-3.892.752q-.397.16-.776.35M24.24 6.067l.81.81A10.07 10.07 0 0 1 28 13.974q-.277 1.29-.78 2.533-1.162 2.875-3.373 5.087-1.338 1.338-3.079 2.042-1.68.68-3.505.677t-3.507-.688q-1.742-.708-3.085-2.051-.801-.801-1.224-1.841-.409-1.005-.41-2.094t.404-2.092q.144-.357.333-.686l3.208 3.209q.946.945 2.178 1.443 1.189.481 2.479.48 1.29-.003 2.48-.487 1.234-.502 2.183-1.451 1.49-1.49 2.278-3.427.76-1.869.763-3.894t-.752-3.892q-.16-.397-.35-.776M21.933 24.24l-.81.81A10.07 10.07 0 0 1 14.026 28q-1.29-.277-2.533-.78-2.875-1.162-5.087-3.373-1.338-1.338-2.042-3.079-.68-1.68-.677-3.505t.688-3.507q.708-1.742 2.051-3.085.801-.801 1.841-1.224 1.005-.409 2.094-.41t2.092.404q.357.144.686.333L9.93 12.982q-.945.946-1.443 2.178-.481 1.189-.48 2.479.003 1.29.487 2.48.502 1.234 1.451 2.183 1.49 1.49 3.427 2.278 1.869.76 3.894.763t3.892-.752q.397-.16.776-.35M3.76 21.933l-.81-.81A10.07 10.07 0 0 1 0 14.026q.277-1.29.78-2.533 1.162-2.875 3.373-5.087Q5.49 5.067 7.232 4.363q1.68-.68 3.505-.677t3.507.688q1.742.708 3.085 2.051.801.801 1.224 1.841.409 1.005.41 2.094t-.404 2.092q-.144.357-.333.686l-3.208-3.209q-.946-.945-2.178-1.443-1.189-.481-2.479-.48-1.29.003-2.48.487-1.234.502-2.183 1.451-1.49 1.49-2.278 3.427-.76 1.869-.763 3.894t.752 3.892q.16.397.35.776'
      />
    </svg>
  )
}
