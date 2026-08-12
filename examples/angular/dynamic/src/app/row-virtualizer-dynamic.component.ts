import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  viewChild,
  viewChildren,
} from '@angular/core'
import {
  AngularVirtualizer,
  injectVirtualizer,
} from '@tanstack/angular-virtual'
import { sentences } from './utils'

@Component({
  standalone: true,
  selector: 'row-virtualizer-dynamic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 style="margin-top: 2rem">Rows</h3>
    <button type="button" (click)="virtualizer.scrollToIndex(0)">
      scroll to the top
    </button>
    <button type="button" (click)="virtualizer.scrollToIndex(count / 2)">
      scroll to the middle
    </button>
    <button type="button" (click)="virtualizer.scrollToIndex(count - 1)">
      scroll to the end
    </button>
    <hr />
    <div #scrollElement class="list scroll-container">
      <div
        style="position: relative; width: 100%;"
        [style.height.px]="virtualizer.getTotalSize()"
      >
        <div
          style="position: absolute; top: 0; left: 0; width: 100%;"
          [style.transform]="
            'translateY(' +
            (virtualizer.getVirtualItems()[0]
              ? virtualizer.getVirtualItems()[0].start
              : 0) +
            'px)'
          "
        >
          @for (row of virtualizer.getVirtualItems(); track row.index) {
            <div
              #virtualItem
              [attr.data-index]="row.index"
              [class.list-item-even]="row.index % 2 === 0"
              [class.list-item-odd]="row.index % 2 !== 0"
            >
              <div style="padding: 10px 0">
                <div>Row {{ row.index }}</div>
                <div>{{ sentences[row.index] }}</div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 400px;
      width: 400px;
      overflow-y: auto;
      contain: 'strict';
    }
  `,
})
export class RowVirtualizerDynamic {
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
    scrollElement: this.scrollElement(),
    count: this.count,
    estimateSize: () => 120,
  }))
}
