import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import {
  type HeaderContext,
  injectFlexRenderContext,
  type Table,
  CellContext,
} from '@tanstack/angular-table'

@Component({
  standalone: true,
  template: `
    <input
      type="checkbox"
      [indeterminate]="table.getIsSomeRowsSelected()"
      [checked]="table.getIsAllRowsSelected()"
      (change)="table.getToggleAllRowsSelectedHandler()($event)"
    />
    {{ ' ' }}

    <button (click)="table.getToggleAllRowsExpandedHandler()($event)">
      {{ context.table.getIsAllRowsExpanded() ? '👇' : '👉' }}
    </button>

    {{ label() }}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpandableHeaderCell<T> {
  readonly context = injectFlexRenderContext<HeaderContext<T, unknown>>()

  readonly label = input.required<string>()

  get table() {
    return this.context.table as Table<T>
  }
}

@Component({
  standalone: true,
  template: `
    <div [style.--depth]="row.depth">
      <div>
        <input
          type="checkbox"
          [indeterminate]="row.getIsSomeSelected()"
          [checked]="row.getIsSelected()"
          (change)="row.getToggleSelectedHandler()($event)"
        />
        {{ ' ' }}

        @if (row.getCanExpand()) {
          <button (click)="row.getToggleExpandedHandler()()">
            {{ row.getIsExpanded() ? '👇' : '👉' }}
          </button>
        } @else {
          <span>🔵</span>
        }
        {{ ' ' }}

        {{ context.getValue() }}
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      > div {
        padding-left: calc(2rem * var(--depth, 1));
      }
    }
  `,
})
export class ExpandableCell<T> {
  readonly context = injectFlexRenderContext<CellContext<T, unknown>>()

  get row() {
    return this.context.row
  }
}
