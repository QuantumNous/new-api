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
    readyTestId: 'home-heading',
    warmup: async (page) => {
      await page.getByTestId('link-about').click()
      await page.waitForURL('**/about')
      await page.getByTestId('about-heading').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')

      await page.getByTestId('link-home').click()
      await page.waitForURL(/\/([^/]*)(\/)?($|\?)/)
      await page.getByTestId('home-heading').waitFor({ state: 'visible' })
      await page.waitForLoadState('networkidle')
    },
  })
}
