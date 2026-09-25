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
  selector: 'column-virtualizer-variable',
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
            [attr.data-index]="col.index"
            [class.list-item-even]="col.index % 2 === 0"
            [class.list-item-odd]="col.index % 2 !== 0"
            style="position: absolute; top: 0; left: 0; height: 100%;"
            [style.width.px]="col.size"
            [style.transform]="'translateX(' + col.start + 'px)'"
          >
            Col {{ col.index }}
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 100px;
      width: 400px;
      overflow: auto;
    }
  `,
})
export class ColumnVirtualizerVariable {
  columns = input.required<number[]>()

  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualizer = injectVirtualizer(() => ({
    horizontal: true,
    scrollElement: this.scrollElement(),
    count: 10000,
    estimateSize: (index) => this.columns()[index]!,
    overscan: 5,
  }))
}
