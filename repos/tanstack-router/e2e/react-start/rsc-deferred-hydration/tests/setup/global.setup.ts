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
      for (const route of ['/server-client', '/composite', '/css']) {
        await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle')
      }
    },
  })
}
