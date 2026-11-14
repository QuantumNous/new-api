import { computed, Directive, input } from '@angular/core'

@Directive({
  selector: '[tableResizableHeader]',
  host: {
    '[style.width]': 'width()',
  },
  standalone: true,
})
export class TableResizableHeader {
  readonly cellId = input.required<string>({
    alias: 'tableResizableHeader',
  })

  readonly width = computed(
    () => `calc(var(--header-${this.cellId()}-size) * 1px)`
  )
}

@Directive({
  selector: '[tableResizableCell]',
  host: {
    '[style.width]': 'width()',
  },
  standalone: true,
})
export class TableResizableCell {
  readonly cellId = input.required<string>({
    alias: 'tableResizableCell',
  })

  readonly width = computed(
    () => `calc(var(--col-${this.cellId()}-size) * 1px)`
  )
}
