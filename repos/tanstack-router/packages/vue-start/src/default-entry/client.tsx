import { createSSRApp } from 'vue'
import {
  StartClient,
  configureHydrationSuppressions,
  hydrateStart,
} from '@tanstack/vue-start/client'

hydrateStart().then((router) => {
  const app = createSSRApp(StartClient, { router })
  // Suppress expected hydration mismatch warnings for routes with ssr: false or 'data-only'
  // Must be called before mount() - this uses Vue's warnHandler for dev mode warnings
  configureHydrationSuppressions(app, router)
  // Mount to #__app wrapper div for proper Vue hydration
  // The Body component creates this wrapper on the server
  app.mount('#__app')
})
