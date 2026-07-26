// Initialize i18n for all component tests. Force English so assertions on source
// strings stay stable regardless of the host OS language. Keys fall back to the
// English source string when a locale has no entry.
import i18n from "./i18n";

// Some test files call vi.unstubAllGlobals(), which can drop jsdom's localStorage.
// Ensure a durable in-memory implementation always exists.
const mem = new Map<string, string>();
const storage: Storage = {
  get length() {
    return mem.size;
  },
  clear: () => mem.clear(),
  getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k, v) => {
    mem.set(String(k), String(v));
  },
  removeItem: (k) => {
    mem.delete(String(k));
  },
  key: (i) => [...mem.keys()][i] ?? null,
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  get: () => storage,
});

void i18n.changeLanguage("en");
