import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function waitForServer(url: string) {
  const start = Date.now()

  while (Date.now() - start < 30_000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5_000)

    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
      })

      if (res.status >= 200 && res.status < 400) {
        return
      }
    } catch {
      // ignore aborted/network errors
    } finally {
      clearTimeout(timer)
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for dev server at ${url}`)
}

export async function preOptimizeDevServer(opts: {
  baseURL: string
  readyTestId?: string
  warmup?: (page: Page) => Promise<void>
}) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(`${opts.baseURL}/`, { waitUntil: 'domcontentloaded' })

    if (opts.readyTestId) {
      await page.getByTestId(opts.readyTestId).waitFor({ state: 'visible' })
    }

    await page.waitForLoadState('networkidle')

    await opts.warmup?.(page)

    for (let i = 0; i < 40; i++) {
      const currentUrl = page.url()
      await page.waitForTimeout(250)

      if (page.url() === currentUrl) {
        await page.waitForTimeout(250)
        if (page.url() === currentUrl) {
          return
        }
      }
    }

    throw new Error('Dev server did not reach a stable URL after warmup')
  } finally {
    await context.close()
    await browser.close()
  }
}
