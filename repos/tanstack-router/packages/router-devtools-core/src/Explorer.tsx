/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { clsx as cx } from 'clsx'
import * as goober from 'goober'
import { createMemo, createSignal, useContext } from 'solid-js'
import { tokens } from './tokens'
import {
  displayValue,
  getServerComponentSlotUsageSummary,
  getServerComponentSlots,
  getServerComponentType,
} from './utils'
import { ShadowDomTargetContext } from './context'
import type { Accessor, JSX } from 'solid-js'

type ExpanderProps = {
  expanded: boolean
  style?: JSX.CSSProperties
}

export const Expander = ({ expanded, style: _style = {} }: ExpanderProps) => {
  const styles = useStyles()
  return (
    <span class={styles().expander}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        fill="none"
        viewBox="0 0 24 24"
        class={cx(styles().expanderIcon(expanded))}
      >
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 18l6-6-6-6"
        ></path>
      </svg>
    </span>
  )
}

type Entry = {
  label: string
}

type RendererProps = {
  handleEntry: HandleEntryFn
  label?: JSX.Element
  value: Accessor<unknown>
  subEntries: Array<Entry>
  subEntryPages: Array<Array<Entry>>
  type: string
  expanded: Accessor<boolean>
  toggleExpanded: () => void
  pageSize: number
  filterSubEntries?: (subEntries: Array<Property>) => Array<Property>
}

/**
 * Chunk elements in the array by size
 *
 * when the array cannot be chunked evenly by size, the last chunk will be
 * filled with the remaining elements
 *
 * @example
 * chunkArray(['a','b', 'c', 'd', 'e'], 2) // returns [['a','b'], ['c', 'd'], ['e']]
 */
export function chunkArray<T>(array: Array<T>, size: number): Array<Array<T>> {
  if (size < 1) return []
  let i = 0
  const result: Array<Array<T>> = []
  while (i < array.length) {
    result.push(array.slice(i, i + size))
    i = i + size
  }
  return result
}

type HandleEntryFn = (entry: Entry) => JSX.Element

type ExplorerProps = Partial<RendererProps> & {
  defaultExpanded?: true | Record<string, boolean>
  value: Accessor<unknown>
}

type Property = {
  defaultExpanded?: boolean | Record<string, boolean>
  label: string
  value: unknown
}

