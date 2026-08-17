import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: routerPush }),
}))

import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import AccountCenterView from '@/views/console/AccountCenterView.vue'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

beforeEach(() => {
  setActivePinia(createPinia())
  routerPush.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-17T12:00:00+08:00'))
})

afterEach(() => vi.useRealTimers())

function render(
  createdAt = Math.floor(
    new Date('2025-08-17T12:00:00+08:00').getTime() / 1000
  ),
  status = 1
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().persist({
    id: 7,
    username: 'member',
    display_name: 'Member',
    email: 'member@example.com',
    role: 1,
    status,
    quota: 2_000_000,
    used_quota: 1_500_000,
    request_count: 12_345,
    created_at: createdAt,
  })

  return mount(AccountCenterView, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        AccountSettingsView: true,
        PageHero: true,
      },
    },
  })
}

describe('AccountCenterView', () => {
  it('renders account overview values from the authenticated user contract', () => {
    const wrapper = render()

    expect(wrapper.get('[data-testid="profile-join-date"]').text()).toBe(
      '2025-08-17'
    )
    expect(wrapper.get('[data-testid="profile-member-duration"]').text()).toBe(
      '365 天'
    )
    expect(wrapper.get('[data-testid="profile-total-calls"]').text()).toBe(
      '12.3K'
    )
    expect(
      wrapper.get('[data-testid="profile-stat-requests"]').text()
    ).toContain('12.3K')
    expect(
      wrapper.get('[data-testid="profile-account-status"]').text()
    ).toContain('正常')
  })

  it('shows missing dates safely and reflects a disabled account status', async () => {
    const wrapper = render()

    Reflect.deleteProperty(useAuthStore().user!, 'created_at')
    useAuthStore().persist({
      ...useAuthStore().user!,
      status: 2,
    })
    await nextTick()

    expect(wrapper.get('[data-testid="profile-join-date"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="profile-member-duration"]').text()).toBe(
      '—'
    )

    expect(
      wrapper.get('[data-testid="profile-account-status"]').text()
    ).toContain('已禁用')
  })

  it('rejects a future account creation time', () => {
    const wrapper = render(
      Math.floor(new Date('2026-08-18T12:00:00+08:00').getTime() / 1000)
    )

    expect(wrapper.get('[data-testid="profile-join-date"]').text()).toBe('—')
    expect(wrapper.get('[data-testid="profile-member-duration"]').text()).toBe(
      '—'
    )
  })
})
