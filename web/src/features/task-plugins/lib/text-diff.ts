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

/** A run of text that both sides share, or that only one side has. */
export type TextDiffPart = {
  kind: 'same' | 'removed' | 'added'
  text: string
}

// Words, numbers and addresses stay whole, without a full stop after them;
// any other character, such as a CJK character or punctuation, is its own
// token.
const TOKEN =
  /[\p{L}\p{N}_@.+-]*[\p{L}\p{N}_@+-](?<![\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])|\s+|./gsu

// Above this many tokens on a side, the table would take too much memory.
const MAX_TOKENS = 2000

/**
 * The differences between two texts by words, in order, or null when either
 * text is too long to compare.
 */
export function diffText(before: string, after: string): TextDiffPart[] | null {
  const left = before.match(TOKEN) ?? []
  const right = after.match(TOKEN) ?? []
  if (left.length > MAX_TOKENS || right.length > MAX_TOKENS) return null
  const width = right.length + 1
  const lengths = new Uint16Array((left.length + 1) * width)
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        left[i] === right[j]
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
    }
  }
  const parts: TextDiffPart[] = []
  const push = (kind: TextDiffPart['kind'], text: string) => {
    const last = parts.at(-1)
    if (last?.kind === kind) last.text += text
    else parts.push({ kind, text })
  }
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      push('same', left[i])
      i += 1
      j += 1
    } else if (
      i < left.length &&
      (j === right.length ||
        lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])
    ) {
      push('removed', left[i])
      i += 1
    } else {
      push('added', right[j])
      j += 1
    }
  }
  return parts
}
