import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
// Import from the barrel — NOT directly from .server.
// `getUsers` (from ./db.server) is only used inside a server fn (compiler strips it).
// `userColumns` (from ./shared) is a plain object used in JSX — not server-only.
// Tree-shaking should eliminate the ./db.server dependency entirely from the
// client bundle, so no import-protection violation should fire for it.
import { getUsers, userColumns, type User } from '../violations/barrel-reexport'

const fetchUsers = createServerFn().handler(async () => {
  return getUsers()
})

export const Route = createFileRoute('/barrel-false-positive')({
  loader: () => fetchUsers(),
  component: BarrelFalsePositive,
})

function BarrelFalsePositive() {
  const users = Route.useLoaderData()

  return (
    <div>
      <h1 data-testid="barrel-heading">Barrel False Positive</h1>
      <table>
        <thead>
          <tr>
            <th data-testid="col-name">{userColumns.name}</th>
            <th data-testid="col-email">{userColumns.email}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user: User) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
