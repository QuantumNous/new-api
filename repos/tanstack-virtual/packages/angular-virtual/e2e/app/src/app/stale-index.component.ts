import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core'
import type { ElementRef } from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'

interface Item {
  id: string
  label: string
}

function makeItems(count: number): Array<Item> {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    label: `Row ${index}`,
  }))
}

@Component({
  standalone: true,
  selector: 'app-stale-index',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <button
        data-testid="remove-items"
        type="button"
        (click)="removeLastFive()"
      >
        Remove last 5
      </button>
      <div data-testid="item-count">Count: {{ items().length }}</div>
      @if (error()) {
        <div data-testid="error">{{ error() }}</div>
      }

      <div
        #scrollElement
        data-testid="scroll-container"
        style="height: 300px; overflow: auto;"
      >
        <div
          style="position: relative; width: 100%;"
          [style.height.px]="virtualizer.getTotalSize()"
        >
          @for (row of virtualizer.getVirtualItems(); track row.index) {
            <div
              #virtualItem
              [attr.data-testid]="'item-' + row.index"
              [attr.data-index]="row.index"
              style="position: absolute; top: 0; left: 0; width: 100%; height: 50px; box-sizing: border-box; border-bottom: 1px solid #ccc; padding: 8px;"
              [style.transform]="'translateY(' + row.start + 'px)'"
            >
              {{ items()[row.index].label }}
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class StaleIndexComponent {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualItems = viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  items = signal(makeItems(20))

  error = signal<string | null>(null)

  #measureItems = afterRenderEffect({
    read: () => {
      this.virtualItems().forEach((el) => {
        this.virtualizer.measureElement(el.nativeElement)
      })
    },
  })

  virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.items().length,
    estimateSize: () => 50,
    getItemKey: (index) => {
      const items = this.items()
      if (index < 0 || index >= items.length) {
        const message = `getItemKey called with stale index ${index} (count=${items.length})`
        this.error.set(message)
        throw new Error(message)
      }
      return items[index]!.id
    },
  }))

  removeLastFive() {
    this.items.update((items) => items.slice(0, Math.max(0, items.length - 5)))
  }
}
