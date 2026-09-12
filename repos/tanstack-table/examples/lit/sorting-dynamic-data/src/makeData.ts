import { faker } from '@faker-js/faker'

export type Person = {
  firstName: string
  lastName: string | undefined
  age: number
  visits: number | undefined
  progress: number
  status: 'relationship' | 'complicated' | 'single'
  rank: number
  createdAt: Date
  subRows?: Person[]
}

const range = (len: number) => {
  const arr: number[] = []
  for (let i = 0; i < len; i++) {
    arr.push(i)
  }
  return arr
}

const newPerson = (): Person => {
  return {
    firstName: faker.person.firstName(),
    lastName: Math.random() < 0.1 ? undefined : faker.person.lastName(),
    age: faker.number.int(40),
    visits: Math.random() < 0.1 ? undefined : faker.number.int(1000),
    progress: faker.number.int(100),
    createdAt: faker.date.anytime(),
    status: faker.helpers.shuffle<Person['status']>([
      'relationship',
      'complicated',
      'single',
    ])[0]!,
    rank: faker.number.int(100),
  }
}

export function makeData(...lens: number[]) {
  const makeDataLevel = (depth = 0): Person[] => {
    const len = lens[depth]!
    return range(len).map((_d): Person => {
      return {
        ...newPerson(),
        subRows: lens[depth + 1] ? makeDataLevel(depth + 1) : undefined,
      }
    })
  }

  return makeDataLevel()
}
