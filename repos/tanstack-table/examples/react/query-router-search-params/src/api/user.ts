import { faker } from '@faker-js/faker'
import { Filters, PaginatedData } from './types'

const DEFAULT_PAGE = 0
const DEFAULT_PAGE_SIZE = 10

export type User = {
  id: number
  firstName: string
  lastName: string
  age: number
}

export type UserFilters = Filters<User>

function makeData(amount: number): User[] {
  return Array(amount)
    .fill(0)
    .map((_, index) => {
      return {
        id: index + 1,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        age: faker.number.int(40),
      }
    })
}

const data = makeData(1000)

export async function fetchUsers(
  filtersAndPagination: UserFilters
): Promise<PaginatedData<User>> {
  console.log('fetchUsers', filtersAndPagination)
  const {
    pageIndex = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy,
    ...filters
  } = filtersAndPagination
  const requestedData = data.slice()

  if (sortBy) {
    const [field, order] = sortBy.split('.')
    requestedData.sort((a, b) => {
      const aValue = a[field as keyof User]
      const bValue = b[field as keyof User]

      if (aValue === bValue) return 0
      if (order === 'asc') return aValue > bValue ? 1 : -1
      return aValue < bValue ? 1 : -1
    })
  }

  const filteredData = requestedData.filter(user => {
    return Object.keys(filters).every(key => {
      const filter = filters[key as keyof User]
      if (filter === undefined || filter === '') return true

      const value = user[key as keyof User]
      if (typeof value === 'number') return value === +filter

      return value.toLowerCase().includes(`${filter}`.toLowerCase())
    })
  })

  await new Promise(resolve => setTimeout(resolve, 100))

  return {
    result: filteredData.slice(
      pageIndex * pageSize,
      (pageIndex + 1) * pageSize
    ),
    rowCount: filteredData.length,
  }
}
