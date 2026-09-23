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
// Original character-inspired marks; not official brand logos.
export function IconChangzheng(props: { size?: number }) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox='0 0 24 24'
      fill='currentColor'
      aria-hidden='true'
      focusable='false'
    >
      <path d='m12 1.5 3.1 6.3 7 1-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-1Z' />
    </svg>
  )
}

export function IconGreyfield(props: { size?: number }) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox='0 0 24 24'
      fill='currentColor'
      aria-hidden='true'
      focusable='false'
    >
      <path d='m12 5 4.5 7-4.5 7-4.5-7Z' />
      <ellipse
        cx='12'
        cy='12'
        rx='10'
        ry='4.5'
        transform='rotate(-35 12 12)'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
      />
    </svg>
  )
}

export function IconTaffyOfficial(props: { size?: number }) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox='0 0 24 24'
      fill='currentColor'
      aria-hidden='true'
      focusable='false'
    >
      <path d='M9.5 9C6 5 2 4 2 7v9c0 3 4 2 7.5-2Zm5 0C18 5 22 4 22 7v9c0 3-4 2-7.5-2Z' />
      <rect x='10' y='9' width='4' height='6' rx='1.5' />
      <path d='m9 16-3 6 4-1 2-4 2 4 4 1-3-6-3 2Z' />
    </svg>
  )
}
