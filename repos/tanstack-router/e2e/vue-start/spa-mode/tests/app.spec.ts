import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import type { Page } from '@playwright/test'

async function runTest(
  page: Page,
  expectedData: {
    loader: {
      root: 'server' | 'client'
      posts: 'server' | 'client'
      postId: 'server' | 'client'
    }
    context: {
      root: 'server' | 'client'
      posts: 'server' | 'client'
      postId: 'server' | 'client'
    }
  },
) {
  // wait for page to be loaded by waiting for the leaf route to be rendered
  await expect(page.getByTestId('postId-heading')).toContainText('postId')

  // check expectations
  await Promise.all(
    Object.entries(expectedData.loader).map(async ([route, expectedLoader]) => {
      await expect(page.getByTestId(`${route}-loader`)).toContainText(
        expectedLoader,
      )
    }),
  )
  await Promise.all(
    Object.entries(expectedData.context).map(
      async ([route, expectedContext]) => {
        await expect(page.getByTestId(`${route}-context`)).toContainText(
          expectedContext,
        )
      },
    ),
  )
  await expect(page.getByTestId('router-isLoading')).toContainText('false')
  await expect(page.getByTestId('router-status')).toContainText('idle')
}
test.describe('SPA mode', () => {
  test(`directly visiting prerendered /posts/1`, async ({
    page,
  }: {
    page: Page
  }) => {
    await page.goto('/posts/1')
    await runTest(page, {
      loader: {
        root: 'server',
        posts: 'server',
        postId: 'server',
      },
      context: {
        root: 'server',
        posts: 'server',
        postId: 'server',
      },
    })
  })

  test(`client-side navigation to /posts/1`, async ({
    page,
  }: {
    page: Page
  }) => {
    await page.goto('/')
    const testId = 'link-posts-1'
    await page.getByTestId(testId).click()
    await runTest(page, {
      loader: {
        root: 'server',
        posts: 'client',
        postId: 'client',
      },
      context: {
        root: 'client',
        posts: 'client',
        postId: 'client',
      },
    })
  })
})
