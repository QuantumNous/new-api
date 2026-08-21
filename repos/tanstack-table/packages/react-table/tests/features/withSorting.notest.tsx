import React from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import { getHeaderIds, getRowValues } from '../../test-utils'
import { useTable } from '../../core/useTable'
import { noop } from '../../utils'
import { withSorting } from '../withSorting'
import type { Column, TableState } from '../../types'

const data = [
  {
    firstName: 'tanner',
    lastName: 'linsley',
    age: 29,
    visits: 100,
    status: 'In Relationship',
    progress: 80,
  },
  {
    firstName: 'derek',
    lastName: 'perkins',
    age: 40,
    visits: 40,
    status: 'Single',
    progress: 80,
  },
  {
    firstName: 'joe',
    lastName: 'bergevin',
    age: 45,
    visits: 20,
    status: 'Complicated',
    progress: 10,
  },
]

const columns: Column[] = [
  {
    Header: 'Name',
    columns: [
      {
        Header: 'First Name',
        accessor: 'firstName',
      },
      {
        Header: 'Last Name',
        accessor: 'lastName',
      },
    ],
  },
  {
    Header: 'Info',
    columns: [
      {
        Header: 'Age',
        accessor: 'age',
      },
      {
        Header: 'Visits',
        accessor: 'visits',
      },
      {
        Header: 'Status',
        accessor: 'status',
      },
      {
        Header: 'Profile Progress',
        accessor: 'progress',
      },
    ],
  },
]

describe('withSorting', () => {
  it('renders a sortable table', () => {
    const { result } = renderHook(
      options => {
        const table = useTable(options, [withCore, withSorting])

        return table
      },
      {
        initialProps: {
          data,
          columns,
        },
      }
    )

    expect(getHeaderIds(result.current)).toEqual([
      ['Name', 'Info'],
      ['firstName', 'lastName', 'age', 'visits', 'status', 'progress'],
    ])

    expect(getRowValues(result.current)).toEqual([
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'firstName')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'firstName')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['derek', 'perkins', 40, 40, 'Single', 80],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'progress')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['derek', 'perkins', 40, 40, 'Single', 80],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'firstName')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
          shiftKey: true,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
    ])
  })

  it('renders a controlled sorted table', () => {
    const { result, rerender } = renderHook(
      options => {
        const table = useTable(options, [withSorting])

        return table
      },
      {
        initialProps: {
          data,
          columns,
          state: {},
        },
      }
    )

    expect(getHeaderIds(result.current)).toEqual([
      ['Name', 'Info'],
      ['firstName', 'lastName', 'age', 'visits', 'status', 'progress'],
    ])

    expect(getRowValues(result.current)).toEqual([
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
    ])

    rerender({
      data,
      columns,
      state: { sorting: [{ id: 'firstName', desc: false }] },
    })

    expect(getRowValues(result.current)).toEqual([
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
    ])

    rerender({
      data,
      columns,
      state: { sorting: [{ id: 'firstName', desc: true }] },
    })

    expect(getRowValues(result.current)).toEqual([
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['derek', 'perkins', 40, 40, 'Single', 80],
    ])

    rerender({
      data,
      columns,
      state: { sorting: [{ id: 'progress', desc: false }] },
    })

    expect(getRowValues(result.current)).toEqual([
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['derek', 'perkins', 40, 40, 'Single', 80],
    ])

    rerender({
      data,
      columns,
      state: {
        sorting: [
          { id: 'progress', desc: false },
          { id: 'firstName', desc: false },
        ],
      },
    })

    expect(getRowValues(result.current)).toEqual([
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
    ])
  })

  it('renders a hoisted state sorted table', () => {
    const { result } = renderHook(
      options => {
        const [sorting, setSorting] = React.useState<TableState['sorting']>([])

        const table = useTable(
          {
            ...options,
            state: {
              sorting,
            },
            onSortingChange: setSorting,
          },
          [withSorting]
        )

        return table
      },
      {
        initialProps: {
          data,
          columns,
        },
      }
    )

    expect(getHeaderIds(result.current)).toEqual([
      ['Name', 'Info'],
      ['firstName', 'lastName', 'age', 'visits', 'status', 'progress'],
    ])

    expect(getRowValues(result.current)).toEqual([
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'firstName')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'firstName')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['derek', 'perkins', 40, 40, 'Single', 80],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'progress')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
      ['derek', 'perkins', 40, 40, 'Single', 80],
    ])

    act(() => {
      result.current.flatHeaders
        .find(d => d.id === 'firstName')
        ?.getToggleSortingProps?.()
        .onClick({
          persist: noop,
          shiftKey: true,
        })
    })

    expect(getRowValues(result.current)).toEqual([
      ['joe', 'bergevin', 45, 20, 'Complicated', 10],
      ['derek', 'perkins', 40, 40, 'Single', 80],
      ['tanner', 'linsley', 29, 100, 'In Relationship', 80],
    ])
  })
})
