import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('params.parse stringifies links and parses concrete params', async ({
  page,
}) => {
  await expect(page.getByTestId('match-en-link')).toHaveAttribute(
    'href',
    '/match/en',
  )

  await page.getByTestId('match-en-link').click()
  await expect(page.getByTestId('match-language')).toHaveText(
    'Match language en-US',
  )

  await page.goto('/match/pl')
  await expect(page.getByTestId('match-language')).toHaveText(
    'Match language pl-PL',
  )

  await page.goto('/match/en-US')
  await expect(page.getByTestId('not-found')).toHaveText('Root not found')
})

test('params.parse can fall through to sibling dynamic routes', async ({
  page,
}) => {
  await expect(page.getByTestId('numeric-user-link')).toHaveAttribute(
    'href',
    '/users/456',
  )
  await expect(page.getByTestId('username-link')).toHaveAttribute(
    'href',
    '/users/alice',
  )

  await page.goto('/users/123')
  await expect(page.getByTestId('numeric-user')).toHaveText('Numeric user 123')

  await page.goto('/users/alice')
  await expect(page.getByTestId('username')).toHaveText('Username alice')
})

test('params.parse can gate child routes', async ({ page }) => {
  await expect(page.getByTestId('org-settings-link')).toHaveAttribute(
    'href',
    '/orgs/42/settings',
  )

  await page.goto('/orgs/42/settings')
  await expect(page.getByTestId('org-settings')).toHaveText('Org settings 42')

  await page.goto('/orgs/acme/about')
  await expect(page.getByTestId('org-about')).toHaveText('Org about acme')

  await page.goto('/orgs/acme/settings')
  await expect(page.getByTestId('not-found')).toHaveText('Root not found')
})

test('buildLocation uses exact route templates before matching paths', async ({
  page,
}) => {
  await expect(page.getByTestId('ambiguous-dollar-link')).toHaveAttribute(
    'href',
    '/ambiguous/dollar-alpha',
  )
  await expect(page.getByTestId('ambiguous-curly-link')).toHaveAttribute(
    'href',
    '/ambiguous/curly-alpha',
  )

  await page.getByTestId('ambiguous-dollar-link').click()
  await expect(page.getByTestId('ambiguous-dollar')).toHaveText('Dollar alpha')

  await page.getByTestId('ambiguous-curly-link').click()
  await expect(page.getByTestId('ambiguous-curly')).toHaveText('Curly alpha')
})
