/**
 * Shared (non-server) module with client-safe values.
 * These are safe to use on the client.
 */
import type { User } from './db.server'

export const userColumns = {
  name: 'Full Name',
  email: 'Email Address',
} as const

/** Placeholder for when no users have loaded yet. */
export const emptyUser: User = { id: 0, name: '', email: '' }
