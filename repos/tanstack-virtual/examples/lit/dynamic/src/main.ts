import { customElement, property } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { html, LitElement } from 'lit'
import { faker } from '@faker-js/faker'
import { repeat } from 'lit/directives/repeat.js'
import {
  VirtualizerController,
  WindowVirtualizerController,
} from '@tanstack/lit-virtual'

interface Column {
  key: string
  name: string
  width: number
}

function randomNumber(min: number, max: number) {
  return faker.number.int({ min, max })
}

const sentences = new Array(10000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)))

const generateColumns = (count: number) => {
  return new Array(count).fill(0).map((_, i) => {
    const key: string = i.toString()
    return {
      key,
      name: `Column ${i}`,
      width: randomNumber(75, 300),
    }
  })
}

const generateData = (columns: Column[], count = 300) => {
  return new Array(count).fill(0).map((_, rowIndex) =>
    columns.reduce<string[]>((acc, _curr, colIndex) => {
      // simulate dynamic size cells
      const val = faker.lorem.lines(((rowIndex + colIndex) % 10) + 1)

      acc.push(val)

      return acc
    }, []),
  )
}

@customElement('row-virtualizer-dynamic')
class RowVirtualizerDynamic extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: sentences.length,
      estimateSize: () => 45,
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const virtualRows = virtualizer.getVirtualItems()
    const count = sentences.length

    return html`
      <div>
        <button @click=${() => virtualizer.scrollToIndex(0)}>
          scroll to the top
        </button>
        <button @click=${() => virtualizer.scrollToIndex(count / 2)}>
          scroll to the middle
        </button>
        <button @click=${() => virtualizer.scrollToIndex(count - 1)}>
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
                      <div>${sentences[virtualRow.index]}</div>
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
          height: 400px;
          width: 400px;
          overflow-y: auto;
        }
      </style>
    `
  }
}

@customElement('column-virtualizer-dynamic')
class ColumnVirtualizerDynamic extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: sentences.length,
      estimateSize: () => 45,
      horizontal: true,
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const virtualColumns = virtualizer.getVirtualItems()

    return html`
      <div>
        <div class="list scroll-container" ${ref(this.scrollElementRef)}>
          <div
            style="position: relative; width: ${virtualizer.getTotalSize()}px; height: 100%;"
          >
            ${repeat(
              virtualColumns,
              (virtualColumn) => virtualColumn.key,
              (virtualColumn) => html`
                <div
                  data-index="${virtualColumn.index}"
                  style="position:absolute;top:0;left:0;height:100%;transform:translateX(${virtualColumn.start}px)"
                  ${ref(virtualizer.measureElement)}
                  class="${virtualColumn.index % 2 === 0
                    ? 'list-item-even'
                    : 'list-item-odd'}"
                >
                  <div style="width:${sentences[virtualColumn.index].length}px">
                    <div>Column ${virtualColumn.index}</div>
                    <div>${sentences[virtualColumn.index]}</div>
                  </div>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
      <style>
        *,
        *:before,
        *:after {
          box-sizing: border-box;
        }
        .list {
          border: 1px solid #e6e4dc;
          max-width: 100%;
        }

        .list-item-even {
          background-color: #e6e4dc;
        }

        .scroll-container {
          height: 400px;
          width: 400px;
          overflow-y: auto;
        }
      </style>
    `
  }
}

@customElement('grid-virtualizer-dynamic')
class GridVirtualizerDynamic extends LitElement {
  @property()
  private data: string[][]

  @property()
  private columns: Column[]

  private parentElementRef: Ref<HTMLDivElement> = createRef()
  private virtualizerController: WindowVirtualizerController<Element>

  private columnVirtualizerController: VirtualizerController<
    HTMLDivElement,
    Element
  >

  private getColumnWidth(index: number) {
    return this.columns[index].width
  }

  connectedCallback() {
    this.columnVirtualizerController = new VirtualizerController(this, {
      horizontal: true,
      count: this.columns.length,
      getScrollElement: () => this.parentElementRef.value,
      estimateSize: (index) => this.getColumnWidth(index),
      overscan: 5,
    })
    this.virtualizerController = new WindowVirtualizerController(this, {
      count: this.data.length,
      estimateSize: () => 350,
      overscan: 5,
    })
    super.connectedCallback()
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const columnVirtualizer = this.columnVirtualizerController.getVirtualizer()
    const columnItems = columnVirtualizer.getVirtualItems()
    const [before, after] =
      columnItems.length > 0
        ? [
            columnItems[0].start,
            columnVirtualizer.getTotalSize() -
              columnItems[columnItems.length - 1].end,
          ]
        : [0, 0]

    return html`
      <div
        ${ref(this.parentElementRef)}
        style="overflow-y: auto;border: 1px solid #c8c8c8"
      >
        <div
          style="position: relative; height: ${virtualizer.getTotalSize()}px"
        >
          ${repeat(
            virtualizer.getVirtualItems(),
            (row) => row.key,
            (row) => html`
              <div
                data-index="${row.index}"
                ${ref(virtualizer.measureElement)}
                style="position:absolute;top:0;left:0;transform:translateY(${row.start -
                virtualizer.options.scrollMargin}px);display:flex"
              >
                <div style="width:${before}px"></div>
                ${columnItems.map(
                  (column) =>
                    html`<div
                      style="width: ${this.getColumnWidth(
                        column.index,
                      )}px;border-bottom: 1px solid #c8c8c8;border-right: 1px solid #c8c8c8; padding: 7px 12px;min-height: ${row.index ===
                      0
                        ? '50px'
                        : `100px`}"
                    >
                      ${row.index === 0
                        ? html`<div>${this.columns[column.index].name}</div>`
                        : html`<div>
                            ${this.data[row.index][column.index]}
                          </div>`}
                    </div>`,
                )}
                <div style="width:${after}px"></div>
              </div>
            `,
          )}
        </div>
      </div>
      <style></style>
    `
  }
}

@customElement('my-app')
export class MyApp extends LitElement {
  protected render() {
    const { pathname } = window.location

    return html`
      <div>
        <p>
          These components are using <strong>dynamic</strong> sizes. This means
          that each element's exact dimensions are unknown when rendered. An
          estimated dimension is used as the initial measurement, then this
          measurement is readjusted on the fly as each element is rendered.
        </p>
        <nav>
          <ul>
            <li>
              <a href="/">List</a>
            </li>
            <li>
              <a href="/window-list">List - window as scroller</a>
            </li>
            <li>
              <a href="/columns">Column</a>
            </li>
            <li>
              <a href="/grid">Grid</a>
            </li>
          </ul>
        </nav>

        ${(() => {
          switch (pathname) {
            case '/':
              return html`<row-virtualizer-dynamic></row-virtualizer-dynamic>`
            case '/columns':
              return html`<column-virtualizer-dynamic></column-virtualizer-dynamic>`
            case '/grid': {
              const columns = generateColumns(30)
              const data = generateData(columns)
              return html`<grid-virtualizer-dynamic
                .columns="${columns}"
                .data="${data}"
              ></grid-virtualizer-dynamic>`
            }
            default:
              return html`<div>Not found</div>`
          }
        })()}
      </div>
    `
  }
}
