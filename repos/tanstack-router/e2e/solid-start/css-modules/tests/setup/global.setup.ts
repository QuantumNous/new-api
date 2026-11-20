import {
  e2eStartDummyServer,
  getTestServerPort,
  preOptimizeDevServer,
  waitForServer,
} from '@tanstack/router-e2e-utils'
import packageJson from '../../package.json' with { type: 'json' }

export default async function setup() {
  await e2eStartDummyServer(packageJson.name)

  if (process.env.MODE !== 'dev') return

  const port = await getTestServerPort(packageJson.name)
  const baseURL = `http://localhost:${port}`

  await waitForServer(baseURL)
  await preOptimizeDevServer({
    baseURL,
    readyTestId: 'global-styled',
    warmup: async (page) => {
      await page.goto(`${baseURL}/modules`, { waitUntil: 'domcontentloaded' })
      await page.getByTestId('module-card').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')

      await page.goto(`${baseURL}/sass-mixin`, {
        waitUntil: 'domcontentloaded',
      })
      await page.getByTestId('mixin-styled').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')

      await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
      await page.getByTestId('global-styled').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')

      await page.getByTestId('nav-modules').click()
      await page.waitForURL('**/modules')
      await page.getByTestId('module-card').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')

      await page.getByTestId('nav-home').click()
      await page.waitForURL(/\/([^/]*)(\/)?($|\?)/)
      await page.getByTestId('global-styled').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')
    },
  })
}
