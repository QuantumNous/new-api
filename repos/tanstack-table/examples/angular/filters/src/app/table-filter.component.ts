import { CommonModule } from '@angular/common'
import { Component, computed, input, OnInit } from '@angular/core'
import type { Column, RowData, Table } from '@tanstack/angular-table'
import { DebouncedInputDirective } from './debounced-input.directive'

declare module '@tanstack/angular-table' {
  //allows us to define custom properties for our columns
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'range' | 'select'
  }
}

@Component({
  selector: 'app-table-filter',
  template: `
    @if (filterVariant() === 'range') {
      <div>
        <div class="flex space-x-2">
          <input
            debouncedInput
            [debounce]="500"
            type="number"
            class="w-24 border shadow rounded"
            [min]="column().getFacetedMinMaxValues()?.[0] ?? ''"
            [max]="column().getFacetedMinMaxValues()?.[1] ?? ''"
            [value]="columnFilterValue()?.[0] ?? ''"
            [attr.placeholder]="minRangePlaceholder()"
            (changeEvent)="changeMinRangeValue($event)"
          />

          <input
            debouncedInput
            [debounce]="500"
            type="number"
            class="w-24 border shadow rounded"
            [min]="column().getFacetedMinMaxValues()?.[0] ?? ''"
            [max]="column().getFacetedMinMaxValues()?.[1] ?? ''"
            [value]="columnFilterValue()?.[1] ?? ''"
            [attr.placeholder]="maxRangePlaceholder()"
            (changeEvent)="changeMaxRangeValue($event)"
          />
        </div>
        <div class="h-1"></div>
      </div>
    } @else if (filterVariant() === 'select') {
      <select
        [value]="columnFilterValue()?.toString()"
        (change)="column().setFilterValue($any($event).target.value)"
      >
        <option value="">All</option>
        @for (value of sortedUniqueValues(); track value) {
          <option [value]="value">
            {{ value }}
          </option>
        }
      </select>
    } @else {
      <datalist [id]="column().id + 'list'">
        @for (value of sortedUniqueValues(); track value) {
          <option [value]="value">
            {{ value }}
          </option>
        }
      </datalist>
      <input
        type="text"
        class="w-36 border shadow rounded"
        debouncedInput
        [debounce]="500"
        [attr.placeholder]="
          'Search... (' + column().getFacetedUniqueValues().size + ')'
        "
        [attr.list]="column().id + 'list'"
        [value]="columnFilterValue() ?? ''"
        (changeEvent)="column().setFilterValue($any($event).target.value)"
      />
      <div class="h-1"></div>
    }
  `,
  standalone: true,
  imports: [CommonModule, DebouncedInputDirective],
})
export class FilterComponent<T> {
  column = input.required<Column<any, any>>()

  table = input.required<Table<T>>()

  readonly filterVariant = computed(() => {
    return (this.column().columnDef.meta ?? {}).filterVariant
  })

  readonly columnFilterValue = computed<any>(() =>
    this.column().getFilterValue()
  )

  readonly minRangePlaceholder = computed(() => {
    return `Min ${
      this.column().getFacetedMinMaxValues()?.[0] !== undefined
        ? `(${this.column().getFacetedMinMaxValues()?.[0]})`
        : ''
    }`
  })

  readonly maxRangePlaceholder = computed(() => {
    return `Max ${
      this.column().getFacetedMinMaxValues()?.[1]
        ? `(${this.column().getFacetedMinMaxValues()?.[1]})`
        : ''
    }`
  })

  readonly sortedUniqueValues = computed(() => {
    const filterVariant = this.filterVariant()
    const column = this.column()
    if (filterVariant === 'range') {
      return []
    }
    return Array.from(column.getFacetedUniqueValues().keys())
      .sort()
      .slice(0, 5000)
  })

  readonly changeMinRangeValue = (event: Event) => {
    const value = (event.target as HTMLInputElement).value
    this.column().setFilterValue((old: [number, number]) => {
      return [value, old?.[1]]
    })
  }

  readonly changeMaxRangeValue = (event: Event) => {
    const value = (event.target as HTMLInputElement).value
    this.column().setFilterValue((old: [number, number]) => {
      return [old?.[0], value]
    })
  }
}
