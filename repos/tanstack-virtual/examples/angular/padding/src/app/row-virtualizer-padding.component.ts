import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
  viewChildren,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'

@Component({
  standalone: true,
  selector: 'row-virtualizer-padding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 style="margin-top: 2rem">Rows</h3>
    <div #scrollElement class="list scroll-container">
      <div
        style="position: relative; width: 100%;"
        [style.height.px]="virtualizer.getTotalSize()"
      >
        @for (row of virtualizer.getVirtualItems(); track row.index) {
          <div
            #virtualItem
            [attr.data-index]="row.index"
            [class.list-item-even]="row.index % 2 === 0"
            [class.list-item-odd]="row.index % 2 !== 0"
            style="position: absolute; top: 0; left: 0; width: 100%;"
            [style.height.px]="rows()[row.index]"
            [style.transform]="'translateY(' + row.start + 'px)'"
          >
            Row {{ row.index }}
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 200px;
      width: 400px;
      overflow-y: auto;
    }
  `,
})
export class RowVirtualizerPadding {
  rows = input.required<number[]>()

  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualItems = viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  #measureItems = effect(
    () =>
      this.virtualItems().forEach((el) => {
        this.virtualizer.measureElement(el.nativeElement)
      }),
    { allowSignalWrites: true },
  )

  virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.rows().length,
    estimateSize: () => 50,
    paddingStart: 100,
    paddingEnd: 100,
  }))
}
