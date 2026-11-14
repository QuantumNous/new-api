import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'

@Component({
  standalone: true,
  selector: 'grid-virtualizer-variable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 style="margin-top: 2rem">Grid</h3>
    <div #scrollElement class="list scroll-container">
      <div
        style="position: relative; height: 100%;"
        [style.width.px]="columnVirtualizer.getTotalSize()"
        [style.height.px]="rowVirtualizer.getTotalSize()"
      >
        @for (
          row of rowVirtualizer.getVirtualItems();
          track row.index;
          let rowEven = $even
        ) {
          @for (
            col of columnVirtualizer.getVirtualItems();
            track col.index;
            let colEven = $even
          ) {
            <div
              [attr.data-index]="col.index"
              [class]="
                col.index % 2
                  ? row.index % 2 === 0
                    ? 'list-item-odd'
                    : 'list-item-even'
                  : row.index % 2
                    ? 'list-item-odd'
                    : 'list-item-even'
              "
              style="position: absolute; top: 0; left: 0;"
              [style.height.px]="row.size"
              [style.width.px]="col.size"
              [style.transform]="
                'translateX(' +
                col.start +
                'px)' +
                'translateY(' +
                row.start +
                'px)'
              "
            >
              Cell {{ row.index }}, {{ col.index }}
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 500px;
      width: 500px;
      overflow: auto;
    }
  `,
})
export class GridVirtualizerVariable {
  rows = input.required<number[]>()

  columns = input.required<number[]>()

  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  rowVirtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: 10000,
    estimateSize: (index) => this.rows()[index]!,
    overscan: 5,
  }))

  columnVirtualizer = injectVirtualizer(() => ({
    horizontal: true,
    scrollElement: this.scrollElement(),
    count: 10000,
    estimateSize: (index) => this.columns()[index]!,
    overscan: 5,
  }))
}
