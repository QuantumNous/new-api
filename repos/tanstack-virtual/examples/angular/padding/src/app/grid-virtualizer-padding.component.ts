import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'

@Component({
  standalone: true,
  selector: 'grid-virtualizer-padding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 style="margin-top: 2rem">Grid</h3>
    <button type="button" (click)="toggleShow()">Toggle</button>
    <button
      type="button"
      (click)="rowVirtualizer.scrollToIndex(rows().length / 2)"
    >
      Scroll to the middle
    </button>
    <button
      type="button"
      (click)="rowVirtualizer.scrollToIndex(rows().length - 1)"
    >
      Scroll to the end
    </button>
    @if (show()) {
      <div #scrollElement class="list scroll-container">
        <div
          style="position: relative;"
          [style.height.px]="rowVirtualizer.getTotalSize()"
          [style.width.px]="columnVirtualizer.getTotalSize()"
        >
          @for (row of rowVirtualizer.getVirtualItems(); track row.index) {
            @for (col of columnVirtualizer.getVirtualItems(); track col.index) {
              <div
                #virtualItem
                [attr.data-colindex]="col.index"
                [attr.data-rowindex]="row.index"
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
                [style.width.px]="columns()[col.index]"
                [style.height.px]="rows()[row.index]"
                [style.transform]="
                  'translateX(' +
                  col.start +
                  'px) translateY(' +
                  row.start +
                  'px)'
                "
              >
                <div>Cell {{ row.index }}, {{ col.index }}</div>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: `
    .scroll-container {
      height: 400px;
      width: 500px;
      overflow: auto;
    }
  `,
})
export class GridVirtualizerPadding {
  rows = input.required<number[]>()
  columns = input.required<number[]>()

  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  rowVirtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.rows().length,
    estimateSize: (index) => this.rows()[index]!,
    overscan: 5,
    paddingStart: 200,
    paddingEnd: 200,
    indexAttribute: 'data-rowindex',
  }))

  columnVirtualizer = injectVirtualizer(() => ({
    horizontal: true,
    scrollElement: this.scrollElement(),
    count: this.columns().length,
    estimateSize: (index) => this.columns()[index]!,
    overscan: 5,
    paddingStart: 200,
    paddingEnd: 200,
    indexAttribute: 'data-colindex',
  }))

  virtualItems = viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  #measureItems = effect(
    () =>
      this.virtualItems().forEach((el) => {
        this.rowVirtualizer.measureElement(el.nativeElement)
        this.columnVirtualizer.measureElement(el.nativeElement)
      }),
    { allowSignalWrites: true },
  )

  show = signal(true)

  toggleShow() {
    this.show.update((show) => !show)
  }
}
