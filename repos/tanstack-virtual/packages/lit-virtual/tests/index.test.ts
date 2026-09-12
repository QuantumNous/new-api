import { describe, test, expect, beforeEach } from 'vitest'
import { elementUpdated, fixture, html, waitUntil } from '@open-wc/testing'
import { LitElement } from 'lit'
import { VirtualizerController } from '../src'
import { createRef, ref, Ref } from 'lit/directives/ref.js'
import { repeat } from 'lit/directives/repeat.js'
import { customElement } from 'lit/decorators.js'

const width = 400
const height = 400
const count = 50

@customElement('test-list')
class List extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count,
      estimateSize: () => 50,
      observeElementRect: (_, cb) => {
        cb({ height, width })
      },
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const virtualRows = virtualizer.getVirtualItems()

    return html`
      <div>
        <button
          @click=${() => {
            virtualizer.scrollToIndex(count - 1)
            console.log('scrolled down!')
          }}
        >
          scroll to the end
        </button>
        <div class="list scroll-container" ${ref(this.scrollElementRef)}>
          <div
            style="position: relative; height: ${virtualizer.getTotalSize()}px; width: 100%;"
          >
            <div
              style="position:absolute;top:0;left:0;width:100%;transform:translateY(${virtualRows[0]
                ? virtualRows[0].start
                : 0}px);"
            >
              ${repeat(
                virtualRows,
                (virtualRow) => virtualRow.key,
                (virtualRow) =>
                  html` <div
                    data-index="${virtualRow.index}"
                    ${ref(virtualizer.measureElement)}
                    class="${virtualRow.index % 2 === 0
                      ? 'list-item-even'
                      : 'list-item-odd'}"
                  >
                    <div style="padding: 10px 0;">
                      <div>Row ${virtualRow.index}</div>
                      <div>Item ${virtualRow.index}</div>
                    </div>
                  </div>`,
              )}
            </div>
          </div>
        </div>
      </div>
      <style>
        .list {
          border: 1px solid #e6e4dc;
          max-width: 100%;
        }

        .list-item-even,
        .list-item-odd {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .list-item-even {
          background-color: #e6e4dc;
        }

        .scroll-container {
          height: ${height}px;
          width: ${width}px;
          overflow-y: auto;
        }
      </style>
    `
  }
}

test('should render', async () => {
  const el = await fixture(html`<test-list></test-list>`)
  await elementUpdated(el)
  expect(el).toBeTruthy()
})

test('should render virtual items', async () => {
  const el = await fixture(html`<test-list></test-list>`)
  await elementUpdated(el)
  await waitUntil(
    () => el.shadowRoot.querySelector('[data-index="4"]'),
    'Element did not render virtual items',
  )
})
