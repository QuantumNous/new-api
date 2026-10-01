import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
import { clientStyles, formatTime, pageStyles } from '~/utils/styles'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

// ============================================================================
// SSR: false - Drawing Canvas with localStorage Persistence
// Both the loader AND the component run on the client only.
// This is useful when you need browser-only APIs in both loader and component.
// ============================================================================

const getDrawingToolsServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { savedDrawingName?: string; lastColor?: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Drawing tools configuration from server
    const tools = {
      brushSizes: [2, 5, 10, 20],
      colors: [
        { name: 'Black', value: '#1e293b' },
        { name: 'Blue', value: '#0284c7' },
        { name: 'Green', value: '#16a34a' },
        { name: 'Red', value: '#dc2626' },
        { name: 'Purple', value: '#9333ea' },
      ],
      canvasSize: { width: 400, height: 200 },
    }

    // Create RSC for the toolbar with a slot for the canvas
    const DrawingToolbar = await createCompositeComponent(
      (props: {
        renderCanvas?: () => React.ReactNode
        children?: React.ReactNode
      }) => {
        return (
          <div style={serverBox} data-testid="rsc-ssr-false-content">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER TOOLS CONFIG</span>
              <span style={timestamp} data-testid="rsc-server-timestamp">
                Loaded: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>

            <h2
              style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
              data-testid="rsc-drawing-title"
            >
              Drawing Canvas
            </h2>

            <p
              style={{
                margin: '0 0 12px 0',
                color: '#64748b',
                fontSize: '14px',
              }}
            >
              Tools configuration fetched from server. Canvas and localStorage
              handled on client.
            </p>

            {data.savedDrawingName && (
              <div
                data-testid="rsc-saved-name"
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#0369a1',
                }}
              >
                Loaded drawing: <strong>{data.savedDrawingName}</strong>
              </div>
            )}

            {data.lastColor && (
              <div
                data-testid="rsc-last-color"
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Last used color:
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: data.lastColor,
                    borderRadius: '4px',
                    border: '1px solid #bae6fd',
                  }}
                />
                <strong>{data.lastColor}</strong>
              </div>
            )}

            {/* Tool palette info (server-rendered) */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Available Brushes
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                  data-testid="brush-count"
                >
                  {tools.brushSizes.length} sizes
                </div>
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Color Palette
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                  data-testid="color-count"
                >
                  {tools.colors.length} colors
                </div>
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Canvas Size
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                  data-testid="canvas-size"
                >
                  {tools.canvasSize.width}x{tools.canvasSize.height}
                </div>
              </div>
            </div>

            {/* Canvas slot (client-rendered) */}
            <div
              style={{
                borderTop: '1px solid #bae6fd',
                paddingTop: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#0369a1',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                DRAWING AREA (Client Rendered with Canvas API)
              </div>
              {props.renderCanvas?.()}
            </div>

            {/* Children slot for additional controls */}
            {props.children && (
              <div
                style={{
                  borderTop: '1px solid #bae6fd',
                  paddingTop: '16px',
                  marginTop: '16px',
                }}
                data-testid="rsc-children-slot"
              >
                {props.children}
              </div>
            )}
          </div>
        )
      },
    )

    return {
      DrawingToolbar,
      tools,
      serverTimestamp,
      savedDrawingName: data.savedDrawingName,
    }
  })

