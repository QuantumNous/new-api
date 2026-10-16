import React from 'react'
import { Table } from '@tanstack/react-table'

import useLocalStorage from './useLocalStorage'
import { useIsMounted } from './utils'

import { Panel, Button } from './styledComponents'
import { ThemeProvider, defaultTheme as theme } from './theme'
// import { getQueryStatusLabel, getQueryStatusColor } from './utils'
import Explorer from './Explorer'
import Logo from './Logo'

interface DevtoolsOptions {
  /**
   * The react table to attach the devtools to.
   */
  table: any
  /**
   * Set this true if you want the dev tools to default to being open
   */
  initialIsOpen?: boolean
  /**
   * Use this to add props to the panel. For example, you can add className, style (merge and override default style), etc.
   */
  panelProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >
  /**
   * Use this to add props to the close button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  closeButtonProps?: React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
  /**
   * Use this to add props to the toggle button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  toggleButtonProps?: React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
  /**
   * Use this to render the devtools inside a different type of container element for a11y purposes.
   * Any string which corresponds to a valid intrinsic JSX element is allowed.
   * Defaults to 'footer'.
   */
  containerElement?: string | any
}

interface DevtoolsPanelOptions {
  /**
   * The react table to attach the devtools to.
   */
  table: any
  /**
   * The standard React style object used to style a component with inline styles
   */
  style?: React.CSSProperties
  /**
   * The standard React className property used to style a component with classes
   */
  className?: string
  /**
   * A boolean variable indicating whether the panel is open or closed
   */
  isOpen?: boolean
  /**
   * A function that toggles the open and close state of the panel
   */
  setIsOpen: (isOpen: boolean) => void
}

export function ReactTableDevtools({
  initialIsOpen,
  table,
  panelProps = {},
  toggleButtonProps = {},
  containerElement: Container = 'footer',
}: DevtoolsOptions): React.ReactElement | null {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useLocalStorage(
    'reactTableDevtoolsOpen',
    initialIsOpen
  )
  const isMounted = useIsMounted()

  const { style: panelStyle = {}, ...otherPanelProps } = panelProps

  const {
    style: toggleButtonStyle = {},
    onClick: onToggleClick,
    ...otherToggleButtonProps
  } = toggleButtonProps

  // Do not render on the server
  if (!isMounted()) return null

  return (
    <Container ref={rootRef} className="ReactTableDevtools">
      <ThemeProvider theme={theme}>
        {!isOpen ? (
          <button
            type="button"
            {...otherToggleButtonProps}
            aria-label="Open React Table Devtools"
            onClick={e => {
              setIsOpen(true)
              onToggleClick && onToggleClick(e)
            }}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              margin: '.5rem',
              display: 'inline-flex',
              fontSize: '1.5em',
              cursor: 'pointer',
              width: 'fit-content',
              ...toggleButtonStyle,
            }}
          >
            <Logo aria-hidden />
          </button>
        ) : (
          <ReactTableDevtoolsPanel
            ref={panelRef as any}
            {...otherPanelProps}
            table={table}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            style={{
              maxHeight: '80vh',
              width: '100%',
              ...panelStyle,
            }}
          />
        )}
      </ThemeProvider>
    </Container>
  )
}

export const ReactTableDevtoolsPanel = React.forwardRef<
  HTMLDivElement,
  DevtoolsPanelOptions
>(function ReactTableDevtoolsPanel(props, ref): React.ReactElement {
  const {
    table,
    isOpen = true,
    setIsOpen,
    ...panelProps
  } = props as DevtoolsPanelOptions & {
    table: Table<any>
  }

  // const [activeMatchId, setActiveRouteId] = useLocalStorage(
  //   'reactTableDevtoolsActiveRouteId',
  //   '',
  // )

  return (
    <ThemeProvider theme={theme}>
      <Panel ref={ref} className="ReactTableDevtoolsPanel" {...panelProps}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .ReactTableDevtoolsPanel * {
              scrollbar-color: ${theme.backgroundAlt} ${theme.gray};
            }

            .ReactTableDevtoolsPanel *::-webkit-scrollbar, .ReactTableDevtoolsPanel scrollbar {
              width: 1em;
              height: 1em;
            }

            .ReactTableDevtoolsPanel *::-webkit-scrollbar-track, .ReactTableDevtoolsPanel scrollbar-track {
              background: ${theme.backgroundAlt};
            }

            .ReactTableDevtoolsPanel *::-webkit-scrollbar-thumb, .ReactTableDevtoolsPanel scrollbar-thumb {
              background: ${theme.gray};
              border-radius: .5em;
              border: 3px solid ${theme.backgroundAlt};
            }
          `,
          }}
        />
        <div
          style={{
            flex: '1 1 500px',
            minHeight: '40%',
            maxHeight: '100%',
            overflow: 'auto',
            borderRight: `1px solid ${theme.grayAlt}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '.5em',
              background: theme.backgroundAlt,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Logo
              aria-hidden
              style={{
                marginRight: '.5em',
              }}
              onClick={() => setIsOpen(false)}
            />
            <div
              style={{
                marginRight: 'auto',
                fontSize: 'clamp(.8rem, 2vw, 1.3rem)',
                fontWeight: 'bold',
              }}
            >
              React Table{' '}
              <span
                style={{
                  fontWeight: 100,
                }}
              >
                Devtools
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isOpen ? (
                <Button
                  type="button"
                  aria-label="Close React Table Devtools"
                  onClick={() => {
                    setIsOpen(false)
                  }}
                >
                  Close
                </Button>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              overflowY: 'auto',
              flex: '1',
            }}
          >
            <div
              style={{
                flex: '1 1 auto',
                padding: '.5em',
              }}
            >
              <Explorer
                label="Instance"
                value={table}
                defaultExpanded={false}
              />
              <div
                style={{
                  height: '.5rem',
                }}
              />
              <Explorer
                label="State"
                value={table.getState()}
                defaultExpanded={false}
              />
              <div
                style={{
                  height: '.5rem',
                }}
              />
              <Explorer
                label="Columns"
                value={table.getAllColumns()}
                defaultExpanded={false}
              />
            </div>
            <div
              style={{
                flex: '1 1 auto',
                padding: '.5em',
              }}
            >
              <Explorer
                label="Core Model"
                value={table.getCoreRowModel()}
                defaultExpanded={false}
              />
              <Explorer
                label="Filtered Model"
                value={table.getFilteredRowModel()}
                defaultExpanded={false}
              />
              <Explorer
                label="Sorted Model"
                value={table.getSortedRowModel()}
                defaultExpanded={false}
              />
              <Explorer
                label="Grouped Model"
                value={table.getGroupedRowModel()}
                defaultExpanded={false}
              />
              <Explorer
                label="Expanded Model"
                value={table.getExpandedRowModel()}
                defaultExpanded={false}
              />
            </div>
            {/* <div
              style={{
                flex: '1 1 auto',
                padding: '.5em',
              }}
            >
              <Explorer
                label="Row Model"
                value={table.getRowModel()}
                defaultExpanded={false}
              />
            </div> */}
          </div>
        </div>
      </Panel>
    </ThemeProvider>
  )
})
