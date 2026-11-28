import picomatch from 'picomatch'

import type { Pattern } from './utils'

export interface CompiledMatcher {
  pattern: Pattern
  literal?: string
  test: (value: string) => boolean
}

const globLikePatternRE = /[*?![\]{}()]/

export function isLiteralMatcherPattern(pattern: string): boolean {
  return !globLikePatternRE.test(pattern)
}

/**
 * Compile a Pattern (string glob or RegExp) into a fast test function.
 * String patterns use picomatch for full glob support (**, *, ?, braces, etc.).
 * RegExp patterns are used as-is.
 */
export function compileMatcher(pattern: Pattern): CompiledMatcher {
  if (pattern instanceof RegExp) {
    // RegExp with `g` or `y` flags are stateful because `.test()` mutates
    // `lastIndex`. Reset it to keep matcher evaluation deterministic.
    return {
      pattern,
      test: (value: string) => {
        pattern.lastIndex = 0
        return pattern.test(value)
      },
    }
  }

  if (isLiteralMatcherPattern(pattern)) {
    return {
      pattern,
      literal: pattern,
      test: (value: string) => value === pattern,
    }
  }

  const isMatch = picomatch(pattern, { dot: true })
  return { pattern, test: isMatch }
}

export function compileMatchers(
  patterns: Array<Pattern>,
): Array<CompiledMatcher> {
  return patterns.map(compileMatcher)
}

export function matchesAny(
  value: string,
  matchers: Array<CompiledMatcher>,
): CompiledMatcher | undefined {
  for (const matcher of matchers) {
    if (matcher.test(value)) {
      return matcher
    }
  }
  return undefined
}