export const Route = createFileRoute('/rsc-ssr-false')({
  ssr: false,
  loader: async () => {
    // Read from localStorage - only available on client
    // Since ssr: false, this loader runs on client only
    const savedDrawingName = localStorage.getItem('drawing-name') || undefined
    const lastColor = localStorage.getItem('drawing-last-color') || undefined
    const savedStrokeCount = localStorage.getItem('drawing-stroke-count')
    const hasSavedDrawing = !!localStorage.getItem('drawing-canvas-data')

    const bundle = await getDrawingToolsServerComponent({
      data: { savedDrawingName, lastColor },
    })

    return {
      ...bundle,
      lastColor,
      savedStrokeCount: savedStrokeCount ? parseInt(savedStrokeCount, 10) : 0,
      hasSavedDrawing,
      loaderTimestamp: Date.now(),
    }
  },
  pendingComponent: () => (
    <div style={pageStyles.container}>
      <div
        data-testid="pending-component"
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#fef3c7',
          border: '2px dashed #f59e0b',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>🎨</div>
        <div style={{ color: '#92400e', fontWeight: 'bold' }}>
          Setting up Drawing Canvas...
        </div>
        <div style={{ color: '#b45309', fontSize: '13px', marginTop: '8px' }}>
          Loading tools and restoring your saved drawing...
        </div>
      </div>
    </div>
  ),
  component: RscSsrFalseComponent,
})

