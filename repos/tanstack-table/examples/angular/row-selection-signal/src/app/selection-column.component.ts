import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { Row, Table } from '@tanstack/angular-table'

@Component({
  template: `
    <input
      type="checkbox"
      [checked]="table().getIsAllRowsSelected()"
      [indeterminate]="table().getIsSomeRowsSelected()"
      (change)="table().toggleAllRowsSelected()"
    />
  `,
  host: {
    class: 'px-1 block',
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableHeadSelectionComponent<T> {
  // Your component should also reflect the fields you use as props in flexRenderer directive.
  // Define the fields as input you want to use in your component
  // ie. In this case, you are passing HeaderContext object as props in flexRenderer directive.
  // You can define and use the table field, which is defined in HeaderContext.
  // Please take note that only signal based input is supported.

  //column = input.required<Column<T, unknown>>()
  //header = input.required<Header<T, unknown>>()
  table = input.required<Table<T>>()
}

@Component({
  template: `
    <input
      type="checkbox"
      [checked]="row().getIsSelected()"
      (change)="row().getToggleSelectedHandler()($event)"
    />
  `,
  host: {
    class: 'px-1 block',
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableRowSelectionComponent<T> {
  row = input.required<Row<T>>()
}