function isIterable(x: any): x is Iterable<unknown> {
  return Symbol.iterator in x
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function Explorer({
  value,
  defaultExpanded,
  pageSize = 100,
  filterSubEntries,
  ...rest
}: ExplorerProps) {
  const [expanded, setExpanded] = createSignal(Boolean(defaultExpanded))
  const toggleExpanded = () => setExpanded((old) => !old)

  const type = createMemo(() => typeof value())
  const subEntries = createMemo(() => {
    let entries: Array<Property> = []

    const makeProperty = (sub: { label: string; value: unknown }): Property => {
      const subDefaultExpanded =
        defaultExpanded === true
          ? { [sub.label]: true }
          : defaultExpanded?.[sub.label]
      return {
        ...sub,
        value: () => sub.value,
        defaultExpanded: subDefaultExpanded,
      }
    }

    if (
      Array.isArray(value()) &&
      (value() as Array<any>).length === 2 &&
      (value() as Array<any>)[0] === 'React element' &&
      isPlainObject((value() as Array<any>)[1])
    ) {
      // Special case: treat `["React element", { ...meta }]` as sibling entries
      // to avoid the meta object being rendered as a deeper nested tree.
      const v = value() as ['React element', Record<string, unknown>]
      entries = [
        makeProperty({ label: '0', value: v[0] }),
        ...Object.entries(v[1]).map(([key, val]) =>
          makeProperty({ label: key, value: val }),
        ),
      ]
    } else if (Array.isArray(value())) {
      // any[]
      entries = (value() as Array<any>).map((d, i) =>
        makeProperty({
          label: i.toString(),
          value: d,
        }),
      )
    } else if (
      value() !== null &&
      typeof value() === 'object' &&
      isIterable(value()) &&
      typeof (value() as Iterable<unknown>)[Symbol.iterator] === 'function'
    ) {
      // Iterable<unknown>
      entries = Array.from(value() as Iterable<unknown>, (val, i) =>
        makeProperty({
          label: i.toString(),
          value: val,
        }),
      )
    } else if (typeof value() === 'object' && value() !== null) {
      // object
      entries = Object.entries(value() as object).map(([key, val]) =>
        makeProperty({
          label: key,
          value: val,
        }),
      )
    }

    return filterSubEntries ? filterSubEntries(entries) : entries
  })

  const subEntryPages = createMemo(() => chunkArray(subEntries(), pageSize))

  const [expandedPages, setExpandedPages] = createSignal<Array<number>>([])
  const [valueSnapshot, setValueSnapshot] = createSignal(undefined)
  const styles = useStyles()

  const refreshValueSnapshot = () => {
    setValueSnapshot((value() as () => any)())
  }

  const handleEntry = (entry: Entry) => (
    <Explorer
      value={value}
      filterSubEntries={filterSubEntries}
      {...rest}
      {...entry}
    />
  )

  const serverComponentType = createMemo(() => getServerComponentType(value()))
  const serverComponentSlots = createMemo(() =>
    getServerComponentSlots(value()),
  )
  const serverComponentSlotUsageSummary = createMemo(() =>
    getServerComponentSlotUsageSummary(value()),
  )

  const isCompositeWithSlots = createMemo(
    () =>
      serverComponentType() === 'compositeSource' &&
      serverComponentSlots().length > 0,
  )

  return (
    <div class={styles().entry}>
      {serverComponentType() !== null ? (
        isCompositeWithSlots() ? (
          <>
            <button
              class={styles().expandButton}
              onClick={() => toggleExpanded()}
            >
              <Expander expanded={expanded() ?? false} />
              <span>{rest.label}:</span>
              <span class={styles().compositeComponent}>
                {displayValue(value())}
              </span>
            </button>
            {(expanded() ?? false) ? (
              <div class={styles().rscMetaRow}>
                <span class={styles().rscMetaLabel}>slots</span>
                <div class={styles().subEntries}>
                  {serverComponentSlots().map((name) => {
                    const usage = serverComponentSlotUsageSummary()[name]
                    if (!usage) return null
                    return (
                      <Explorer
                        label={`${name}:`}
                        value={() =>
                          usage.invocations.map((args) =>
                            args.length === 1 ? args[0] : args,
                          )
                        }
                      />
                    )
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span>{rest.label}:</span>{' '}
            <span
              class={
                serverComponentType() === 'compositeSource'
                  ? styles().compositeComponent
                  : styles().renderableComponent
              }
            >
              {displayValue(value())}
            </span>
          </>
        )
      ) : subEntryPages().length ? (
        <>
          <button
            class={styles().expandButton}
            onClick={() => toggleExpanded()}
          >
            <Expander expanded={expanded() ?? false} />
            {rest.label}
            <span class={styles().info}>
              {String(type).toLowerCase() === 'iterable' ? '(Iterable) ' : ''}
              {subEntries().length} {subEntries().length > 1 ? `items` : `item`}
            </span>
          </button>
          {(expanded() ?? false) ? (
            subEntryPages().length === 1 ? (
              <div class={styles().subEntries}>
                {subEntries().map((entry, index) => handleEntry(entry))}
              </div>
            ) : (
              <div class={styles().subEntries}>
                {subEntryPages().map((entries, index) => {
                  return (
                    <div>
                      <div class={styles().entry}>
                        <button
                          class={cx(styles().labelButton, 'labelButton')}
                          onClick={() =>
                            setExpandedPages((old) =>
                              old.includes(index)
                                ? old.filter((d) => d !== index)
                                : [...old, index],
                            )
                          }
                        >
                          <Expander
                            expanded={expandedPages().includes(index)}
                          />{' '}
                          [{index * pageSize} ...{' '}
                          {index * pageSize + pageSize - 1}]
                        </button>
                        {expandedPages().includes(index) ? (
                          <div class={styles().subEntries}>
                            {entries.map((entry) => handleEntry(entry))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : null}
        </>
      ) : type() === 'function' ? (
        <>
          <Explorer
            label={
              <button
                onClick={refreshValueSnapshot}
                class={styles().refreshValueBtn}
              >
                <span>{rest.label}</span> 🔄{' '}
              </button>
            }
            value={valueSnapshot}
            defaultExpanded={{}}
          />
        </>
      ) : (
        <>
          <span>{rest.label}:</span>{' '}
          <span class={styles().value}>{displayValue(value())}</span>
        </>
      )}
    </div>
  )
}

const stylesFactory = (shadowDOMTarget?: ShadowRoot) => {
  const { colors, font, size, border } = tokens
  const { fontFamily, lineHeight, size: fontSize } = font
  const css = shadowDOMTarget
    ? goober.css.bind({ target: shadowDOMTarget })
    : goober.css

  return {
    entry: css`
      font-family: ${fontFamily.mono};
      font-size: ${fontSize.xs};
      line-height: ${lineHeight.sm};
      outline: none;
      word-break: break-word;
    `,
    labelButton: css`
      cursor: pointer;
      color: inherit;
      font: inherit;
      outline: inherit;
      background: transparent;
      border: none;
      padding: 0;
    `,
    expander: css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${size[3]};
      height: ${size[3]};
      padding-left: 3px;
      box-sizing: content-box;
    `,
    expanderIcon: (expanded: boolean) => {
      if (expanded) {
        return css`
          transform: rotate(90deg);
          transition: transform 0.1s ease;
        `
      }
      return css`
        transform: rotate(0deg);
        transition: transform 0.1s ease;
      `
    },
    expandButton: css`
      display: flex;
      gap: ${size[1]};
      align-items: center;
      cursor: pointer;
      color: inherit;
      font: inherit;
      outline: inherit;
      background: transparent;
      border: none;
      padding: 0;
    `,
    value: css`
      color: ${colors.purple[400]};
    `,
    compositeComponent: css`
      display: inline-flex;
      align-items: center;
      padding: 1px ${size[1]};
      border-radius: ${border.radius.full};
      border: 1px solid ${colors.darkGray[500]};
      background: ${colors.darkGray[700]};
      color: ${colors.cyan[300]};
      font-style: normal;
      font-weight: ${font.weight.medium};
    `,
    renderableComponent: css`
      display: inline-flex;
      align-items: center;
      padding: 1px ${size[1]};
      border-radius: ${border.radius.full};
      border: 1px solid ${colors.darkGray[500]};
      background: ${colors.darkGray[700]};
      color: ${colors.teal[300]};
      font-style: normal;
      font-weight: ${font.weight.medium};
    `,
    rscMetaRow: css`
      display: flex;
      gap: ${size[1]};
      align-items: flex-start;
      margin-left: calc(${size[3]} + ${size[1]});
      margin-top: ${size[0.5]};
      flex-wrap: wrap;
    `,
    rscMetaLabel: css`
      color: ${colors.gray[500]};
      font-size: ${fontSize['2xs']};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding-top: 2px;
    `,
    rscChipRow: css`
      display: flex;
      gap: ${size[1]};
      flex-wrap: wrap;
    `,
    rscChip: css`
      display: inline-flex;
      align-items: center;
      gap: ${size[0.5]};
      padding: 1px ${size[1]};
      border-radius: ${border.radius.full};
      border: 1px solid ${colors.darkGray[500]};
      background: ${colors.darkGray[800]};
      color: ${colors.gray[200]};
      font-size: ${fontSize['2xs']};
      line-height: ${lineHeight.xs};
    `,
    rscChipName: css`
      color: ${colors.gray[100]};
    `,
    rscChipMeta: css`
      color: ${colors.gray[400]};
      font-size: ${fontSize['2xs']};
    `,
    subEntries: css`
      margin-left: ${size[2]};
      padding-left: ${size[2]};
      border-left: 2px solid ${colors.darkGray[400]};
    `,
    info: css`
      color: ${colors.gray[500]};
      font-size: ${fontSize['2xs']};
      padding-left: ${size[1]};
    `,
    refreshValueBtn: css`
      appearance: none;
      border: 0;
      cursor: pointer;
      background: transparent;
      color: inherit;
      padding: 0;
      font-family: ${fontFamily.mono};
      font-size: ${fontSize.xs};
    `,
  }
}

function useStyles() {
  const shadowDomTarget = useContext(ShadowDomTargetContext)
  const [_styles] = createSignal(stylesFactory(shadowDomTarget))
  return _styles
}
