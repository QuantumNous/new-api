// DO NOT DELETE THIS FILE!!!
// This file is a good smoke test to make sure the custom client entry is working
import { createSSRApp } from 'vue'
import {
  StartClient,
  configureHydrationSuppressions,
  hydrateStart,
} from '@tanstack/vue-start/client'

console.log("[client-entry]: using custom client entry in 'src/client.tsx'")

hydrateStart().then((router) => {
  const app = createSSRApp(StartClient, { router })
  // Suppress expected hydration mismatch warnings for routes with ssr: false or 'data-only'
  // Must be called before mount() - this uses Vue's warnHandler for dev mode warnings
  configureHydrationSuppressions(app, router)
  // Mount to #__app wrapper div for proper Vue hydration
  // The Body component creates this wrapper on the server
  app.mount('#__app')
})
