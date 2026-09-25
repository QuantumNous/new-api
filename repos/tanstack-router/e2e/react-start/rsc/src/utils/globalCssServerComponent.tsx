import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
// Import the component from a separate file so vite-plugin-rsc's CSS transform
// can properly wrap it (without interference from server function splitting)
import { GlobalCssContent } from './GlobalCssContent'

// ============================================================================
// Server function that returns the Global CSS server component
// ============================================================================

export const getGlobalCssServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { title?: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulated server info
    const serverInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    }

    return renderServerComponent(
      <GlobalCssContent
        data={data}
        serverInfo={serverInfo}
        serverTimestamp={serverTimestamp}
      />,
    )
  })
