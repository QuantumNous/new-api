import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core'
import {
  injectVirtualizer,
  injectWindowVirtualizer,
} from '@tanstack/angular-virtual'
import { generateColumns, generateData } from './utils'

@Component({
  standalone: true,
  selector: 'grid-virtualizer-dynamic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 style="margin-top: 2rem">Grid</h3>
    <div
      #scrollElement
      class="list scroll-container"
      style="border: 1px solid #c8c8c8"
    >
      <div
        style="position: relative;"
        [style.height.px]="rowVirtualizer.getTotalSize()"
      >
        @for (row of rowVirtualizer.getVirtualItems(); track row.key) {
          <div
            [attr.data-index]="row.index"
            #virtualRow
            style="position: absolute; top: 0; left: 0; display: flex;"
            [style.transform]="
              'translateY(' +
              (row.start - rowVirtualizer.options().scrollMargin) +
              'px)'
            "
          >
            <div [style.width.px]="width()[0]"></div>
            @for (col of columnVirtualizer.getVirtualItems(); track col.key) {
              <div
                style="border-bottom: 1px solid #c8c8c8; border-right: 1px solid #c8c8c8; padding: 7px 12px"
                [style.minHeight.px]="row.index === 0 ? 50 : row.size"
                [style.width.px]="getColumnWidth(col.index)"
              >
                <div>
                  {{
                    row.index === 0
                      ? columns[col.index].name
                      : data[row.index][col.index]
                  }}
                </div>
              </div>
            }
            <div [style.width.px]="width()[1]"></div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      overflow: auto;
    }
  `,
})
export class GridVirtualizerDynamic {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')
  columns = generateColumns(30)
  data = generateData(this.columns)

  parentOffset = signal(0)

  constructor() {
    afterNextRender(() =>
      this.parentOffset.set(this.scrollElement()!.nativeElement.offsetTop),
    )
  }

  getColumnWidth = (index: number) => this.columns[index].width

  rowVirtualizer = injectWindowVirtualizer(() => ({
    count: this.data.length,
    estimateSize: () => 350,
    overscan: 5,
    scrollMargin: this.parentOffset(),
  }))

  columnVirtualizer = injectVirtualizer(() => ({
    horizontal: true,
    scrollElement: this.scrollElement(),
    count: this.columns.length,
    estimateSize: this.getColumnWidth,
    overscan: 5,
  }))

  width = computed(
    () => {
      const virtualColumns = this.columnVirtualizer.getVirtualItems()
      return virtualColumns.length > 0
        ? [
            virtualColumns[0].start,
            this.columnVirtualizer.getTotalSize() -
              virtualColumns[virtualColumns.length - 1].end,
          ]
        : [0, 0]
    },
    { equal: (a, b) => a[0] === b[0] && a[1] === b[1] },
  )

  virtualRows = viewChildren<ElementRef<HTMLDivElement>>('virtualRow')

  #measureItems = effect(
    () =>
      this.virtualRows().forEach((el) => {
        this.rowVirtualizer.measureElement(el.nativeElement)
      }),
    { allowSignalWrites: true },
  )
}
