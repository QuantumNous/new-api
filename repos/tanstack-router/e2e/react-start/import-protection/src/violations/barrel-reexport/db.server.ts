/**
 * Server-only database module.
 * Only exports server-only values: getUsers (DB access) and User type.
 * The side-effect (DATABASE_URL log) should NOT reach the client.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://admin:s3cret@localhost:5432/myapp'

console.log(`[db] connecting to ${DATABASE_URL}`)

export interface User {
  id: number
  name: string
  email: string
}

const FAKE_USERS: Array<User> = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
]

export async function getUsers(): Promise<Array<User>> {
  await new Promise((r) => setTimeout(r, 50))
  return FAKE_USERS
}
