import * as Vue from 'vue'
import { renderToString as vueRenderToString } from 'vue/server-renderer'
import type { AnyRouter } from '@tanstack/router-core'
import type { Component } from 'vue'

export const renderRouterToString = async ({
  router,
  responseHeaders,
  App,
}: {
  router: AnyRouter
  responseHeaders: Headers
  App: Component
}) => {
  try {
    const app = Vue.createSSRApp(App, { router })

    let html = await vueRenderToString(app)
    router.serverSsr!.setRenderFinished()

    const injectedHtml = router.serverSsr!.takeBufferedHtml()
    if (injectedHtml) {
      html = html.replace(`</body>`, () => `${injectedHtml}</body>`)
    }

    return new Response(`<!DOCTYPE html>${html}`, {
      status: router.stores.statusCode.get(),
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Render to string error:', error)
    return new Response('Internal Server Error', {
      status: 500,
      headers: responseHeaders,
    })
  } finally {
    router.serverSsr?.cleanup()
  }
}
