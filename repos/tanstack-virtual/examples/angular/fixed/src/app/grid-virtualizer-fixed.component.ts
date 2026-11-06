import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'

@Component({
  standalone: true,
  selector: 'grid-virtualizer-fixed',
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
export class GridVirtualizerFixed {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  rowVirtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: 10000,
    estimateSize: () => 35,
    overscan: 5,
  }))

  columnVirtualizer = injectVirtualizer(() => ({
    horizontal: true,
    scrollElement: this.scrollElement(),
    count: 10000,
    estimateSize: () => 100,
    overscan: 5,
  }))
}
