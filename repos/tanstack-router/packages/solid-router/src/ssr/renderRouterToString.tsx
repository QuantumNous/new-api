import * as Solid from 'solid-js/web'
import { makeSsrSerovalPlugin } from '@tanstack/router-core'
import type { AnyRouter } from '@tanstack/router-core'
import type { JSXElement } from 'solid-js'

export const renderRouterToString = ({
  router,
  responseHeaders,
  children,
}: {
  router: AnyRouter
  responseHeaders: Headers
  children: () => JSXElement
}) => {
  try {
    const serializationAdapters =
      (router.options as any)?.serializationAdapters ||
      (router.options.ssr as any)?.serializationAdapters
    const serovalPlugins = serializationAdapters?.map((adapter: any) => {
      const plugin = makeSsrSerovalPlugin(adapter, { didRun: false })
      return plugin
    })

    let html = Solid.renderToString(children, {
      nonce: router.options.ssr?.nonce,
      plugins: serovalPlugins,
    } as any)
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
