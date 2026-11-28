export function createIdentifier(strings: Array<string>): string {
  if (strings.length === 0) {
    throw new Error('Cannot create an identifier from an empty array')
  }

  const sortedStrings = [...strings].sort()
  const combinedString = sortedStrings.join('---') // Delimiter

  // Replace unsafe characters
  let safeString = combinedString.replace(/\//g, '--slash--')
  safeString = safeString.replace(/\\/g, '--backslash--')
  safeString = safeString.replace(/\?/g, '--question--')
  safeString = safeString.replace(/%/g, '--percent--')
  safeString = safeString.replace(/#/g, '--hash--')
  safeString = safeString.replace(/\+/g, '--plus--')
  safeString = safeString.replace(/=/g, '--equals--')
  safeString = safeString.replace(/&/g, '--ampersand--')
  safeString = safeString.replace(/\s/g, '_') // Replace spaces with underscores

  return safeString
}

export function decodeIdentifier(identifier: string): Array<string> {
  if (!identifier) {
    return []
  }

  let combinedString = identifier.replace(/--slash--/g, '/')
  combinedString = combinedString.replace(/--backslash--/g, '\\')
  combinedString = combinedString.replace(/--question--/g, '?')
  combinedString = combinedString.replace(/--percent--/g, '%')
  combinedString = combinedString.replace(/--hash--/g, '#')
  combinedString = combinedString.replace(/--plus--/g, '+')
  combinedString = combinedString.replace(/--equals--/g, '=')
  combinedString = combinedString.replace(/--ampersand--/g, '&')
  combinedString = combinedString.replace(/_/g, ' ') // Restore spaces

  return combinedString.split('---')
}
