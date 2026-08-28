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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import type { BillingUsageSchema } from '@/features/pricing/types'

import { UsageSchemaTable } from '../components/usage-schema-table'

const schema: BillingUsageSchema = {
  duration: {
    type: 'number',
    unit: 'second',
    description: { en: 'Video duration in seconds.', zh: '视频时长(秒)。' },
  },
  resolution: {
    enum: ['480p', '720p', '1080p', '4k'],
    description: { en: 'Output resolution.' },
  },
}

describe('UsageSchemaTable compact layout', () => {
  test('given compact mode, fields render as a stacked list without a table element', () => {
    const { container } = render(
      <UsageSchemaTable schema={schema} compact />
    )

    expect(container.querySelector('table')).toBeNull()
    expect(screen.getByText('duration')).toBeInTheDocument()
    expect(screen.getByText('resolution')).toBeInTheDocument()
  })

  test('given compact mode, field names keep the prominent mono style', () => {
    render(<UsageSchemaTable schema={schema} compact />)

    const name = screen.getByText('duration')
    expect(name).toHaveClass('font-mono')
    expect(name).toHaveClass('font-medium')
  })

  test('given compact mode, type and unit merge into a single badge', () => {
    render(<UsageSchemaTable schema={schema} compact />)

    expect(screen.getByText('Number · Second')).toBeInTheDocument()
    expect(screen.getByText('Enum')).toBeInTheDocument()
  })

  test('given compact mode and long enum values, the line truncates with the full list in title', () => {
    render(<UsageSchemaTable schema={schema} compact />)

    const enumLine = screen.getByText('480p, 720p, 1080p, 4k')
    expect(enumLine).toHaveClass('truncate')
    expect(enumLine).toHaveAttribute('title', '480p, 720p, 1080p, 4k')
  })

  test('given compact mode, descriptions render in full with wrapping enabled', () => {
    render(<UsageSchemaTable schema={schema} compact />)

    const description = screen.getByText('Video duration in seconds.')
    expect(description).toHaveClass('break-words')
    expect(description).not.toHaveClass('truncate')
  })

  test('given compact mode, the list is height-capped with its own vertical scroll', () => {
    const { container } = render(
      <UsageSchemaTable schema={schema} compact />
    )

    const region = container.firstElementChild
    expect(region).toHaveClass('max-h-56')
    expect(region).toHaveClass('overflow-y-auto')
  })

  test('given a description without an English entry, the available locale text still renders', () => {
    render(
      <UsageSchemaTable
        schema={{ note: { description: { zh: '仅中文说明。' } } }}
        compact
      />
    )

    expect(screen.getByText('仅中文说明。')).toBeInTheDocument()
  })
})

describe('UsageSchemaTable full layout', () => {
  test('given non-compact mode, the five-column table is preserved for the detail sheet', () => {
    render(<UsageSchemaTable schema={schema} />)

    for (const header of [
      'Name',
      'Type',
      'Unit',
      'Enum values',
      'Description',
    ]) {
      expect(
        screen.getByRole('columnheader', { name: header })
      ).toBeInTheDocument()
    }
    expect(
      screen.getByRole('cell', { name: 'Video duration in seconds.' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('cell', { name: '480p, 720p, 1080p, 4k' })
    ).toBeInTheDocument()
  })
})
