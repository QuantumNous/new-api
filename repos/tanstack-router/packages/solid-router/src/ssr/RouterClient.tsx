import { hydrate } from '@tanstack/router-core/ssr/client'
import { Await } from '../awaited'
import { HeadContent } from '../HeadContent'
import { RouterProvider } from '../RouterProvider'
import type { AnyRouter } from '@tanstack/router-core'
import type { JSXElement } from 'solid-js'

let hydrationPromise: Promise<void | Array<Array<void>>> | undefined

const Dummy = (props: { children?: JSXElement }) => <>{props.children}</>

export function RouterClient(props: { router: AnyRouter }) {
  if (!hydrationPromise) {
    if (!props.router.stores.matchesId.get().length) {
      hydrationPromise = hydrate(props.router)
    } else {
      hydrationPromise = Promise.resolve()
    }
  }
  return (
    <Await
      promise={hydrationPromise}
      children={() => (
        <Dummy>
          <Dummy>
            <RouterProvider
              router={props.router}
              InnerWrap={(props) => (
                <Dummy>
                  <Dummy>
                    <HeadContent />
                    {props.children}
                  </Dummy>
                  <Dummy />
                </Dummy>
              )}
            />
          </Dummy>
        </Dummy>
      )}
    />
  )
}
