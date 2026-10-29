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
import { act, cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { ActivityTimeCell } from '../activity-time-cell'

// 2026-09-25 15:05:09 local time is 3 Mehr 1405.
const CREATED = Math.floor(new Date(2026, 8, 25, 15, 5, 9).getTime() / 1000)

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('ActivityTimeCell absolute dates', () => {
  it('in English, shows the Gregorian date without a title', async () => {
    await i18next.changeLanguage('en')
    render(
      <ActivityTimeCell
        createdAt={CREATED}
        lastAt={0}
        lastLabel='Last Login'
        format='absolute'
      />
    )

    expect(screen.getByText('2026-09-25 15:05:09')).not.toHaveAttribute('title')
  })

  it('after switching to Persian without a reload, shows Solar Hijri with the Gregorian date as its title', async () => {
    await i18next.changeLanguage('en')
    render(
      <ActivityTimeCell
        createdAt={CREATED}
        lastAt={0}
        lastLabel='Last Login'
        format='absolute'
      />
    )

    await act(async () => {
      await i18next.changeLanguage('fa')
    })

    expect(screen.getByText('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')).toHaveAttribute(
      'title',
      '2026-09-25 15:05:09'
    )
  })
})
