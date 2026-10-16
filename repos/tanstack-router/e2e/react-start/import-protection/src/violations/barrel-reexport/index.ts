/**
 * Barrel file — NOT a .server file itself.
 * Re-exports from a .server module, a marker-protected module, and a shared module.
 *
 * The key scenario: a consumer imports { getUsers, userColumns } from here.
 * - getUsers comes from ./db.server (server-only via file suffix)
 * - foo comes from ./foo (server-only via marker import)
 * - userColumns comes from ./shared (client-safe)
 *
 * If getUsers is only used inside a createServerFn handler (compiler strips it),
 * and foo is never imported by the consumer at all, tree-shaking should eliminate
 * both ./db.server and ./foo from the client bundle — so the import-protection
 * plugin should NOT fire violations for either.
 */
export { getUsers, type User } from './db.server'
export { foo } from './foo'
export { userColumns } from './shared'
