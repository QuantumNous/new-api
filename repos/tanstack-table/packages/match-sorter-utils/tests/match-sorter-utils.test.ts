import { describe, expect, it } from 'vitest'
import { rankings, rankItem } from '../src'

interface Person {
  firstName: string
  lastName: string
  email: string
}

const testPerson: Person = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'j.doe@email.com',
}

describe('match-sorter-utils', () => {
  describe('rankItem', () => {
    describe('with accessorFn', () => {
      it('CASE_SENSITIVE_EQUAL', () => {
        const ranking = rankItem(testPerson, 'John', {
          accessors: [
            item => item.firstName,
            item => item.lastName,
            item => item.email,
          ],
        })
        expect(ranking.rank).toBe(rankings.CASE_SENSITIVE_EQUAL)
        expect(ranking.passed).toBe(true)
        expect(ranking.rankedValue).toBe(testPerson.firstName)
        expect(ranking.accessorIndex).toBe(0)
        expect(ranking.accessorThreshold).toBe(1)
      })

      it('NO_MATCH', () => {
        const ranking = rankItem(testPerson, 'Tom', {
          accessors: [
            item => item.firstName,
            item => item.lastName,
            item => item.email,
          ],
        })
        expect(ranking.rank).toBe(rankings.NO_MATCH)
        expect(ranking.passed).toBe(false)
        expect(ranking.rankedValue).toBe(testPerson)
        expect(ranking.accessorIndex).toBe(-1)
        expect(ranking.accessorThreshold).toBe(1)
      })
    })

    describe('with accessorOptions and custom Threshold', () => {
      it('CASE_SENSITIVE_EQUAL', () => {
        const ranking = rankItem(testPerson, 'John', {
          accessors: [
            {
              accessor: item => item.firstName,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => item.lastName,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => item.email,
              threshold: rankings.MATCHES,
            },
          ],
        })
        expect(ranking.rank).toBe(rankings.CASE_SENSITIVE_EQUAL)
        expect(ranking.passed).toBe(true)
        expect(ranking.rankedValue).toBe(testPerson.firstName)
        expect(ranking.accessorIndex).toBe(0)
        expect(ranking.accessorThreshold).toBe(rankings.CONTAINS)
      })

      it('ACRONYM but threshold is CONTAINS', () => {
        const ranking = rankItem(testPerson, 'jd', {
          threshold: rankings.ACRONYM,
          accessors: [
            {
              accessor: item => item.firstName,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => item.lastName,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => `${item.firstName} ${item.lastName}`,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => item.email,
              threshold: rankings.CONTAINS,
            },
          ],
        })
        expect(ranking.rank).toBe(rankings.NO_MATCH)
        expect(ranking.passed).toBe(false)
        expect(ranking.rankedValue).toBe(testPerson)
        expect(ranking.accessorIndex).toBe(-1)
        expect(ranking.accessorThreshold).toBe(rankings.ACRONYM)
      })

      it('NO_MATCH', () => {
        const ranking = rankItem(testPerson, 'Tom', {
          accessors: [
            {
              accessor: item => item.firstName,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => item.lastName,
              threshold: rankings.CONTAINS,
            },
            {
              accessor: item => item.email,
              threshold: rankings.MATCHES,
            },
          ],
        })
        expect(ranking.rank).toBe(rankings.NO_MATCH)
        expect(ranking.passed).toBe(false)
        expect(ranking.rankedValue).toBe(testPerson)
        expect(ranking.accessorIndex).toBe(-1)
        expect(ranking.accessorThreshold).toBe(1)
      })
    })
  })
})
