import { faker } from '@faker-js/faker'
import { ColumnSort, SortingState } from '@tanstack/react-table'

export type Person = {
  id: number
  firstName: string
  lastName: string
  age: number
  visits: number
  progress: number
  status: 'relationship' | 'complicated' | 'single'
  createdAt: Date
}

export type PersonApiResponse = {
  data: Person[]
  meta: {
    totalRowCount: number
  }
}

const range = (len: number) => {
  const arr: number[] = []
  for (let i = 0; i < len; i++) {
    arr.push(i)
  }
  return arr
}

const newPerson = (index: number): Person => {
  return {
    id: index + 1,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    age: faker.number.int(40),
    visits: faker.number.int(1000),
    progress: faker.number.int(100),
    createdAt: faker.date.anytime(),
    status: faker.helpers.shuffle<Person['status']>([
      'relationship',
      'complicated',
      'single',
    ])[0]!,
  }
}

export function makeData(...lens: number[]) {
  const makeDataLevel = (depth = 0): Person[] => {
    const len = lens[depth]!
    return range(len).map((d): Person => {
      return {
        ...newPerson(d),
      }
    })
  }

  return makeDataLevel()
}

const data = makeData(1000)

//simulates a backend api
export const fetchData = async (
  start: number,
  size: number,
  sorting: SortingState
) => {
  const dbData = [...data]
  if (sorting.length) {
    const sort = sorting[0] as ColumnSort
    const { id, desc } = sort as { id: keyof Person; desc: boolean }
    dbData.sort((a, b) => {
      if (desc) {
        return a[id] < b[id] ? 1 : -1
      }
      return a[id] > b[id] ? 1 : -1
    })
  }

  //simulate a backend api
  await new Promise(resolve => setTimeout(resolve, 200))

  return {
    data: dbData.slice(start, start + size),
    meta: {
      totalRowCount: dbData.length,
    },
  }
}
