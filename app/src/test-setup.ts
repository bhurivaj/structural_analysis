// Vitest global test setup
// Provides localStorage mock for jsdom environment

import { vi } from 'vitest'

// Ensure localStorage is available and clearable in jsdom
// jsdom provides localStorage but `clear()` may not work in all vitest versions.
// We polyfill it to be safe.
if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: {
      _store: {} as Record<string, string>,
      getItem(key: string) { return this._store[key] ?? null },
      setItem(key: string, val: string) { this._store[key] = String(val) },
      removeItem(key: string) { delete this._store[key] },
      clear() { this._store = {} },
    },
    writable: true,
  })
}
