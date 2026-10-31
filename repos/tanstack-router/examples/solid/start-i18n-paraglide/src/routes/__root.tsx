import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/solid-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools'
import { TanStackDevtools } from '@tanstack/solid-devtools'
import { HydrationScript } from 'solid-js/web'
import styles from '../styles.css?url'
import type { JSX } from 'solid-js/jsx-runtime'
import { getLocale, locales, setLocale } from '@/paraglide/runtime'
import { m } from '@/paraglide/messages'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [{ rel: 'stylesheet', href: styles }],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: JSX.Element }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <div class="p-2 flex gap-2 text-lg justify-between">
          <div class="flex gap-2 text-lg">
            <Link
              to="/"
              activeProps={{
                class: 'font-bold',
              }}
              activeOptions={{ exact: true }}
            >
              {m.home_page()}
            </Link>

            <Link
              to="/about"
              activeProps={{
                class: 'font-bold',
              }}
            >
              {m.about_page()}
            </Link>
          </div>

          <div class="flex gap-2 text-lg">
            {locales.map((locale) => (
              <button
                onClick={() => setLocale(locale)}
                data-active-locale={locale === getLocale()}
                class="rounded p-1 px-2 border border-gray-300 cursor-pointer [&[data-active-locale=true]]:bg-gray-500 [&[data-active-locale=true]]:text-white"
              >
                {locale}
              </button>
            ))}
          </div>
        </div>

        <hr />

        <div class="p-2">{children}</div>

        <TanStackDevtools
          config={{
            position: 'bottom-left',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
