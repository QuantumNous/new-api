import { VALID_PARAM_NAME_REGEX } from './constants'

export interface ExtractedParam {
  /** The full param string including $ prefix (e.g., "$userId", "-$optional") */
  fullParam: string
  /** The param name without $ prefix (e.g., "userId", "optional") */
  paramName: string
  /** Whether this is an optional param (prefixed with -$) */
  isOptional: boolean
  /** Whether this param name is valid */
  isValid: boolean
}

/**
 * Extracts param names from a route path segment.
 *
 * Handles these patterns:
 * - $paramName                     -> extract "paramName"
 * - {$paramName}                   -> extract "paramName"
 * - prefix{$paramName}suffix       -> extract "paramName"
 * - {-$paramName}                  -> extract "paramName" (optional)
 * - prefix{-$paramName}suffix      -> extract "paramName" (optional)
 * - $ or {$}                       -> wildcard, skip validation
 */
export function extractParamsFromSegment(
  segment: string,
): Array<ExtractedParam> {
  const params: Array<ExtractedParam> = []

  // Skip empty segments
  if (!segment || !segment.includes('$')) {
    return params
  }

  // Check for wildcard ($ alone or {$})
  if (segment === '$' || segment === '{$}') {
    return params // Wildcard, no param name to validate
  }

  // Pattern 1: Simple $paramName (entire segment starts with $)
  if (segment.startsWith('$') && !segment.includes('{')) {
    const paramName = segment.slice(1)
    if (paramName) {
      params.push({
        fullParam: segment,
        paramName,
        isOptional: false,
        isValid: VALID_PARAM_NAME_REGEX.test(paramName),
      })
    }
    return params
  }

  // Pattern 2: Braces pattern {$paramName} or {-$paramName} with optional prefix/suffix
  // Match patterns like: prefix{$param}suffix, {$param}, {-$param}
  const bracePattern = /\{(-?\$)([^}]*)\}/g
  let match

  while ((match = bracePattern.exec(segment)) !== null) {
    const prefix = match[1] // "$" or "-$"
    const paramName = match[2] // The param name after $ or -$

    if (!paramName) {
      // This is a wildcard {$} or {-$}, skip
      continue
    }

    const isOptional = prefix === '-$'

    params.push({
      fullParam: `${prefix}${paramName}`,
      paramName,
      isOptional,
      isValid: VALID_PARAM_NAME_REGEX.test(paramName),
    })
  }

  return params
}

/**
 * Extracts all params from a route path.
 *
 * @param path - The route path (e.g., "/users/$userId/posts/$postId")
 * @returns Array of extracted params with validation info
 */
export function extractParamsFromPath(path: string): Array<ExtractedParam> {
  if (!path || !path.includes('$')) {
    return []
  }

  const segments = path.split('/')
  const allParams: Array<ExtractedParam> = []

  for (const segment of segments) {
    const params = extractParamsFromSegment(segment)
    allParams.push(...params)
  }

  return allParams
}

/**
 * Validates a single param name.
 *
 * @param paramName - The param name to validate (without $ prefix)
 * @returns Whether the param name is valid
 */
export function isValidParamName(paramName: string): boolean {
  return VALID_PARAM_NAME_REGEX.test(paramName)
}

/**
 * Gets all invalid params from a route path.
 *
 * @param path - The route path
 * @returns Array of invalid param info
 */
export function getInvalidParams(path: string): Array<ExtractedParam> {
  const params = extractParamsFromPath(path)
  return params.filter((p) => !p.isValid)
}
