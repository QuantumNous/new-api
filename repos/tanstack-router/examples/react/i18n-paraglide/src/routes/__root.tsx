import { Link, Outlet, createRootRoute, redirect } from '@tanstack/react-router'
import {
  getLocale,
  locales,
  setLocale,
  shouldRedirect,
} from '@/paraglide/runtime'
import { m } from '@/paraglide/messages'

export const Route = createRootRoute({
  beforeLoad: async () => {
    document.documentElement.setAttribute('lang', getLocale())

    const decision = await shouldRedirect({ url: window.location.href })

    if (decision.redirectUrl) {
      throw redirect({ href: decision.redirectUrl.href })
    }
  },
  component: () => (
    <>
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

      <div className="p-2">
        <Outlet />
      </div>
    </>
  ),
})
