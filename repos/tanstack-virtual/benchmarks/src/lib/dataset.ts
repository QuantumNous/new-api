// Deterministic dataset generation. Every library renders the SAME content for
// the same scenario, so any timing differences come from the library itself,
// not from input variance.
//
// For dynamic scenarios we vary content length so each item naturally has a
// different height (5..14 lines worth of text). For fixed scenarios every item
// is a single line of text.

export interface Item {
  id: number
  // Text rendered into the item DOM. For dynamic scenarios, length varies.
  text: string
}

const WORDS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
  'kilo',
  'lima',
  'mike',
  'november',
  'oscar',
  'papa',
  'quebec',
  'romeo',
  'sierra',
  'tango',
  'uniform',
  'victor',
  'whiskey',
  'x-ray',
  'yankee',
  'zulu',
]

// Simple LCG so the same seed yields the same sequence in any JS runtime.
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function makeDataset(
  count: number,
  dynamic: boolean,
  wideVariance = false,
): Array<Item> {
  const rand = lcg(424242)
  const items: Array<Item> = new Array(count)
  for (let i = 0; i < count; i++) {
    if (dynamic) {
      if (wideVariance) {
        // Wide-variance dataset: heights span ~30..500 px (≈16× ratio).
        // 1 → 50 words distributed log-normally so most items are short
        // but a meaningful tail is very tall.
        const wc = 1 + Math.floor(Math.pow(rand(), 2) * 49)
        const parts: Array<string> = new Array(wc)
        for (let w = 0; w < wc; w++) {
          parts[w] = WORDS[Math.floor(rand() * WORDS.length)]!
        }
        items[i] = { id: i, text: `#${i} ${parts.join(' ')}` }
      } else {
        // 5..14 words → ~ one line; lengths picked deterministically.
        const wc = 5 + Math.floor(rand() * 10)
        const parts: Array<string> = new Array(wc)
        for (let w = 0; w < wc; w++) {
          parts[w] = WORDS[Math.floor(rand() * WORDS.length)]!
        }
        // 25% of dynamic items get a multi-line burst for height variation.
        const burst =
          rand() < 0.25 ? ' ' + parts.join(' ') + ' ' + parts.join(' ') : ''
        items[i] = { id: i, text: `#${i} ${parts.join(' ')}${burst}` }
      }
    } else {
      items[i] = { id: i, text: `Item ${i}` }
    }
  }
  return items
}
