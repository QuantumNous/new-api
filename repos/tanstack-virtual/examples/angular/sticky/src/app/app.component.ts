import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  viewChild,
} from '@angular/core'
import { faker } from '@faker-js/faker'
import {
  injectVirtualizer,
  defaultRangeExtractor,
} from '@tanstack/angular-virtual'

const groupedNames: Record<string, string[]> = {}

Array.from({ length: 1000 })
  .map(() => faker.person.firstName())
  .sort()
  .forEach((name) => {
    const char = name[0]
    if (!groupedNames[char]) {
      groupedNames[char] = []
    }
    groupedNames[char].push(name)
  })
const groups = Object.keys(groupedNames)
const rows = groups.reduce(
  (acc: string[], k) => [...acc, k, ...groupedNames[k]],
  [],
)
const stickyIndexes = groups.map((gn) => rows.findIndex((n) => n === gn))
const stickyIndexesSet = new Set(stickyIndexes)
const reversedStickyIndexes = [...stickyIndexes].reverse()

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #scrollElement class="list scroll-container">
      <div
        style="position: relative; width: 100%;"
        [style.height.px]="virtualizer.getTotalSize()"
      >
        @for (row of virtualizer.getVirtualItems(); track row.index) {
          <div
            [attr.data-index]="row.index"
            style="top: 0; left: 0; width: 100%; background: #fff"
            [style.zIndex]="isSticky(row.index) ? 1 : null"
            [style.borderBottom]="
              isSticky(row.index) ? '1px solid #ddd' : 'none'
            "
            [style.position]="isActiveSticky(row.index) ? 'sticky' : 'absolute'"
            [style.height.px]="row.size"
            [style.transform]="
              isActiveSticky(row.index)
                ? null
                : 'translateY(' + row.start + 'px)'
            "
          >
            {{ rows[row.index] }}
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .scroll-container {
      height: 300px;
      width: 400px;
      overflow: auto;
    }
  `,
})
export class AppComponent {
  rows = rows

  isSticky = (index: number) => stickyIndexesSet.has(index)

  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

  virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.rows.length,
    estimateSize: () => 50,
    rangeExtractor: (range) => {
      const next = new Set([
        reversedStickyIndexes.find((index) => range.startIndex >= index)!,
        ...defaultRangeExtractor(range),
      ])
      return [...next].sort((a, b) => a - b)
    },
  }))

  activeStickyIndex = computed(() => {
    return this.virtualizer.getVirtualItems()[0]?.index
  })

  isActiveSticky = (index: number) => this.activeStickyIndex() === index
}
