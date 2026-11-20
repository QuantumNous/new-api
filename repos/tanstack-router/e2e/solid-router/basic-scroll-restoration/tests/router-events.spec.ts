import { expect, test } from '@playwright/test'

test('after a navigation, should have emitted "onBeforeRouteMount","onResolved" and useRenderEffect setup in the correct order', async ({
  page,
}) => {
  // Navigate to the Home page
  await page.goto('/')
  await expect(page.locator('#greeting')).toContainText('Welcome Home!')

  let orders = await page.evaluate(() => window.invokeOrders)

  expectItemOrder(orders, 'onBeforeRouteMount', 'onResolved')
  expectItemOrder(orders, 'onBeforeRouteMount', 'index-useLayoutEffect')

  // Clear the invokeOrders array
  orders = await page.evaluate(() => {
    window.invokeOrders = []
    return window.invokeOrders
  })

  // Navigate to the About page
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page.locator('#greeting')).toContainText('Hello from About!')

  orders = await page.evaluate(() => window.invokeOrders)

  expectItemOrder(orders, 'onBeforeRouteMount', 'onResolved')
  expectItemOrder(orders, 'onBeforeRouteMount', 'about-useLayoutEffect')
})

function expectItemOrder<TItem>(
  array: Array<TItem>,
  firstItem: TItem,
  secondItem: TItem,
) {
  const firstIndex = array.findIndex((item) => item === firstItem)
  const secondIndex = array.findIndex((item) => item === secondItem)

  if (firstIndex === -1 || secondIndex === -1) {
    throw new Error('One or both items were not found in the array ' + array)
  }

  expect(firstIndex).toBeLessThan(secondIndex)
}
