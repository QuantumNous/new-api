import { Link, Outlet, createRootRoute, redirect } from '@tanstack/solid-router'
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

      <div class="p-2">
        <Outlet />
      </div>
    </>
  ),
})
