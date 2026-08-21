import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
// Import the component from a separate file so vite-plugin-rsc's CSS transform
// can properly wrap it (without interference from server function splitting)
import { CssModulesContent } from './CssModulesContent'

// ============================================================================
// Server function that returns the CSS Modules server component
// ============================================================================

export const getCssModulesServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { title?: string }) => data)
  .handler(async ({ data }) => {
    return renderServerComponent(
      <>
        <CssModulesContent data={data} />
      </>,
    )
  })
