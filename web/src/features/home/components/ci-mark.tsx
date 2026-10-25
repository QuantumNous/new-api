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
import { DEFAULT_LOGO } from '@/lib/constants'
import { PRODUCT_NAME, PRODUCT_NAME_LATIN } from '@/lib/product-brand'

export function CiMark(props: {
  size?: number
  withWordmark?: boolean
  /** Sets the Latin name under the Chinese one instead of a single line. */
  stackedWordmark?: boolean
  /** Overrides the default mark, e.g. the all-gradient variant. */
  src?: string
}) {
  const size = props.size ?? 22
  const wordmark = props.stackedWordmark ? (
    <span className='ci-markStack'>
      <span>{PRODUCT_NAME}</span>
      <span className='ci-markLatin'>{PRODUCT_NAME_LATIN}</span>
    </span>
  ) : (
    <span>{PRODUCT_NAME}</span>
  )
  return (
    <span
      className='ci-mark'
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
    >
      <img
        src={props.src ?? DEFAULT_LOGO}
        alt=''
        width={size}
        height={size}
        aria-hidden='true'
      />
      {props.withWordmark ? wordmark : null}
    </span>
  )
}
