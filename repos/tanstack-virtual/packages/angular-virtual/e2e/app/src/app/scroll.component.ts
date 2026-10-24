import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  viewChild,
  viewChildren,
} from '@angular/core'
import type { ElementRef } from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const randomHeightForKey = (() => {
  const cache = new Map<string, number>()
  return (id: string) => {
    const value = cache.get(id)
    if (value !== undefined) {
      return value
    }
    const v = getRandomInt(25, 100)
    cache.set(id, v)
    return v
  }
})()

@Component({
  standalone: true,
  selector: 'app-scroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <button
        id="scroll-to-1000"
        type="button"
        (click)="virtualizer.scrollToIndex(1000)"
      >
        Scroll to 1000
      </button>
      <button
        id="scroll-to-last"
        type="button"
        (click)="virtualizer.scrollToIndex(count - 1)"
      >
        Scroll to last
      </button>
      <button
        id="scroll-to-0"
        type="button"
        (click)="virtualizer.scrollToIndex(0)"
      >
        Scroll to 0
      </button>

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
            <div
              #virtualItem
              [attr.data-testid]="'item-' + row.index"
              [attr.data-index]="row.index"
              style="position: absolute; top: 0; left: 0; width: 100%;"
              [style.transform]="'translateY(' + row.start + 'px)'"
            >
              <div [style.height.px]="randomHeight(row.key)">
                Row {{ row.index }}
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ScrollComponent {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualItems = viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  count = 1002

  initialOffset = Number(
    new URLSearchParams(window.location.search).get('initialOffset') ?? 0,
  )

  #measureItems = afterRenderEffect({
    read: () => {
      this.virtualItems().forEach((el) => {
        this.virtualizer.measureElement(el.nativeElement)
      })
    },
  })

  virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.count,
    estimateSize: () => 50,
    initialOffset: this.initialOffset,
    debug: true,
  }))

  randomHeight(key: string | number | bigint): number {
    return randomHeightForKey(String(key))
  }
}
