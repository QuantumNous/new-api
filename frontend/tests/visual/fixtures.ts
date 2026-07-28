import { expect, type Page } from '@playwright/test'

export type VisualTheme = 'light' | 'dark'

const FIXED_NOW = new Date('2026-07-27T12:00:00+08:00').getTime()

const DEMO_USER = {
  id: 1,
  username: 'ren2.demo',
  display_name: 'Ren2 Demo',
  email: 'demo@ren2hub.dev',
  role: 1,
  quota: 5_201_314,
  used_quota: 2_985_211,
  group: 'vip',
}

interface StablePageOptions {
  theme: VisualTheme
  authenticated?: boolean
  routeAwareAuth?: boolean
}

export async function configureStablePage(
  page: Page,
  { theme, authenticated = true, routeAwareAuth = false }: StablePageOptions
): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(
    ({ fixedNow, user, selectedTheme, hasSession, authByRoute }) => {
      const NativeDate = Date
      let clockTick = 0
      const nextNow = () => fixedNow + clockTick++
      const FixedDate = new Proxy(NativeDate, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [nextNow()])
        },
        apply(target, thisArg, args) {
          return Reflect.apply(
            target,
            thisArg,
            args.length ? args : [nextNow()]
          )
        },
      })
      Object.defineProperty(FixedDate, 'now', { value: nextNow })
      Object.defineProperty(window, 'Date', { value: FixedDate })

      let seed = 0x2f6e2b1
      Math.random = () => {
        seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
        return seed / 0x1_0000_0000
      }

      const guestRoute = location.pathname.startsWith('/auth/')
      const shouldAuthenticate = authByRoute ? !guestRoute : hasSession
      if (shouldAuthenticate) {
        localStorage.setItem('ren2hub_demo_user', JSON.stringify(user))
        localStorage.setItem('ren2hub_demo_uid', String(user.id))
      } else {
        localStorage.removeItem('ren2hub_demo_user')
        localStorage.removeItem('ren2hub_demo_uid')
      }
      localStorage.setItem('ren2hub_theme_mode', selectedTheme)
      localStorage.setItem('ren2hub_locale', 'zh-CN')
      localStorage.setItem('ren2hub_sidebar_collapsed', 'false')
      localStorage.setItem('ren2hub_lab_sidebar_collapsed', 'false')
      sessionStorage.clear()
    },
    {
      fixedNow: FIXED_NOW,
      user: DEMO_USER,
      selectedTheme: theme,
      hasSession: authenticated,
      authByRoute: routeAwareAuth,
    }
  )

  const responses = new Map<string, unknown>([
    [
      '/api/status',
      {
        version: 'v2.6.0',
        system_name: 'RenRen AI',
        logo: '',
        docs_link: 'https://docs.example.test',
        register_enabled: true,
        HeaderNavModules: { docs: true, pricing: { enabled: true } },
      },
    ],
    ['/api/notice', 'All systems operational'],
    ['/api/pricing', [{ id: 1 }, { id: 2 }, { id: 3 }]],
    ['/api/uptime/status', [{ monitors: [{ uptime: 0.9995, status: 1 }] }]],
  ])

  for (const [path, data] of responses) {
    await page.route(`**${path}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: '', data }),
      })
    )
  }
}

export async function waitForStablePage(page: Page): Promise<void> {
  await page.locator('#app > *').first().waitFor({ state: 'visible' })
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  ).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(260)
  await expect(page.locator('[data-error-retry]')).toHaveCount(0)
}

export async function freezeAndInspectHomeCanvas(page: Page): Promise<void> {
  const canvas = page.locator('canvas[role="img"]').first()
  await canvas.waitFor({ state: 'visible' })
  await expect(canvas).toHaveCSS('opacity', '1')

  const pixels = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const context = target.getContext('2d')
    if (!context || target.width === 0 || target.height === 0) {
      return { distinct: 0, changed: 0, samples: 0 }
    }

    const image = context.getImageData(0, 0, target.width, target.height)
    const corner = image.data.slice(0, 3)
    const stepX = Math.max(1, Math.floor(target.width / 96))
    const stepY = Math.max(1, Math.floor(target.height / 64))
    const colors = new Set<string>()
    let changed = 0
    let samples = 0

    for (let y = 0; y < target.height; y += stepY) {
      for (let x = 0; x < target.width; x += stepX) {
        const offset = (y * target.width + x) * 4
        const red = image.data[offset]
        const green = image.data[offset + 1]
        const blue = image.data[offset + 2]
        colors.add(`${red},${green},${blue}`)
        const distance =
          Math.abs(red - corner[0]!) +
          Math.abs(green - corner[1]!) +
          Math.abs(blue - corner[2]!)
        if (distance > 24) changed++
        samples++
      }
    }

    return { distinct: colors.size, changed, samples }
  })

  expect(pixels.distinct).toBeGreaterThan(24)
  expect(pixels.changed).toBeGreaterThan(pixels.samples * 0.01)

  const frameChecksum = () =>
    canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement
      const context = target.getContext('2d')
      if (!context || target.width === 0 || target.height === 0) return 0

      const image = context.getImageData(0, 0, target.width, target.height)
      const stepX = Math.max(1, Math.floor(target.width / 96))
      const stepY = Math.max(1, Math.floor(target.height / 64))
      let checksum = 2_166_136_261
      for (let y = 0; y < target.height; y += stepY) {
        for (let x = 0; x < target.width; x += stepX) {
          const offset = (y * target.width + x) * 4
          for (let channel = 0; channel < 4; channel++) {
            checksum = Math.imul(
              checksum ^ image.data[offset + channel]!,
              16_777_619
            )
          }
        }
      }
      return checksum >>> 0
    })

  const initialFrame = await frameChecksum()
  await page.waitForTimeout(100)
  expect(await frameChecksum()).toBe(initialFrame)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
}

export async function assertHomeNavbarInitialState(page: Page): Promise<void> {
  const navbar = page.locator('.app-navbar')
  await expect(navbar).toHaveAttribute('data-scrolled', 'false')
  await expect(navbar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(navbar).toHaveCSS('box-shadow', 'none')
  await expect(page.locator('.home-brand')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)'
  )
  await expect(page.locator('.home-brand')).toHaveCSS('box-shadow', 'none')
  expect(
    await page.locator('.home-brand').evaluate((element) => ({
      before: getComputedStyle(element, '::before').display,
      after: getComputedStyle(element, '::after').display,
    }))
  ).toEqual({ before: 'none', after: 'none' })

  await page.evaluate(() => window.scrollTo(0, 80))
  await expect(navbar).toHaveAttribute('data-scrolled', 'true')
  await expect(navbar).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(navbar).not.toHaveCSS('box-shadow', 'none')

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(navbar).toHaveAttribute('data-scrolled', 'false')
  await expect(navbar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(navbar).toHaveCSS('box-shadow', 'none')
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    html:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))
  expect(overflow.html).toBeLessThanOrEqual(1)
  expect(overflow.body).toBeLessThanOrEqual(1)
}

export async function assertInteractiveCentersVisible(
  page: Page
): Promise<void> {
  const covered = await page.evaluate(() => {
    const selector =
      'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="button"]:not([aria-disabled="true"])'
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return (
          rect.width > 4 &&
          rect.height > 4 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < innerHeight &&
          rect.left < innerWidth &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          Number(style.opacity) > 0.05
        )
      })
      .flatMap((element) => {
        const rect = element.getBoundingClientRect()
        const x = Math.min(
          innerWidth - 1,
          Math.max(0, rect.left + rect.width / 2)
        )
        const y = Math.min(
          innerHeight - 1,
          Math.max(0, rect.top + rect.height / 2)
        )

        let ancestor = element.parentElement
        while (ancestor) {
          const ancestorStyle = getComputedStyle(ancestor)
          const ancestorRect = ancestor.getBoundingClientRect()
          const clipsX = ['auto', 'scroll', 'hidden', 'clip'].includes(
            ancestorStyle.overflowX
          )
          const clipsY = ['auto', 'scroll', 'hidden', 'clip'].includes(
            ancestorStyle.overflowY
          )
          if (
            (clipsX && (x < ancestorRect.left || x > ancestorRect.right)) ||
            (clipsY && (y < ancestorRect.top || y > ancestorRect.bottom))
          ) {
            return []
          }
          ancestor = ancestor.parentElement
        }

        const hit = document.elementFromPoint(x, y)
        if (
          !hit ||
          element === hit ||
          element.contains(hit) ||
          hit.contains(element)
        ) {
          return []
        }
        return [
          {
            control:
              element.getAttribute('aria-label') ||
              element.textContent?.trim().slice(0, 40) ||
              element.tagName,
            covering: `${hit.tagName}.${(hit as HTMLElement).className}`.slice(
              0,
              120
            ),
          },
        ]
      })
      .slice(0, 5)
  })

  expect(covered).toEqual([])
}
