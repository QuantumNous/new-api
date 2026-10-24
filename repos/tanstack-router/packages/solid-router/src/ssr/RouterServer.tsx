import {
  Hydration,
  HydrationScript,
  NoHydration,
  ssr,
  useAssets,
} from 'solid-js/web'
import { MetaProvider } from '@solidjs/meta'
import { Asset } from '../Asset'
import { useTags } from '../headContentUtils'
import { RouterProvider } from '../RouterProvider'
import { Scripts } from '../Scripts'
import type { AnyRouter } from '@tanstack/router-core'

export function ServerHeadContent() {
  const tags = useTags()
  useAssets(() => {
    return (
      <MetaProvider>
        {tags().map((tag) => (
          <Asset {...tag} />
        ))}
      </MetaProvider>
    )
  })
  return null
}

const docType = ssr('<!DOCTYPE html>')

export function RouterServer<TRouter extends AnyRouter>(props: {
  router: TRouter
}) {
  return (
    <NoHydration>
      {docType as any}
      <html>
        <head>
          <HydrationScript />
        </head>
        <body>
          <Hydration>
            <RouterProvider
              router={props.router}
              InnerWrap={(props) => (
                <NoHydration>
                  <MetaProvider>
                    <ServerHeadContent />
                    <Hydration>{props.children}</Hydration>
                    <Scripts />
                  </MetaProvider>
                </NoHydration>
              )}
            />
          </Hydration>
        </body>
      </html>
    </NoHydration>
  )
}
