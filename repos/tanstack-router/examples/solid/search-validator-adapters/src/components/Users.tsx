import { queryOptions, useQuery } from '@tanstack/solid-query'

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
  const users = useQuery(() => usersQueryOptions(search))

  return (
    <table class="table-auto">
      <thead>
        <tr class="border text-left">
          <th class="p-4">Username</th>
          <th class="p-4">Name</th>
          <th class="p-4">Email</th>
        </tr>
      </thead>
      <tbody>
        {users.data?.map((user) => (
          <tr class="border">
            <td class="p-4">{user.username}</td>
            <td class="p-4">{user.name}</td>
            <td class="p-4">{user.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
