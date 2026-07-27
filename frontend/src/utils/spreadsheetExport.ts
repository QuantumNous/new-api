export type SpreadsheetExportFormat = 'csv' | 'excel'
export type SerializedSpreadsheet = [content: string, mime: string, ext: string]

const DANGEROUS_FORMULA_PREFIX = /^[=+\-@]/

function stripLeadingControlCharacters(value: string): string {
  let index = 0
  while (index < value.length) {
    const code = value.charCodeAt(index)
    if (code > 31 && (code < 127 || code > 159)) break
    index += 1
  }
  return value.slice(index)
}

/** Prevents spreadsheet applications from interpreting untrusted text as a formula. */
export function neutralizeSpreadsheetFormula(value: unknown): string {
  if (typeof value !== 'string') return String(value)

  const normalized = stripLeadingControlCharacters(value)
  return DANGEROUS_FORMULA_PREFIX.test(normalized)
    ? `'${normalized}`
    : normalized
}

function csvRow(values: readonly unknown[]): string {
  return values
    .map(
      (value) => `"${neutralizeSpreadsheetFormula(value).replace(/"/g, '""')}"`
    )
    .join(',')
}

function escapeHtml(value: unknown): string {
  return neutralizeSpreadsheetFormula(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function serializeSpreadsheet(
  headers: readonly unknown[],
  rows: readonly (readonly unknown[])[],
  format: SpreadsheetExportFormat
): SerializedSpreadsheet {
  if (format === 'excel') {
    const head = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`
    const body = rows
      .map(
        (row) =>
          `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`
      )
      .join('')

    return [
      `<html><head><meta charset="utf-8"></head><body><table>${head}${body}</table></body></html>`,
      'application/vnd.ms-excel;charset=utf-8',
      'xls',
    ]
  }

  const content = [csvRow(headers), ...rows.map(csvRow)].join('\n')
  return ['\uFEFF' + content, 'text/csv;charset=utf-8', 'csv']
}
