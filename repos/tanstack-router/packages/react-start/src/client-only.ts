/**
 * Side-effect-only marker import.
 *
 * Usage:
 *   import '@tanstack/react-start/client-only'
 *
 * When this import appears in a module, the import-protection plugin marks
 * that module as client-only. Importing a client-only module from the server
 * environment will trigger a violation (error or mock depending on config).
 *
 * At build time, the plugin intercepts this specifier in `resolveId` and
 * replaces it with a virtual empty module — this source file exists only
 * so that TypeScript and IDE tooling can resolve the import.
 */
export {}
