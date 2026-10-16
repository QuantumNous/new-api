export type TraceStep = {
  file: string
  specifier?: string
  line?: number
  column?: number
}

export type CodeSnippet = {
  lines: Array<string>
  location?: string
}

export type Violation = {
  envType?: string
  type: string
  specifier: string
  importer: string
  resolved?: string
  trace: Array<TraceStep>
  snippet?: CodeSnippet
  message?: string
}

export function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[[0-9;]*m/g, '')
}

export function extractViolationsFromLog(text: string): Array<Violation> {
  const out: Array<Violation> = []
  const lines = stripAnsi(text).split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!line.includes('[import-protection] Import denied in')) continue

    const envTypeMatch = line.match(
      /Import denied in\s+(client|server)\s+environment/,
    )
    const envType = envTypeMatch?.[1]

    const block: Array<string> = [line]
    for (let j = i + 1; j < Math.min(lines.length, i + 200); j++) {
      const l = lines[j] ?? ''
      if (l.includes('[import-protection] Import denied in') && j !== i + 1) {
        break
      }
      block.push(l)
    }

    const importerLine = block.find((b) =>
      b.trimStart().startsWith('Importer:'),
    )
    const specLine = block.find((b) => b.trimStart().startsWith('Import:'))
    const resolvedLine = block.find((b) =>
      b.trimStart().startsWith('Resolved:'),
    )

    const importer = importerLine
      ? importerLine.split('Importer:')[1]!.trim()
      : ''
    const specifier = specLine
      ? specLine.split('Import:')[1]!.trim().replace(/^"|"$/g, '')
      : ''
    const resolved = resolvedLine
      ? resolvedLine.split('Resolved:')[1]!.trim()
      : undefined

    const typeLine = block.find((b) => b.trimStart().startsWith('Denied by'))
    const type = typeLine?.includes('marker')
      ? 'marker'
      : typeLine?.includes('specifier')
        ? 'specifier'
        : typeLine?.includes('file')
          ? 'file'
          : 'unknown'

    const trace: Array<TraceStep> = []
    const traceStart = block.findIndex((b) => b.trim() === 'Trace:')
    if (traceStart !== -1) {
      for (let k = traceStart + 1; k < block.length; k++) {
        const l = block[k] ?? ''
        const m = l.match(
          /^\s*\d+\.\s+(.*?)(?:\s+\(entry\))?\s*(?:\(import "(.*)"\))?\s*$/,
        )
        if (m) {
          const rawFile = m[1]!.trim()
          const spec = m[2]?.trim()

          const locMatch = rawFile.match(/^(.*?):(\d+):(\d+)$/)
          if (locMatch) {
            trace.push({
              file: locMatch[1]!,
              line: Number(locMatch[2]),
              column: Number(locMatch[3]),
              specifier: spec,
            })
          } else {
            trace.push({ file: rawFile, specifier: spec })
          }
        } else if (l.trim() === '' || l.match(/^\s*$/)) {
          break
        }
      }
    }

    out.push({ envType, type, specifier, importer, resolved, trace })
  }

  return out
}
