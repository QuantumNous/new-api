import ReactDOMServer from 'react-dom/server'
import type { ReactNode } from 'react'
import type { AnyRouter } from '@tanstack/router-core'

export const renderRouterToString = async ({
  router,
  responseHeaders,
  children,
}: {
  router: AnyRouter
  responseHeaders: Headers
  children: ReactNode
}) => {
  try {
    let html = ReactDOMServer.renderToString(children)
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