function RscSsrFalseComponent() {
  const {
    DrawingToolbar,
    tools,
    serverTimestamp,
    loaderTimestamp,
    savedDrawingName,
    lastColor,
    savedStrokeCount,
    hasSavedDrawing,
  } = Route.useLoaderData()

  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const hasMounted = React.useRef(false)
  const isDrawingRef = React.useRef(false)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [brushSize, setBrushSize] = React.useState(tools.brushSizes[1])
  // Initialize color from localStorage if available, otherwise use default
  const [color, setColor] = React.useState(lastColor || tools.colors[0].value)
  const [drawingName, setDrawingName] = React.useState(
    savedDrawingName || 'Untitled',
  )
  // Initialize stroke count from localStorage
  const [strokeCount, setStrokeCount] = React.useState(savedStrokeCount)
  // Initialize based on whether there was saved drawing data
  const [hasRestoredDrawing, setHasRestoredDrawing] =
    React.useState(hasSavedDrawing)

  // Initialize canvas and restore saved drawing
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mark as mounted at the start of the effect
    hasMounted.current = true

    // Set white background first
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Try to restore saved drawing from localStorage
    const savedDrawingData = localStorage.getItem('drawing-canvas-data')
    if (savedDrawingData) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
      img.src = savedDrawingData
    }
  }, [])

  // Save color to localStorage when it changes (but not on initial mount)
  React.useEffect(() => {
    if (hasMounted.current) {
      localStorage.setItem('drawing-last-color', color)
    }
  }, [color])

  // Helper to save canvas to localStorage
  const saveCanvasToStorage = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const dataUrl = canvas.toDataURL('image/png')
      localStorage.setItem('drawing-canvas-data', dataUrl)
    } catch {
      // Canvas might be tainted or localStorage full
      console.warn('Could not save canvas to localStorage')
    }
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    isDrawingRef.current = true
    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false
      setStrokeCount((c) => {
        const newCount = c + 1
        // Save stroke count to localStorage
        localStorage.setItem('drawing-stroke-count', String(newCount))
        return newCount
      })
      // Auto-save drawing after each stroke
      saveCanvasToStorage()
    }
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setStrokeCount(0)
    setHasRestoredDrawing(false)
    // Clear saved drawing and stroke count from localStorage
    localStorage.removeItem('drawing-canvas-data')
    localStorage.removeItem('drawing-stroke-count')
  }

  const saveDrawing = () => {
    localStorage.setItem('drawing-name', drawingName)
    setDrawingName(drawingName)
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-ssr-false-title" style={pageStyles.title}>
        Drawing Canvas (SSR: false)
      </h1>
      <p style={pageStyles.description}>
        This example uses <code>ssr: false</code> - both the loader AND the
        route component run on the client only. The loader reads from{' '}
        <code>localStorage</code> to get your saved drawing name and last color,
        then passes this data to the server function which returns the RSC with
        that info embedded. Your drawing is auto-saved after each stroke - all
        using browser APIs not available during SSR.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        <span data-testid="server-timestamp-hidden" style={{ display: 'none' }}>
          {serverTimestamp}
        </span>
        Tools loaded at: {formatTime(serverTimestamp)}
      </div>

      <CompositeComponent
        src={DrawingToolbar}
        renderCanvas={() => (
          <div style={clientStyles.container} data-testid="canvas-container">
            <div style={clientStyles.header}>
              <span style={clientStyles.badge}>CLIENT CANVAS</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Strokes: {strokeCount}
                {hasRestoredDrawing && (
                  <span
                    data-testid="restored-indicator"
                    style={{ marginLeft: '8px', color: '#16a34a' }}
                  >
                    (Restored from localStorage)
                  </span>
                )}
              </span>
            </div>

            {/* Tool controls */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '12px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {/* Brush size selector */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#166534',
                    marginBottom: '4px',
                  }}
                >
                  Brush Size
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {tools.brushSizes.map((size) => (
                    <button
                      key={size}
                      data-testid={`brush-${size}`}
                      onClick={() => setBrushSize(size)}
                      style={{
                        width: '32px',
                        height: '32px',
                        border:
                          brushSize === size
                            ? '2px solid #16a34a'
                            : '1px solid #bbf7d0',
                        borderRadius: '4px',
                        backgroundColor:
                          brushSize === size ? '#dcfce7' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: `${Math.min(size, 20)}px`,
                          height: `${Math.min(size, 20)}px`,
                          backgroundColor: '#1e293b',
                          borderRadius: '50%',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#166534',
                    marginBottom: '4px',
                  }}
                >
                  Color
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {tools.colors.map((c) => (
                    <button
                      key={c.value}
                      data-testid={`color-${c.name.toLowerCase()}`}
                      onClick={() => setColor(c.value)}
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: c.value,
                        border:
                          color === c.value
                            ? '3px solid #16a34a'
                            : '1px solid #e2e8f0',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              data-testid="drawing-canvas"
              width={tools.canvasSize.width}
              height={tools.canvasSize.height}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{
                border: '2px solid #16a34a',
                borderRadius: '8px',
                cursor: 'crosshair',
                backgroundColor: 'white',
              }}
            />

            {/* Canvas actions */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                data-testid="clear-canvas-btn"
                onClick={clearCanvas}
                style={{
                  ...clientStyles.button,
                  ...clientStyles.secondaryButton,
                }}
              >
                Clear Canvas
              </button>
            </div>
          </div>
        )}
      >
        {/* Save controls in children slot */}
        <div style={clientStyles.container} data-testid="save-controls">
          <div style={clientStyles.header}>
            <span style={clientStyles.badge}>LOCALSTORAGE PERSISTENCE</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              data-testid="drawing-name-input"
              type="text"
              value={drawingName}
              onChange={(e) => setDrawingName(e.target.value)}
              placeholder="Drawing name"
              style={{
                padding: '8px 12px',
                border: '1px solid #bbf7d0',
                borderRadius: '4px',
                flex: 1,
              }}
            />
            <button
              data-testid="save-drawing-btn"
              onClick={saveDrawing}
              style={{
                ...clientStyles.button,
                ...clientStyles.primaryButton,
              }}
            >
              Save Name
            </button>
          </div>

          <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
            Current name:{' '}
            <strong data-testid="current-name">{drawingName}</strong>
            {savedDrawingName && <span> (loaded from localStorage)</span>}
          </div>
        </div>
      </CompositeComponent>

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Points:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            <code>ssr: false</code> runs both loader and route component on
            client only
          </li>
          <li>
            The loader reads <code>localStorage</code> for saved name/color,
            then passes this to the server function to fetch the RSC
          </li>
          <li>
            The RSC (blue) displays the localStorage data that was passed from
            the client loader
          </li>
          <li>
            The drawing and stroke count are auto-saved to{' '}
            <code>localStorage</code> after each stroke
          </li>
          <li>
            The route component uses Canvas API for drawing (browser-only)
          </li>
          <li>
            The pendingComponent shows while everything initializes on the
            client
          </li>
          <li>Changing colors/brushes doesn't refetch - RSC data is cached</li>
        </ul>
      </div>
    </div>
  )
}
