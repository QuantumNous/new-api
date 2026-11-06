import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import styles from '../styles.css?url'
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

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="p-2 flex gap-2 text-lg justify-between">
          <div className="flex gap-2 text-lg">
            <Link
              to="/"
              activeProps={{
                className: 'font-bold',
              }}
              activeOptions={{ exact: true }}
            >
              {m.home_page()}
            </Link>

            <Link
              to="/about"
              activeProps={{
                className: 'font-bold',
              }}
            >
              {m.about_page()}
            </Link>
          </div>

          <div className="flex gap-2 text-lg">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => setLocale(locale)}
                data-active-locale={locale === getLocale()}
                className="rounded p-1 px-2 border border-gray-300 cursor-pointer [&[data-active-locale=true]]:bg-gray-500 [&[data-active-locale=true]]:text-white"
              >
                {locale}
              </button>
            ))}
          </div>
        </div>

        <hr />

        <div className="p-2">{children}</div>

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
