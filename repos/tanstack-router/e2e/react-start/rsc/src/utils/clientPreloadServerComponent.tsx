import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
// Import the component from a separate file so vite-plugin-rsc's CSS transform
// can properly wrap it (without interference from server function splitting)
import { ClientPreloadContent } from './ClientPreloadContent'

// ============================================================================
// Server function that returns the client preload server component
// ============================================================================

export const getClientPreloadServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    return renderServerComponent(<ClientPreloadContent data={data} />)
  })
