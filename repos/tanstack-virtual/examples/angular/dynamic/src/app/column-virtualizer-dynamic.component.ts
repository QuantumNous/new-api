import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  viewChild,
  viewChildren,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'
import { sentences } from './utils'

@Component({
  standalone: true,
  selector: 'column-virtualizer-dynamic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 style="margin-top: 2rem">Columns</h3>
    <div #scrollElement class="list scroll-container">
      <div
        style="position: relative; height: 100%;"
        [style.width.px]="virtualizer.getTotalSize()"
      >
        @for (col of virtualizer.getVirtualItems(); track col.index) {
          <div
            #virtualItem
            [attr.data-index]="col.index"
            [class.list-item-even]="col.index % 2 === 0"
            [class.list-item-odd]="col.index % 2 !== 0"
            style="position: absolute; top: 0; left: 0; height: 100%;"
            [style.width.px]="sentences[col.index].length"
            [style.transform]="'translateX(' + col.start + 'px)'"
          >
            <div>
              <div>Column {{ col.index }}</div>
              <div>{{ sentences[col.index] }}</div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 400px;
      width: 400px;
      overflow: auto;
    }
  `,
})
export class ColumnVirtualizerDynamic {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualItems = viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  sentences = sentences

  count = this.sentences.length

  #measureItems = effect(
    () =>
      this.virtualItems().forEach((el) => {
        this.virtualizer.measureElement(el.nativeElement)
      }),
    { allowSignalWrites: true },
  )

  virtualizer = injectVirtualizer(() => ({
    horizontal: true,
    scrollElement: this.scrollElement(),
    count: this.count,
    estimateSize: () => 100,
    overscan: 5,
  }))
}
