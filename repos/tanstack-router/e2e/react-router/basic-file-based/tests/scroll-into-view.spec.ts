import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const anchors = {
  defaultAnchor: 'default-anchor',
  noScrollIntoView: 'false-anchor',
  smoothScroll: 'smooth-scroll',
} as const

const formTestIds = {
  targetAnchor: 'hash-select',
  scrollIntoView: 'with-scroll',
  behaviorSelect: 'behavior-select',
  blockSelect: 'block-select',
  inlineSelect: 'inline-select',
  navigateButton: 'navigate-button',
}

const shownSuffix = '(shown)'

const activeClass = 'font-bold active'

function getAnchorTarget(page: Page, anchor: string) {
  return page.getByTestId(`heading-${anchor}`)
}

function getAnchorLink(page: Page, anchor: string) {
  return page.getByTestId(`link-${anchor}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/anchor')
})

// Testing the `Link` component with the `hashScrollIntoView` prop
test('Navigating via anchor `Link` with default hash scrolling behavior', async ({
  page,
}) => {
  await expect(getAnchorTarget(page, anchors.defaultAnchor)).not.toContainText(
    shownSuffix,
  )

  await getAnchorLink(page, anchors.defaultAnchor).click()

  await expect(getAnchorTarget(page, anchors.defaultAnchor)).toBeVisible()
  await expect(getAnchorTarget(page, anchors.defaultAnchor)).toContainText(
    shownSuffix,
  )

  await expect(getAnchorLink(page, anchors.defaultAnchor)).toHaveClass(
    activeClass,
  )
})

test('Navigating via anchor `Link` with hash scrolling disabled', async ({
  page,
}) => {
  const initialScrollPosition = await page.evaluate(() => window.scrollY)

  await expect(
    getAnchorTarget(page, anchors.noScrollIntoView),
  ).not.toContainText(shownSuffix)

  await getAnchorLink(page, anchors.noScrollIntoView).click()

  // The active anchor should have updated
  await expect(getAnchorLink(page, anchors.noScrollIntoView)).toHaveClass(
    activeClass,
  )

  // The anchor should not have been visible, because the scroll should not have been activated
  await expect(getAnchorTarget(page, anchors.defaultAnchor)).not.toContainText(
    shownSuffix,
  )

  // Expect the same scroll position as before
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollPosition)
})

test('Navigating via anchor `Link` with smooth hash scrolling behavior', async ({
  page,
}) => {
  await expect(getAnchorTarget(page, anchors.smoothScroll)).not.toContainText(
    shownSuffix,
  )

  await getAnchorLink(page, anchors.smoothScroll).click()
  await expect(getAnchorTarget(page, anchors.smoothScroll)).toBeVisible()

  // Smooth scrolling should activate the IntersectionObserver on all headings, making them all render "(shown)"
  await expect(getAnchorTarget(page, anchors.defaultAnchor)).toContainText(
    shownSuffix,
  )
  await expect(getAnchorTarget(page, anchors.noScrollIntoView)).toContainText(
    shownSuffix,
  )
  await expect(getAnchorTarget(page, anchors.smoothScroll)).toContainText(
    shownSuffix,
  )

  await expect(getAnchorLink(page, anchors.smoothScroll)).toHaveClass(
    activeClass,
  )
})

// Testing the `useNavigate` hook with the `hashScrollIntoView` option
test('Navigating via `useNavigate` with instant scroll behavior', async ({
  page,
}) => {
  await expect(getAnchorTarget(page, anchors.smoothScroll)).not.toContainText(
    shownSuffix,
  )

  // Scroll to the last anchor instantly, should not activate Intersection Observers for the other anchors
  await page.getByTestId(formTestIds.targetAnchor).selectOption('Smooth Scroll')
  await page.getByTestId(formTestIds.scrollIntoView).check()
  await page.getByTestId(formTestIds.behaviorSelect).selectOption('instant')
  await page.getByTestId(formTestIds.blockSelect).selectOption('start')
  await page.getByTestId(formTestIds.inlineSelect).selectOption('nearest')
  await page.getByTestId(formTestIds.navigateButton).click()

  await expect(getAnchorTarget(page, anchors.defaultAnchor)).not.toContainText(
    shownSuffix,
  )

  await expect(
    getAnchorTarget(page, anchors.noScrollIntoView),
  ).not.toContainText(shownSuffix)

  await expect(getAnchorTarget(page, anchors.smoothScroll)).toContainText(
    shownSuffix,
  )

  await expect(getAnchorLink(page, anchors.smoothScroll)).toBeVisible()

  await expect(getAnchorLink(page, anchors.smoothScroll)).toHaveClass(
    activeClass,
  )
})

test('Navigating via `useNavigate` with scrollIntoView disabled', async ({
  page,
}) => {
  const initialScrollPosition = await page.evaluate(() => window.scrollY)

  await expect(getAnchorTarget(page, anchors.defaultAnchor)).not.toContainText(
    shownSuffix,
  )

  await expect(
    getAnchorTarget(page, anchors.noScrollIntoView),
  ).not.toContainText(shownSuffix)

  await expect(getAnchorTarget(page, anchors.smoothScroll)).not.toContainText(
    shownSuffix,
  )

  // Navigate to the last anchor, but with scrollIntoView disabled should not activate Intersection Observers for any anchors
  await page.getByTestId(formTestIds.targetAnchor).selectOption('Smooth Scroll')
  await page.getByTestId(formTestIds.scrollIntoView).uncheck()
  await page.getByTestId(formTestIds.navigateButton).click()

  await expect(getAnchorTarget(page, anchors.defaultAnchor)).not.toContainText(
    shownSuffix,
  )

  await expect(
    getAnchorTarget(page, anchors.noScrollIntoView),
  ).not.toContainText(shownSuffix)

  await expect(getAnchorTarget(page, anchors.smoothScroll)).not.toContainText(
    shownSuffix,
  )

  await expect(getAnchorLink(page, anchors.smoothScroll)).toHaveClass(
    activeClass,
  )

  // Expect the same scroll position as before
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollPosition)
})

test('Navigating via `useNavigate` with smooth scroll behavior', async ({
  page,
}) => {
  await expect(getAnchorTarget(page, anchors.smoothScroll)).not.toContainText(
    shownSuffix,
  )

  // Scroll to the last anchor smoothly, should activate Intersection Observers for the other anchors, making them all render "(shown)"
  await page.getByTestId(formTestIds.targetAnchor).selectOption('Smooth Scroll')
  await page.getByTestId(formTestIds.scrollIntoView).check()
  await page.getByTestId(formTestIds.behaviorSelect).selectOption('smooth')
  await page.getByTestId(formTestIds.blockSelect).selectOption('start')
  await page.getByTestId(formTestIds.inlineSelect).selectOption('nearest')
  await page.getByTestId(formTestIds.navigateButton).click()

  await expect(getAnchorTarget(page, anchors.defaultAnchor)).toContainText(
    shownSuffix,
  )

  await expect(getAnchorTarget(page, anchors.noScrollIntoView)).toContainText(
    shownSuffix,
  )

  await expect(getAnchorTarget(page, anchors.smoothScroll)).toContainText(
    shownSuffix,
  )

  await expect(getAnchorLink(page, anchors.smoothScroll)).toHaveClass(
    activeClass,
  )
})
