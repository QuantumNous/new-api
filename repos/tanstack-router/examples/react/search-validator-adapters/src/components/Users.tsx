import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

export interface Geo {
  lat: string
  lng: string
}

export interface Address {
  street: string
  suite: string
  city: string
  zipcode: string
  geo: Geo
}

export interface Company {
  name: string
  catchPhrase: string
  bs: string
}

export interface User {
  id: number
  name: string
  username: string
  email: string
  address: Address
  phone: string
  website: string
  company: Company
}

export const getUsers = async (): Promise<Array<User>> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users')
  const users: Array<User> = await response.json()
  return users
}

export const searchUsers = async (search: string): Promise<Array<User>> => {
  const users = await getUsers()
  const normalizedSearch = search.toLowerCase()
  return users.filter(
    (user) =>
      user.name.toLowerCase().includes(normalizedSearch) ||
      user.username.toLowerCase().includes(normalizedSearch),
  )
}

export const usersQueryOptions = (search: string) =>
  queryOptions({
    queryKey: ['users', search],
    queryFn: async () => {
      return await searchUsers(search)
    },
  })

export interface UsersProps {
  search: string
}

export const Users = ({ search }: UsersProps) => {
  const { data: users } = useSuspenseQuery(usersQueryOptions(search))

  return (
    <table className="table-auto">
      <thead>
        <tr className="border text-left">
          <th className="p-4">Username</th>
          <th className="p-4">Name</th>
          <th className="p-4">Email</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border">
            <td className="p-4">{user.username}</td>
            <td className="p-4">{user.name}</td>
            <td className="p-4">{user.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
