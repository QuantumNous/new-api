export function formatJsonForEditor(value: string, fallback = '[]') {
  const target = value && value.trim() ? value : fallback
  try {
    const parsed = JSON.parse(target)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return target
  }
}

export function normalizeJsonString(value: string, fallback = '[]') {
  const target = value && value.trim() ? value : fallback
  try {
    const parsed = JSON.parse(target)
    return JSON.stringify(parsed)
  } catch {
    return target.trim()
  }
}
