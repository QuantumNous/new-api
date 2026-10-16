import type { Logger } from './logger'

/**
 * Regex for valid JavaScript identifier (param name)
 * Must start with letter, underscore, or dollar sign
 * Can contain letters, numbers, underscores, or dollar signs
 */
const VALID_PARAM_NAME_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

interface ExtractedParam {
  /** The param name without $ prefix (e.g., "userId", "optional") */
  paramName: string
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
function extractParamsFromSegment(segment: string): Array<ExtractedParam> {
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
        paramName,
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
    const paramName = match[2] // The param name after $ or -$

    if (!paramName) {
      // This is a wildcard {$} or {-$}, skip
      continue
    }

    params.push({
      paramName,
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
function extractParamsFromPath(path: string): Array<ExtractedParam> {
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
 * Validates route params and logs warnings for invalid param names.
 *
 * @param routePath - The route path to validate
 * @param filePath - The file path for error messages
 * @param logger - Logger instance for warnings
 */
export function validateRouteParams(
  routePath: string,
  filePath: string,
  logger: Logger,
): void {
  const params = extractParamsFromPath(routePath)
  const invalidParams = params.filter((p) => !p.isValid)

  for (const param of invalidParams) {
    logger.warn(
      `WARNING: Invalid param name "${param.paramName}" in route "${routePath}" (file: ${filePath}). ` +
        `Param names must be valid JavaScript identifiers (match /[a-zA-Z_$][a-zA-Z0-9_$]*/).`,
    )
  }
}
