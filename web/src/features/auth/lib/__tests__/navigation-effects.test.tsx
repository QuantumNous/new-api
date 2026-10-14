/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, waitFor } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { Route as OAuthRoute } from '@/routes/(auth)/oauth'
import { Route as SignInRoute } from '@/routes/(auth)/sign-in'
import { useAuthStore, type AuthBundle } from '@/stores/auth-store'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  replaceDocument: vi.fn(),
  redirect: vi.fn(),
  resolveAuthentication: vi.fn(),
  search: {
    code: 'wechat-code',
    provider: 'wechat',
    redirect: undefined as string | undefined,
  },
  wechatLoginByCode: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    redirect: (options: Parameters<typeof actual.redirect>[0]) => {
      mocks.redirect({ ...options })
      return actual.redirect(options)
    },
    useNavigate: () => mocks.navigate,
    useSearch: () => mocks.search,
  }
})

vi.mock('@/features/auth/lib/auth-redirect', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/auth/lib/auth-redirect')>()
  return {
    ...actual,
    navigateAfterAuthentication: (
      value: unknown,
      origin: string,
      navigate: Parameters<typeof actual.navigateAfterAuthentication>[2]
    ) =>
      actual.navigateAfterAuthentication(
        value,
        origin,
        navigate,
        mocks.replaceDocument
      ),
  }
})

vi.mock('@/features/auth/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth/api')>()
  return { ...actual, wechatLoginByCode: mocks.wechatLoginByCode }
})

vi.mock('@/lib/auth-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-session')>()
  return { ...actual, resolveAuthentication: mocks.resolveAuthentication }
})

const bundle: AuthBundle = {
  access_token: 'navigation-access',
  token_type: 'Bearer',
  access_expires_at: 2_000_000_000,
  user: { id: 42, username: 'navigation-user', role: 1 },
  session: {
    sid: 'navigation-session',
    current: true,
    login_method: 'password',
    ip: '127.0.0.1',
    user_agent: 'vitest',
    created_at: 1,
    last_active_at: 1,
    expires_at: 2_000_000_000,
  },
}

const clientNavigationCases = [
  {
    name: 'uses client navigation for a safe application path',
    redirect: '/dashboard?tab=usage#recent',
    expected: {
      href: '/dashboard?tab=usage#recent',
      replace: true,
    },
  },
  {
    name: 'rejects an external redirect and falls back to the dashboard',
    redirect: 'https://attacker.example/path',
    expected: {
      href: '/dashboard',
      replace: true,
    },
  },
] as const

beforeEach(() => {
  mocks.navigate.mockReset().mockResolvedValue(undefined)
  mocks.replaceDocument.mockReset()
  mocks.redirect.mockClear()
  mocks.resolveAuthentication.mockReset().mockResolvedValue({
    kind: 'authenticated',
    bundle,
  })
  mocks.wechatLoginByCode.mockReset().mockResolvedValue({
    success: true,
    data: bundle,
  })
  mocks.search.code = 'wechat-code'
  mocks.search.provider = 'wechat'
  mocks.search.redirect = undefined
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

test('WeChat callback replaces the document for Canvas SSO without SPA navigation', async () => {
  mocks.search.redirect = '/_canvas_sso'
  const OAuthComponent = OAuthRoute.options.component as ComponentType

  render(createElement(OAuthComponent))

  await waitFor(() => expect(mocks.replaceDocument).toHaveBeenCalledOnce())
  expect(mocks.replaceDocument).toHaveBeenCalledWith('/_canvas_sso')
  expect(mocks.navigate).not.toHaveBeenCalled()
})

test.each(clientNavigationCases)('WeChat callback $name', async (testCase) => {
  mocks.search.redirect = testCase.redirect
  const OAuthComponent = OAuthRoute.options.component as ComponentType

  render(createElement(OAuthComponent))

  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce())
  expect(mocks.navigate).toHaveBeenCalledWith(testCase.expected)
  expect(mocks.replaceDocument).not.toHaveBeenCalled()
})

test('existing session beforeLoad replaces the document for Canvas SSO without a router redirect', async () => {
  useAuthStore.getState().auth.setBundle(bundle)
  const beforeLoad = SignInRoute.options.beforeLoad as unknown as (context: {
    search: { redirect?: string }
  }) => Promise<void>

  await expect(
    beforeLoad({ search: { redirect: '/_canvas_sso' } })
  ).resolves.toBeUndefined()

  expect(mocks.replaceDocument).toHaveBeenCalledOnce()
  expect(mocks.replaceDocument).toHaveBeenCalledWith('/_canvas_sso')
  expect(mocks.redirect).not.toHaveBeenCalled()
})

test.each(clientNavigationCases)(
  'existing session beforeLoad $name',
  async (testCase) => {
    useAuthStore.getState().auth.setBundle(bundle)
    const beforeLoad = SignInRoute.options.beforeLoad as unknown as (context: {
      search: { redirect?: string }
    }) => Promise<void>

    await expect(
      beforeLoad({ search: { redirect: testCase.redirect } })
    ).rejects.toMatchObject({ options: testCase.expected })

    expect(mocks.redirect).toHaveBeenCalledOnce()
    expect(mocks.redirect).toHaveBeenCalledWith(testCase.expected)
    expect(mocks.replaceDocument).not.toHaveBeenCalled()
  }
)
