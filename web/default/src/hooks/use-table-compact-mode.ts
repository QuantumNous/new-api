import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'table_compact_modes'

function getCompactMode(tableKey: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const modes = JSON.parse(raw) as Record<string, boolean>
    return Boolean(modes[tableKey])
  } catch {
    return false
  }
}

function setCompactMode(value: boolean, tableKey: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const modes = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    modes[tableKey] = value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes))
  } catch {
    /* ignore */
  }
}

/**
 * Manages per-table compact mode toggle persisted in localStorage.
 * Stays in sync across tabs via the storage event.
 */
export function useTableCompactMode(
  tableKey = 'global'
): [boolean, (value: boolean) => void] {
  const [compact, setCompactState] = useState(() => getCompactMode(tableKey))

  const setCompact = useCallback(
    (value: boolean) => {
      setCompactState(value)
      setCompactMode(value, tableKey)
    },
    [tableKey]
  )

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const modes = JSON.parse(e.newValue || '{}') as Record<
            string,
            boolean
          >
          setCompactState(Boolean(modes[tableKey]))
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [tableKey])

  return [compact, setCompact]
}
