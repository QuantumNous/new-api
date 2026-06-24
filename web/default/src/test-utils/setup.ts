/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import '@testing-library/jest-dom'

function installStorageShim(name: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') return
  const current = window[name] as Partial<Storage> | undefined
  if (
    current?.getItem &&
    current?.setItem &&
    current?.removeItem &&
    current?.clear
  ) {
    return
  }

  const data = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
  }

  Object.defineProperty(window, name, {
    configurable: true,
    value: storage,
  })
}

installStorageShim('localStorage')
installStorageShim('sessionStorage')
