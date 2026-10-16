import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  type TemplateRef,
  ViewChild,
} from '@angular/core'
import {
  type CellContext,
  ColumnDef,
  type ExpandedState,
  getCoreRowModel,
  type TableOptions,
  type TableState,
} from '@tanstack/table-core'
import {
  createAngularTable,
  FlexRender,
  flexRenderComponent,
  type FlexRenderContent,
  injectFlexRenderContext,
} from '../src'
import { TestBed } from '@angular/core/testing'
import { describe, expect, test, vi } from 'vitest'
import { By } from '@angular/platform-browser'

const defaultData: TestData[] = [{ id: '1', title: 'My title' }] as TestData[]

const defaultColumns: ColumnDef<TestData>[] = [
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Title',
    cell: props => props.renderValue(),
  },
]

describe('FlexRenderDirective', () => {
  test.each([null, undefined])('Render %s as empty', value => {
    const { fixture, dom } = createTestTable(defaultData, [
      { id: 'first_cell', header: 'header', cell: () => value },
    ])
    const row = dom.getBodyRow(0)!
    const firstCell = row.querySelector('td')

    expect(firstCell!.matches(':empty')).toBe(true)
  })

  test.each([
    ['String column via function', () => 'My string'],
    ['String column', () => 'My string'],
    ['Number column via function', () => 0],
    ['Number column', 0],
  ])('Render primitive (%s)', (columnName, columnValue) => {
    const { fixture, dom } = createTestTable(defaultData, [
      { id: 'first_cell', header: columnName, cell: columnValue as any },
    ])
    const row = dom.getBodyRow(0)!
    const firstCell = row.querySelector('td')

    expectPrimitiveValueIs(
      firstCell,
      String(typeof columnValue === 'function' ? columnValue() : columnValue)
    )
  })

  test('Render TemplateRef', () => {
    @Component({
      template: `
        <ng-template #template let-context
          >Cell id: {{ context.cell.id }}</ng-template
        >
      `,
      standalone: true,
    })
    class FakeTemplateRefComponent {
      @ViewChild('template', { static: true })
      templateRef!: TemplateRef<any>
    }

    const templateRef = TestBed.createComponent(FakeTemplateRefComponent)
      .componentInstance.templateRef

    const { dom } = createTestTable(defaultData, [
      { id: 'first_cell', header: 'Header', cell: () => templateRef },
    ])

    const row = dom.getBodyRow(0)!
    const firstCell = row.querySelector('td')
    expect(firstCell!.textContent).toEqual('Cell id: 0_first_cell')
  })

  test('Render component with FlexRenderComponent', async () => {
    const status = signal<string>('Initial status')

    const { dom } = createTestTable(defaultData, [
      {
        id: 'first_cell',
        header: 'Status',
        cell: () => {
          return flexRenderComponent(TestBadgeComponent, {
            inputs: {
              status: status(),
            },
          })
        },
      },
    ])

    let row = dom.getBodyRow(0)!
    let firstCell = row.querySelector('td')
    expect(firstCell!.textContent).toEqual('Initial status')

    status.set('Updated status')
    dom.clickTriggerCdButton()

    expect(firstCell!.textContent).toEqual('Updated status')
  })

  test('Render content reactively based on signal value', async () => {
    const statusComponent = signal<FlexRenderContent<any>>('Initial status')

    const { dom, fixture } = createTestTable(defaultData, [
      {
        id: 'first_cell',
        header: 'Status',
        cell: () => {
          return statusComponent()
        },
      },
    ])

    let row = dom.getBodyRow(0)!
    let firstCell = row.querySelector('td')

    expect(firstCell!.textContent).toEqual('Initial status')

    statusComponent.set(null)
    fixture.detectChanges()
    expect(firstCell!.matches(':empty')).toBe(true)

    statusComponent.set(
      flexRenderComponent(TestBadgeComponent, {
        inputs: { status: 'Updated status' },
      })
    )
    fixture.detectChanges()
    const el = firstCell!.firstElementChild as HTMLElement
    expect(el!.tagName).toEqual('APP-TEST-BADGE')
    expect(el.textContent).toEqual('Updated status')
  })

  test('Cell content always get the latest context value', async () => {
    const contextCaptor = vi.fn()

    const tableState = signal<Partial<TableState>>({
      rowSelection: {},
    })

    @Component({
      template: ``,
    })
    class EmptyCell {}

    const { dom, fixture } = createTestTable(
      defaultData,
      [
        {
          id: 'cell',
          header: 'Header',
          cell: context => {
            contextCaptor(context)
            return flexRenderComponent(EmptyCell)
          },
        },
      ],
      () => ({
        state: tableState(),
        onStateChange: updater => {
          return typeof updater === 'function'
            ? tableState.update(updater as any)
            : tableState.set(updater)
        },
      })
    )

    const latestCall = () =>
      contextCaptor.mock.lastCall[0] as CellContext<TestData, any>
    // TODO: As a perf improvement, check in a future if we can avoid evaluating the cell twice during the first render.
    // This is caused due to the registration of the initial effect and the first #getContentValue() to detect the
    // type of content to render.
    expect(contextCaptor).toHaveBeenCalledTimes(2)

    expect(latestCall().row.getIsExpanded()).toEqual(false)
    expect(latestCall().row.getIsSelected()).toEqual(false)

    fixture.componentInstance.table.getRow('0').toggleSelected(true)
    dom.clickTriggerCdButton2()
    expect(contextCaptor).toHaveBeenCalledTimes(3)
    expect(latestCall().row.getIsSelected()).toEqual(true)

    fixture.componentInstance.table.getRow('0').toggleSelected(false)
    fixture.componentInstance.table.getRow('0').toggleExpanded(true)
    dom.clickTriggerCdButton2()
    expect(contextCaptor).toHaveBeenCalledTimes(4)
    expect(latestCall().row.getIsSelected()).toEqual(false)
    expect(latestCall().row.getIsExpanded()).toEqual(true)
  })

  test('Support cell with component output', async () => {
    const columns = [
      {
        id: 'expand',
        header: 'Expand',
        cell: ({ row }) => {
          return flexRenderComponent(ExpandCell, {
            inputs: { expanded: row.getIsExpanded() },
            outputs: { toggleExpand: () => row.toggleExpanded() },
          })
        },
      },
    ] satisfies ColumnDef<TestData>[]

    @Component({
      selector: 'expand-cell',
      template: `
        <button (click)="toggleExpand.emit()">
          {{ expanded() ? 'Expanded' : 'Not expanded' }}
        </button>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
      standalone: true,
    })
    class ExpandCell {
      readonly expanded = input(false)
      readonly toggleExpand = output<void>()
    }

    @Component({
      template: `
        <table>
          <tbody>
            @for (row of table.getRowModel().rows; track row.id) {
              <tr>
                @for (cell of row.getVisibleCells(); track cell.id) {
                  <td>
                    <ng-container
                      *flexRender="
                        cell.column.columnDef.cell;
                        props: cell.getContext();
                        let cell
                      "
                    >
                      <span [innerHTML]="cell"></span>
                    </ng-container>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
      standalone: true,
      selector: 'app-table-test',
      imports: [FlexRender],
    })
    class TestComponent {
      readonly expandState = signal<ExpandedState>({})

      readonly table = createAngularTable(() => {
        return {
          columns: columns,
          data: defaultData,
          getCoreRowModel: getCoreRowModel(),
          state: { expanded: this.expandState() },
          onExpandedChange: updaterOrValue => {
            typeof updaterOrValue === 'function'
              ? this.expandState.update(updaterOrValue)
              : this.expandState.set(updaterOrValue)
          },
        }
      })
    }
    const fixture = TestBed.createComponent(TestComponent)
    fixture.detectChanges()

    const expandCell = fixture.debugElement.query(By.directive(ExpandCell))
    expect(fixture.componentInstance.expandState()).toEqual({})
    expect(expandCell.componentInstance.expanded()).toEqual(false)

    const buttonEl = expandCell.query(By.css('button'))
    expect(buttonEl.nativeElement.innerHTML).toEqual(' Not expanded ')
    buttonEl.triggerEventHandler('click')

    expect(fixture.componentInstance.expandState()).toEqual({
      '0': true,
    })
    fixture.detectChanges()
    expect(buttonEl.nativeElement.innerHTML).toEqual(' Expanded ')
  })
})

function expectPrimitiveValueIs(
  cell: HTMLTableCellElement | null,
  value: unknown
) {
  expect(cell).not.toBeNull()
  expect(cell!.matches(':empty')).toBe(false)
  const span = cell!.querySelector('span')!
  expect(span).toBeDefined()
  expect(span.innerHTML).toEqual(value)
}

type TestData = { id: string; title: string }

export function createTestTable(
  data: TestData[],
  columns: ColumnDef<TestData, any>[],
  optionsFn?: () => Partial<TableOptions<TestData>>
) {
  @Component({
    template: `
      <table>
        <thead data-testid="thead">
          @for (headerGroup of table.getHeaderGroups(); track headerGroup.id) {
            <tr
              data-testid="thead_row"
              [attr.data-testid]="'thead_headergroup_' + headerGroup.id"
            >
              @for (header of headerGroup.headers; track header.id) {
                @if (!header.isPlaceholder) {
                  <th
                    [attr.data-testid]="
                      'thead_headergroup_' + headerGroup.id + '_' + header.id
                    "
                  >
                    <ng-container
                      *flexRender="
                        header.column.columnDef.header;
                        props: header.getContext();
                        let header
                      "
                    >
                      <span [innerHTML]="header"></span>
                    </ng-container>
                  </th>
                }
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (row of table.getRowModel().rows; track row.id) {
            <tr [attr.data-testid]="'row_' + row.id">
              @for (cell of row.getVisibleCells(); track cell.id) {
                <td [attr.data-testid]="'row_' + row.id + '_cell_' + cell.id">
                  <ng-container
                    *flexRender="
                      cell.column.columnDef.cell;
                      props: cell.getContext();
                      let cell
                    "
                  >
                    <span [innerHTML]="cell"></span>
                  </ng-container>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>

      <button (click)="(0)">Trigger CD</button>

      <button (click)="count.set(count() + 1)">Trigger CD 2</button>

      {{ count() }}
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    selector: 'app-table-test',
    imports: [FlexRender],
  })
  class TestComponent {
    readonly columns = input<ColumnDef<TestData>[]>(columns)
    readonly data = input<TestData[]>(data)

    readonly count = signal(0)

    readonly table = createAngularTable(() => {
      return {
        ...(optionsFn?.() ?? {}),
        columns: this.columns(),
        data: this.data(),
        getCoreRowModel: getCoreRowModel(),
      }
    })
  }

  const fixture = TestBed.createComponent(TestComponent)

  fixture.detectChanges()

  return {
    fixture,
    dom: {
      clickTriggerCdButton() {
        const btn = fixture.debugElement.query(By.css('button'))
        btn.triggerEventHandler('click', null)
        fixture.detectChanges()
      },
      clickTriggerCdButton2() {
        const btn = fixture.debugElement.queryAll(By.css('button'))[1]!
        btn.triggerEventHandler('click', null)
        fixture.detectChanges()
      },
      getTable() {
        return fixture.nativeElement.querySelector('table') as HTMLTableElement
      },
      getHeader() {
        return this.getTable().querySelector('thead') as HTMLTableSectionElement
      },
      getHeaderRow() {
        return this.getHeader().querySelector('tr') as HTMLTableRowElement
      },
      getBody() {
        return this.getTable().querySelector('tbody') as HTMLTableSectionElement
      },
      getBodyRow(index: number) {
        return this.getBody().rows.item(index)
      },
    },
  }
}

@Component({
  selector: 'app-test-badge',
  template: `<span>{{ status() }}</span> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestBadgeComponent {
  readonly context = injectFlexRenderContext<CellContext<TestData, any>>()

  readonly status = input.required<string>()
}
