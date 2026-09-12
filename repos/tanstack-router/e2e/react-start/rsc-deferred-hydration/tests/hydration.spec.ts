import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import type { Page } from '@playwright/test'

async function expectUnhydrated(page: Page, id: string) {
  await expect(page.getByTestId(`${id}-button`)).toHaveAttribute(
    'data-hydrated',
    'false',
  )
}

async function clickAndExpectCount(page: Page, id: string, count: string) {
  await expect(page.getByTestId(`${id}-button`)).toHaveAttribute(
    'data-hydrated',
    'true',
  )
  await page.getByTestId(`${id}-button`).click()
  await expect(page.getByTestId(`${id}-count`)).toHaveText(count)
}

async function gotoWithoutPointerIntent(page: Page, path: string) {
  await page.mouse.move(0, 0)
  await page.goto(path)
}

async function waitForHydrateMarkerToMount(page: Page, id: string) {
  await page.waitForFunction((testId) => {
    const button = document.querySelector(`[data-testid="${testId}-button"]`)
    const marker = button?.closest('[data-ts-hydrate-id]')
    return Object.keys(marker ?? {}).some((key) => key.startsWith('__react'))
  }, id)
}

test.describe('RSC deferred hydration', () => {
  test('server component renders a client Hydrate island that hydrates on interaction', async ({
    page,
  }) => {
    await gotoWithoutPointerIntent(page, '/server-client')

    await expect(page.getByTestId('server-client-rsc')).toContainText(
      'Server component renders a deferred client island',
    )
    await expect(page.getByTestId('server-client-island')).toContainText(
      'Interaction strategy inside RSC output',
    )
    await expectUnhydrated(page, 'server-client')

    await page.mouse.move(0, 0)
    await page.getByTestId('server-client-button').hover()
    await clickAndExpectCount(page, 'server-client', '1')
  })

  test('composite server component can wrap an interaction Hydrate client island', async ({
    page,
  }) => {
    await gotoWithoutPointerIntent(page, '/composite')

    await expect(page.getByTestId('composite-rsc')).toContainText(
      'Server shell, client Hydrate slot',
    )
    await expect(
      page.getByTestId('composite-interaction-island'),
    ).toContainText('Interaction strategy inside a composite server component')
    await expectUnhydrated(page, 'composite-interaction')

    await waitForHydrateMarkerToMount(page, 'composite-interaction')
    await page.mouse.move(0, 0)
    await page.getByTestId('composite-interaction-button').hover()
    await clickAndExpectCount(page, 'composite-interaction', '1')
  })

  test('server component can render a CSS module Hydrate client island', async ({
    page,
  }) => {
    await gotoWithoutPointerIntent(page, '/css')

    await expect(page.getByTestId('css-rsc')).toContainText(
      'CSS module Hydrate boundary',
    )
    await expect(page.getByTestId('css-module-marker')).toHaveCSS(
      'font-weight',
      '900',
    )
    await waitForHydrateMarkerToMount(page, 'css-nested')
    await page.getByTestId('css-nested-button').click()
    await expect(page.getByTestId('css-nested-button')).toHaveAttribute(
      'data-hydrated',
      'true',
    )
    await expect(page.getByTestId('css-nested-count')).toHaveText('1')
  })
})
