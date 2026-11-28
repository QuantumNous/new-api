import { faker } from '@faker-js/faker'

interface Column {
  key: string
  name: string
  width: number
}

export const generateRandomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

export const generateSentences = () =>
  new Array(10000)
    .fill(true)
    .map(() => faker.lorem.sentence(generateRandomNumber(20, 70)))

export const generateColumns = (count: number) => {
  return new Array(count).fill(0).map((_, i) => {
    const key: string = i.toString()
    return {
      key,
      name: `Column ${i}`,
      width: generateRandomNumber(75, 300),
    }
  })
}

export const generateData = (columns: Column[], count = 300) => {
  return new Array(count).fill(0).map((_, rowIndex) =>
    columns.reduce<string[]>((acc, _curr, colIndex) => {
      // simulate dynamic size cells
      const val = faker.lorem.lines(((rowIndex + colIndex) % 10) + 1)

      acc.push(val)

      return acc
    }, []),
  )
}
