import { describe, expect, test, vi } from 'vitest'
import {
  type ColumnDef,
  createAngularTable,
  getCoreRowModel,
  type RowSelectionState,
  type Table,
  RowModel,
  type PaginationState,
  getPaginationRowModel,
} from '../src/index'
import {
  Component,
  effect,
  input,
  isSignal,
  signal,
  untracked,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { setFixtureSignalInputs } from './test-utils'

describe('createAngularTable', () => {
  test('should render with required signal inputs', () => {
    @Component({
      selector: 'app-fake',
      template: ``,
      standalone: true,
    })
    class FakeComponent {
      data = input.required<any[]>()

      table = createAngularTable(() => ({
        data: this.data(),
        columns: [],
        getCoreRowModel: getCoreRowModel(),
      }))
    }

    const fixture = TestBed.createComponent(FakeComponent)
    setFixtureSignalInputs(fixture, {
      data: [],
    })

    fixture.detectChanges()
  })

  describe('Proxy table', () => {
    type Data = { id: string; title: string }
    const data = signal<Data[]>([{ id: '1', title: 'Title' }])
    const columns: ColumnDef<Data>[] = [
      { id: 'id', header: 'Id', cell: context => context.getValue() },
      { id: 'title', header: 'Title', cell: context => context.getValue() },
    ]
    const table = createAngularTable(() => ({
      data: data(),
      columns: columns,
      getCoreRowModel: getCoreRowModel(),
      getRowId: row => row.id,
    }))
    const tablePropertyKeys = Object.keys(table())

    test('table must be a signal', () => {
      expect(isSignal(table)).toEqual(true)
    })

    test('supports "in" operator', () => {
      expect('getCoreRowModel' in table).toBe(true)
      expect('options' in table).toBe(true)
      expect('notFound' in table).toBe(false)
    })

    test('supports "Object.keys"', () => {
      const keys = Object.keys(table())
      expect(Object.keys(table)).toEqual(keys)
    })

    test.each(
      tablePropertyKeys.map(property => [
        property,
        testShouldBeComputedProperty(untracked(table), property),
      ])
    )('property (%s) is computed -> (%s)', (name, expected) => {
      const tableProperty = table[name as keyof typeof table]
      expect(isSignal(tableProperty)).toEqual(expected)
    })

    test('Row model is reactive', () => {
      const coreRowModelFn = vi.fn<[RowModel<Data>]>()
      const rowModelFn = vi.fn<[RowModel<Data>]>()
      const pagination = signal<PaginationState>({
        pageSize: 5,
        pageIndex: 0,
      })
      const data = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        title: `Title ${i}`,
      }))

      TestBed.runInInjectionContext(() => {
        const table = createAngularTable(() => ({
          data,
          columns: columns,
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          getRowId: row => row.id,
          state: {
            pagination: pagination(),
          },
          onPaginationChange: updater => {
            typeof updater === 'function'
              ? pagination.update(updater)
              : pagination.set(updater)
          },
        }))

        effect(() => coreRowModelFn(table.getCoreRowModel()))
        effect(() => rowModelFn(table.getRowModel()))

        TestBed.flushEffects()

        pagination.set({ pageIndex: 0, pageSize: 3 })

        TestBed.flushEffects()
      })

      expect(coreRowModelFn).toHaveBeenCalledOnce()
      expect(coreRowModelFn.mock.calls[0]![0].rows.length).toEqual(10)

      expect(rowModelFn).toHaveBeenCalledTimes(2)
      expect(rowModelFn.mock.calls[0]![0].rows.length).toEqual(5)
      expect(rowModelFn.mock.calls[1]![0].rows.length).toEqual(3)
    })
  })
})

const testShouldBeComputedProperty = (
  table: Table<any>,
  propertyName: string
) => {
  if (propertyName.endsWith('Handler')) {
    // || propertyName.endsWith('Model')) {
    return false
  }

  if (propertyName.startsWith('get')) {
    // Only properties with no arguments are computed
    const fn = table[propertyName as keyof Table<any>]
    // Cannot test if is lazy computed since we return the unwrapped value
    return fn instanceof Function && fn.length === 0
  }

  return false
}
