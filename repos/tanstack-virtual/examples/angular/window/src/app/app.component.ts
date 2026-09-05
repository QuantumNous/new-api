import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core'
import { injectWindowVirtualizer } from '@tanstack/angular-virtual'

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      In many cases, when implementing a virtualizer with a window as the
      scrolling element, developers often find the need to specify a
      "scrollMargin." The scroll margin is a crucial setting that defines the
      space or gap between the start of the page and the edges of the list.
    </p>
    <h3>Window Scroller</h3>
    <div #scrollElement class="list">
      <div
        style="position: relative; width: 100%;"
        [style.height.px]="virtualizer.getTotalSize()"
      >
        @for (row of virtualizer.getVirtualItems(); track row.key) {
          <div
            #virtualItem
            [class.list-item-even]="row.index % 2 === 0"
            [class.list-item-odd]="row.index % 2 !== 0"
            style="position: absolute; top: 0; left: 0; width: 100%;"
            [style.height.px]="row.size"
            [style.transform]="
              'translateY(' +
              (row.start - virtualizer.options().scrollMargin) +
              'px)'
            "
          >
            Row {{ row.index }}
          </div>
        }
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
export class AppComponent {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualizer = injectWindowVirtualizer(() => ({
    count: 10000,
    estimateSize: () => 35,
    overscan: 5,
    scrollMargin: this.scrollElement()?.nativeElement.offsetTop,
  }))
}
