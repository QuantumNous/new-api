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

const initialItems: Array<Item> = [
  { id: 'item-a', label: 'A' },
  { id: 'item-b', label: 'B' },
  { id: 'item-c', label: 'C' },
]

@Component({
  standalone: true,
  selector: 'app-measure-element',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #scrollElement
      id="scroll-container"
      style="height: 400px; overflow: auto;"
    >
      <div
        style="position: relative; width: 100%;"
        [style.height.px]="virtualizer.getTotalSize()"
      >
        @for (row of virtualizer.getVirtualItems(); track row.key) {
          @let item = this.items()[row.index]!;
          <div
            #virtualItem
            [attr.data-testid]="item.id"
            [attr.data-index]="row.index"
            style="position: absolute; top: 0; left: 0; width: 100%;"
            [style.transform]="'translateY(' + row.start + 'px)'"
          >
            <div
              style="display: flex; gap: 8px; align-items: center; padding: 4px;"
            >
              <span>Row {{ item.label }}</span>
              <button
                [attr.data-testid]="'expand-' + item.id"
                type="button"
                (click)="toggleExpand(item.id)"
              >
                {{ expandedId() === item.id ? 'Collapse' : 'Expand' }}
              </button>
              <button
                [attr.data-testid]="'delete-' + item.id"
                type="button"
                (click)="deleteItem(item.id)"
              >
                Delete
              </button>
            </div>
            @if (expandedId() === item.id) {
              <div
                [attr.data-testid]="'content-' + item.id"
                style="height: 124px; background: #eee; padding: 8px;"
              >
                Expanded content for {{ item.label }}
              </div>
            }
          </div>
        }
      </div>
    </div>
    <div data-testid="total-size">{{ virtualizer.getTotalSize() }}</div>
  `,
})
export class MeasureElementComponent {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualItems = viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  items = signal(initialItems)

  expandedId = signal<string | null>(null)

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
    estimateSize: () => 36,
    getItemKey: (index) => this.items()[index]!.id,
  }))

  toggleExpand(id: string) {
    this.expandedId.update((current) => (current === id ? null : id))
  }

  deleteItem(id: string) {
    this.items.update((items) => items.filter((item) => item.id !== id))

    if (this.expandedId() === id) {
      this.expandedId.set(null)
    }
  }
}
