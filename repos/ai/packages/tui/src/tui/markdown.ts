import { visibleLength } from './terminal-text';

export type MarkdownToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string };

type TableAlignment = 'left' | 'center' | 'right';

const ansi = {
  bold: '\x1b[1m',
  boldOff: '\x1b[22m',
  italic: '\x1b[3m',
  italicOff: '\x1b[23m',
};

const tableSeparator = '─';

export function renderMarkdown(input: string): string {
  const lines = input.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const table = parseTable(lines, index);

    if (table != null) {
      output.push(...renderTable(table));
      index = table.endIndex - 1;
      continue;
    }

    output.push(renderMarkdownLine(lines[index] ?? ''));
  }

  return output.join('\n');
}

function renderMarkdownLine(line: string): string {
  if (line.startsWith('### ')) {
    return renderInlineMarkdown(`▶ ${line.slice(4)}`);
  }

  if (line.startsWith('## ')) {
    return renderInlineMarkdown(`■ ${line.slice(3)}`);
  }

  if (line.startsWith('# ')) {
    return renderInlineMarkdown(`█ ${line.slice(2)}`);
  }

  const unorderedListItem = line.match(/^(\s*)[-+*]\s+(.*)$/);
  if (unorderedListItem) {
    const [, indentation, text = ''] = unorderedListItem;
    return renderInlineMarkdown(
      `${indentation}•${text.length > 0 ? ` ${text}` : ''}`,
    );
  }

  if (/^\d+\. /.test(line)) {
    return renderInlineMarkdown(line.replace(/^(\d+)\. /, '$1. '));
  }

  if (line.startsWith('> ')) {
    return renderInlineMarkdown(`│ ${line.slice(2)}`);
  }

  return renderInlineMarkdown(line);
}

function renderInlineMarkdown(input: string): string {
  return input
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, `${ansi.bold}$1${ansi.boldOff}`)
    .replace(/__([^_\n]+)__/g, `${ansi.bold}$1${ansi.boldOff}`)
    .replace(/\*([^*\n]+)\*/g, `${ansi.italic}$1${ansi.italicOff}`)
    .replace(/_([^_\n]+)_/g, `${ansi.italic}$1${ansi.italicOff}`);
}

type ParsedTable = {
  alignments: TableAlignment[];
  endIndex: number;
  header: string[];
  rows: string[][];
};

function parseTable(
  lines: string[],
  startIndex: number,
): ParsedTable | undefined {
  const header = parseTableCells(lines[startIndex] ?? '');
  if (header == null || header.length < 2) {
    return undefined;
  }

  const separatorCells = parseTableCells(lines[startIndex + 1] ?? '');
  if (separatorCells == null || separatorCells.length !== header.length) {
    return undefined;
  }

  const alignments = parseTableAlignments(separatorCells);
  if (alignments == null) {
    return undefined;
  }

  const rows: string[][] = [];
  let endIndex = startIndex + 2;

  while (endIndex < lines.length) {
    const row = parseTableCells(lines[endIndex] ?? '');
    if (row == null) {
      break;
    }

    rows.push(normalizeTableRow(row, header.length));
    endIndex += 1;
  }

  return {
    alignments,
    endIndex,
    header,
    rows,
  };
}

function parseTableCells(line: string): string[] | undefined {
  if (!line.includes('|')) {
    return undefined;
  }

  let tableLine = line.trim();
  if (tableLine.startsWith('|')) {
    tableLine = tableLine.slice(1);
  }
  if (tableLine.endsWith('|') && !tableLine.endsWith('\\|')) {
    tableLine = tableLine.slice(0, -1);
  }

  const cells: string[] = [];
  let cell = '';

  for (let index = 0; index < tableLine.length; index += 1) {
    const character = tableLine[index];
    const nextCharacter = tableLine[index + 1];

    if (character === '\\' && nextCharacter === '|') {
      cell += '|';
      index += 1;
      continue;
    }

    if (character === '|') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    cell += character;
  }

  cells.push(cell.trim());

  return cells;
}

function parseTableAlignments(cells: string[]): TableAlignment[] | undefined {
  const alignments: TableAlignment[] = [];

  for (const cell of cells) {
    const match = cell.match(/^(:)?-{3,}(:)?$/);
    if (match == null) {
      return undefined;
    }

    const [, left, right] = match;
    alignments.push(
      left != null && right != null
        ? 'center'
        : right != null
          ? 'right'
          : 'left',
    );
  }

  return alignments;
}

function normalizeTableRow(row: string[], length: number): string[] {
  return Array.from({ length }, (_, index) => row[index] ?? '');
}

function renderTable(table: ParsedTable): string[] {
  const header = table.header.map(
    cell => `${ansi.bold}${renderInlineMarkdown(cell)}${ansi.boldOff}`,
  );
  const rows = table.rows.map(row => row.map(renderInlineMarkdown));
  const tableRows = [header, ...rows];
  const widths = table.alignments.map((_, columnIndex) =>
    Math.max(3, ...tableRows.map(row => visibleLength(row[columnIndex] ?? ''))),
  );

  return [
    formatTableRow(header, widths, table.alignments),
    widths.map(width => tableSeparator.repeat(width)).join('  '),
    ...rows.map(row => formatTableRow(row, widths, table.alignments)),
  ];
}

function formatTableRow(
  row: string[],
  widths: number[],
  alignments: TableAlignment[],
): string {
  return row
    .map((cell, index) =>
      alignTableCell(cell, widths[index] ?? 0, alignments[index] ?? 'left'),
    )
    .join('  ');
}

function alignTableCell(
  cell: string,
  width: number,
  alignment: TableAlignment,
): string {
  const paddingWidth = Math.max(0, width - visibleLength(cell));

  if (alignment === 'right') {
    return `${' '.repeat(paddingWidth)}${cell}`;
  }

  if (alignment === 'center') {
    const leftPadding = Math.floor(paddingWidth / 2);
    const rightPadding = paddingWidth - leftPadding;
    return `${' '.repeat(leftPadding)}${cell}${' '.repeat(rightPadding)}`;
  }

  return `${cell}${' '.repeat(paddingWidth)}`;
}
