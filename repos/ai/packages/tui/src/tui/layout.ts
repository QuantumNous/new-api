import { renderMarkdown } from './markdown';
import {
  ansiPrefixPattern,
  codePointWidth,
  sliceVisible,
  visibleLength,
} from './terminal-text';

export { sliceVisible, stripAnsi, visibleLength } from './terminal-text';

const horizontal = '─';

export type TUIScreenState = {
  width: number;
  height: number;
  title: string;
  rightTitle?: string;
  body: string;
  input: string;
  inputActive: boolean;
  inputCursorVisible?: boolean;
  scrollOffset: number;
  status?: string;
};

export type TUIScreenLinesState = Omit<TUIScreenState, 'body'> & {
  bodyLines: string[];
};

export type TUIScreenViewportState = Omit<
  TUIScreenLinesState,
  'bodyLines' | 'scrollOffset'
> & {
  visibleBodyLines: string[];
};

export function renderScreen(state: TUIScreenState): string {
  const width = Math.max(20, state.width);
  const contentWidth = width - 4;
  const bodyLines = wrapText(renderMarkdown(state.body), contentWidth);

  return renderScreenLines({ ...state, bodyLines });
}

export function renderScreenLines(state: TUIScreenLinesState): string {
  const height = Math.max(8, state.height);
  const inputHeight = 3;
  const bodyHeight = height - inputHeight;
  const bodyContentHeight = bodyHeight - 2;

  const maxScrollOffset = Math.max(
    0,
    state.bodyLines.length - bodyContentHeight,
  );
  const scrollOffset = Math.min(
    Math.max(0, state.scrollOffset),
    maxScrollOffset,
  );
  const start = Math.max(
    0,
    state.bodyLines.length - bodyContentHeight - scrollOffset,
  );
  const visibleBody = state.bodyLines.slice(start, start + bodyContentHeight);

  return renderScreenViewport({ ...state, visibleBodyLines: visibleBody });
}

export function renderScreenViewport(state: TUIScreenViewportState): string {
  const width = Math.max(20, state.width);
  const height = Math.max(8, state.height);
  const inputHeight = 3;
  const bodyHeight = height - inputHeight;
  const bodyContentHeight = bodyHeight - 2;
  const visibleBody = state.visibleBodyLines.slice(0, bodyContentHeight);

  while (visibleBody.length < bodyContentHeight) {
    visibleBody.push('');
  }

  const lines = [
    topBorder(width, state.title, state.rightTitle),
    ...visibleBody.map(line => boxLine(line, width)),
    bottomBorder(width),
    topBorder(width, state.inputActive ? 'Input' : 'Status'),
    boxLine(
      state.inputActive
        ? `> ${state.input}${state.inputCursorVisible === false ? ' ' : '█'}`
        : (state.status ?? 'Streaming... ↑/↓ scroll · Ctrl+C quit'),
      width,
    ),
    bottomBorder(width),
  ];

  return lines.join('\n');
}

export function wrapText(input: string, width: number): string[] {
  if (width <= 0) {
    return [''];
  }

  const output: string[] = [];

  for (const rawLine of input.split('\n')) {
    if (rawLine.length === 0) {
      output.push('');
      continue;
    }

    let remaining = rawLine;

    while (visibleLength(remaining) > width) {
      const breakAt = findBreakPoint(remaining, width);
      output.push(remaining.slice(0, breakAt).trimEnd());
      remaining = remaining.slice(breakAt).trimStart();
    }

    output.push(remaining);
  }

  return output;
}

export function clampScrollOffset(
  scrollOffset: number,
  body: string,
  bodyHeight: number,
  width: number,
): number {
  const bodyContentHeight = Math.max(1, bodyHeight - 2);
  const bodyLines = wrapText(renderMarkdown(body), Math.max(1, width - 4));
  const maxScrollOffset = Math.max(0, bodyLines.length - bodyContentHeight);

  return Math.min(Math.max(0, scrollOffset), maxScrollOffset);
}

function findBreakPoint(input: string, width: number): number {
  let index = 0;
  let visible = 0;
  let lastSpace = -1;

  while (index < input.length && visible < width) {
    const ansiMatch = input.slice(index).match(ansiPrefixPattern);

    if (ansiMatch) {
      index += ansiMatch[0].length;
      continue;
    }

    const codePoint = input.codePointAt(index);

    if (codePoint == null) {
      break;
    }

    const character = String.fromCodePoint(codePoint);
    const characterWidth = codePointWidth(codePoint);

    if (characterWidth > 0 && visible + characterWidth > width) {
      break;
    }

    if (character === ' ') {
      lastSpace = index;
    }

    index += character.length;
    visible += characterWidth;
  }

  const nextBreakIndex = indexAfterAnsiSequences(input, index);
  if (visible === width && input.codePointAt(nextBreakIndex) === 0x20) {
    return nextBreakIndex;
  }

  if (lastSpace > 0) {
    return lastSpace;
  }

  return indexAtVisibleWidth(input, width);
}

function topBorder(width: number, title: string, rightTitle?: string): string {
  const contentWidth = Math.max(0, width - 2);
  const label = title ? sliceVisible(` ${title} `, contentWidth) : '';
  const rightLabel = rightTitle
    ? sliceVisible(
        ` ${rightTitle} `,
        Math.max(0, contentWidth - visibleLength(label)),
      )
    : '';
  const remaining = Math.max(
    0,
    contentWidth - visibleLength(label) - visibleLength(rightLabel),
  );

  return `┌${label}${horizontal.repeat(remaining)}${rightLabel}┐`;
}

function bottomBorder(width: number): string {
  return `└${horizontal.repeat(width - 2)}┘`;
}

function boxLine(line: string, width: number): string {
  const contentWidth = width - 4;
  const visible = sliceVisible(line, contentWidth);
  const padding = ' '.repeat(
    Math.max(0, contentWidth - visibleLength(visible)),
  );

  return `│ ${visible}${padding} │`;
}

function indexAtVisibleWidth(input: string, width: number): number {
  let index = 0;
  let visible = 0;

  while (index < input.length && visible < width) {
    const ansiMatch = input.slice(index).match(ansiPrefixPattern);

    if (ansiMatch) {
      index += ansiMatch[0].length;
      continue;
    }

    const codePoint = input.codePointAt(index);

    if (codePoint == null) {
      break;
    }

    const character = String.fromCodePoint(codePoint);
    const characterWidth = codePointWidth(codePoint);

    if (characterWidth > 0 && visible + characterWidth > width) {
      break;
    }

    index += character.length;
    visible += characterWidth;
  }

  return index;
}

function indexAfterAnsiSequences(input: string, startIndex: number): number {
  let index = startIndex;

  while (index < input.length) {
    const ansiMatch = input.slice(index).match(ansiPrefixPattern);

    if (!ansiMatch) {
      break;
    }

    index += ansiMatch[0].length;
  }

  return index;
}
