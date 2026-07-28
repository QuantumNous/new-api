import { describe, expect, it } from 'vitest'

import {
  neutralizeSpreadsheetFormula,
  serializeSpreadsheet,
} from '@/utils/spreadsheetExport'

describe('spreadsheetExport', () => {
  it.each([
    [
      '=HYPERLINK("https://example.test")',
      '\'=HYPERLINK("https://example.test")',
    ],
    ['+cmd', "'+cmd"],
    ['-1+2', "'-1+2"],
    ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['\t=1+1', "'=1+1"],
  ])('neutralizes a dangerous text cell: %s', (value, expected) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(expected)
  })

  it('preserves ordinary text and numeric values', () => {
    expect(neutralizeSpreadsheetFormula('model-a')).toBe('model-a')
    expect(neutralizeSpreadsheetFormula(42)).toBe('42')
    expect(neutralizeSpreadsheetFormula(-42)).toBe('-42')
  })

  it.each(['csv', 'excel'] as const)(
    'neutralizes formulas in %s exports before serialization',
    (format) => {
      const [content] = serializeSpreadsheet(
        ['value'],
        [['=HYPERLINK("https://example.test")'], ['<safe>']],
        format
      )

      expect(content).not.toContain('"=HYPERLINK')
      if (format === 'excel') {
        expect(content).toContain('&#39;=HYPERLINK')
        expect(content).toContain('&lt;safe&gt;')
      } else {
        expect(content).toContain("'=HYPERLINK")
      }
    }
  )
})
