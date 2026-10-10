import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core'
import { elementScroll, injectVirtualizer } from '@tanstack/angular-virtual'

function easeInOutQuint(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t
}

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      This smooth scroll example uses the <code>scrollToFn</code> to implement a
      custom scrolling function for the methods like
      <code>scrollToIndex</code> and <code>scrollToOffset</code>
    </p>
    <div>
      <button (click)="scrollToRandomIndex()">
        Scroll To Random Index ({{ randomIndex() }})
      </button>
    </div>
    <br />
    <div #scrollElement class="list scroll-container">
      <div
        style="position: relative; width: 100%;"
        [style.height.px]="virtualizer.getTotalSize()"
      >
        @for (row of virtualizer.getVirtualItems(); track row.index) {
          <div
            [class.list-item-even]="row.index % 2 === 0"
            [class.list-item-odd]="row.index % 2 !== 0"
            style="position: absolute; top: 0; left: 0; width: 100%;"
            [style.height.px]="row.size"
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
      overflow: auto;
    }
  `,
})
export class AppComponent {
  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  scrollingTime = signal(0)

  virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: 10000,
    estimateSize: () => 35,
    overscan: 5,
    scrollToFn: (offset, options, instance) => {
      const duration = 1000
      const start = this.scrollElement()!.nativeElement.scrollTop
      const startTime = Date.now()
      this.scrollingTime.set(startTime)

      const run = () => {
        if (this.scrollingTime() !== startTime) return
        const now = Date.now()
        const elapsed = now - startTime
        const progress = easeInOutQuint(Math.min(elapsed / duration, 1))
        const interpolated = start + (offset - start) * progress

        if (elapsed < duration) {
          elementScroll(interpolated, options, instance)
          requestAnimationFrame(run)
        } else {
          elementScroll(interpolated, options, instance)
        }
      }
      requestAnimationFrame(run)
    },
  }))

  randomIndex = signal(Math.floor(Math.random() * 10000))

  scrollToRandomIndex() {
    this.virtualizer.scrollToIndex(this.randomIndex())
    this.randomIndex.set(Math.floor(Math.random() * 10000))
  }
}
