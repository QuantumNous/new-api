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

@customElement('row-virtualizer-fixed')
class RowVirtualizerFixed extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: 10000,
      estimateSize: () => 35,
      overscan: 5,
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const virtualRows = virtualizer.getVirtualItems()

    return html`
      <div>
        <div class="list scroll-container" ${ref(this.scrollElementRef)}>
          <div
            style="position: relative; height: ${virtualizer.getTotalSize()}px; width: 100%;"
          >
            ${repeat(
              virtualRows,
              (virtualRow) => virtualRow.key,
              (virtualRow) =>
                html` <div
                  class="${virtualRow.index % 2 === 0
                    ? 'list-item-even'
                    : 'list-item-odd'}"
                  style="position: absolute; left: 0; top: 0; width: 100%; height: ${virtualRow.size}px; transform: translateY(${virtualRow.start}px)"
                >
                  Row ${virtualRow.index}
                </div>`,
            )}
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
          height: 200px;
          width: 400px;
          overflow: auto;
        }
      </style>
    `
  }
}

@customElement('column-virtualizer-fixed')
class ColumnVirtualizerFixed extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: sentences.length,
      estimateSize: () => 100,
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
            style="position: relative; height: 100%; width: ${virtualizer.getTotalSize()}px;"
          >
            ${repeat(
              virtualColumns,
              (virtualColumn) => virtualColumn.key,
              (virtualColumn) =>
                html` <div
                  class="${virtualColumn.index % 2 === 0
                    ? 'list-item-even'
                    : 'list-item-odd'}"
                  style="position: absolute; left: 0; top: 0; height: 100%; width: ${virtualColumn.size}px; transform: translateX(${virtualColumn.start}px)"
                >
                  Column ${virtualColumn.index}
                </div>`,
            )}
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
          height: 100px;
          width: 400px;
          overflow: auto;
        }
      </style>
    `
  }
}

@customElement('grid-virtualizer-fixed')
class GridVirtualizerFixed extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private rowVirtualizerController: VirtualizerController<
    HTMLDivElement,
    Element
  >
  private columnVirtualizerController: VirtualizerController<
    HTMLDivElement,
    Element
  >

  constructor() {
    super()
    this.rowVirtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: sentences.length,
      estimateSize: () => 35,
      overscan: 5,
    })

    this.columnVirtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: sentences.length,
      estimateSize: () => 100,
      horizontal: true,
      overscan: 5,
    })
  }

  render() {
    const rowVirtualizer = this.rowVirtualizerController.getVirtualizer()
    const columnVirtualizer = this.columnVirtualizerController.getVirtualizer()

    return html`
      <div>
        <div class="list scroll-container" ${ref(this.scrollElementRef)}>
          <div
            style="position: relative; height: ${rowVirtualizer.getTotalSize()}px; width: ${columnVirtualizer.getTotalSize()}px;"
          >
            ${repeat(
              rowVirtualizer.getVirtualItems(),
              (virtualRow) => virtualRow.key,
              (virtualRow) =>
                repeat(
                  columnVirtualizer.getVirtualItems(),
                  (virtualColumn) => virtualColumn.key,
                  (virtualColumn) => html`
                    <div
                      class="${virtualColumn.index % 2
                        ? virtualRow.index % 2 === 0
                          ? 'list-item-odd'
                          : 'list-item-even'
                        : virtualRow.index % 2
                          ? 'list-item-odd'
                          : 'list-item-even'}"
                      style="position: absolute;left: 0; top: 0; width: ${virtualColumn.size}px; height: ${virtualRow.size}px; transform: translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)"
                    >
                      Cell ${virtualRow.index}, ${virtualColumn.index}
                    </div>
                  `,
                ),
            )}
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
          height: 500px;
          width: 500px;
          overflow: auto;
        }
      </style>
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
          These components are using <strong>fixed</strong> sizes. This means
          that every element's dimensions are hard-coded to the same value and
          never change.
        </p>
        <br />
        <br />

        <h3>Rows</h3>
        <row-virtualizer-fixed></row-virtualizer-fixed>
        <br />
        <br />
        <h3>Columns</h3>
        <column-virtualizer-fixed></column-virtualizer-fixed>
        <br />
        <br />
        <h3>Grid</h3>
        <grid-virtualizer-fixed></grid-virtualizer-fixed>
        <br />
        <br />
      </div>
    `
  }
}
