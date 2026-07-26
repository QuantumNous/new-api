import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { adminUsers, mockUser } from '@/api/mock/data'
import { DEMO_OPERATOR_LEVEL } from '@/api/mock/handlers'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  ADMIN_USER_DEFAULT_VISIBLE_FIELDS,
  ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY,
} from '@/constants/adminUsers'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { AdminUser } from '@/types/console'
import { QUOTA_PER_DOLLAR } from '@/utils/format'
import UsersView from '@/views/console/UsersView.vue'

const mountedWrappers: VueWrapper[] = []
let pinia: ReturnType<typeof createPinia>

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  // The auth store seeds `user` from persisted storage at creation time, so the
  // demo identity has to exist before Pinia is instantiated.
  writeDemoUser(mockUser)
  pinia = createPinia()
  setActivePinia(pinia)
  useToast().toasts.splice(0)
  localStorage.removeItem(ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY)
})

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  resetMockState()
  useToast().toasts.splice(0)
  localStorage.removeItem(ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY)
})

afterAll(() => setLocale('zh-CN'))

async function waitForRequests(delay = 0): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, delay))
  await flushPromises()
}

async function mountUsers(): Promise<VueWrapper> {
  const wrapper = mount(UsersView, {
    attachTo: document.body,
    global: { plugins: [pinia, i18n] },
  })
  mountedWrappers.push(wrapper)
  await waitForRequests()
  return wrapper
}

/** A row the demo operator may mutate: not self, ranked strictly lower. */
function manageableUser(): AdminUser {
  const hit = adminUsers.find(
    (user) => user.id !== mockUser.id && user.role < DEMO_OPERATOR_LEVEL
  )
  if (!hit) throw new Error('expected a manageable user seed')
  return hit
}

/** Desktop data rows only — the mobile list renders in jsdom too. */
function dataRows(wrapper: VueWrapper): DOMWrapper<Element>[] {
  return wrapper.findAll('.data-table-body-viewport tbody tr')
}

function rowFor(wrapper: VueWrapper, username: string): DOMWrapper<Element> {
  const hit = dataRows(wrapper).find((row) => row.text().includes(username))
  if (!hit) throw new Error(`expected a rendered row for ${username}`)
  return hit
}

describe('UsersView', () => {
  it('renders the default column set and the first page', async () => {
    const wrapper = await mountUsers()

    expect(
      wrapper
        .findAll('.data-table-header-clip thead td')
        .map((cell) => cell.text())
        .filter(Boolean)
    ).toEqual([
      'User',
      'Status',
      'Role',
      'Quota',
      'Referrals',
      'Last active',
      'Actions',
    ])
    expect(dataRows(wrapper)).toHaveLength(20)
    expect(wrapper.text()).toContain(`${adminUsers.length} users`)
  })

  it('toggles an optional column and persists the choice', async () => {
    const wrapper = await mountUsers()

    // Asserted on header cells, not page text: "#2400" also appears inside
    // another row's "Referred by #2400" referrer line.
    const headerLabels = () =>
      wrapper
        .findAll('.data-table-header-clip thead td')
        .map((cell) => cell.text())

    expect(headerLabels()).not.toContain('ID')

    await wrapper.get('button[aria-label="Field settings"]').trigger('click')
    await flushPromises()
    const idToggle = wrapper
      .findAll('[role="dialog"] button')
      .find((button) => button.text() === 'ID')
    if (!idToggle) throw new Error('expected the ID field toggle')
    await idToggle.trigger('click')
    await flushPromises()

    expect(headerLabels()).toContain('ID')
    expect(
      JSON.parse(
        localStorage.getItem(ADMIN_USER_VISIBLE_FIELDS_STORAGE_KEY) ?? '[]'
      )
    ).toEqual(['id', ...ADMIN_USER_DEFAULT_VISIBLE_FIELDS])
  })

  it('debounces the keyword search and narrows the page', async () => {
    const wrapper = await mountUsers()

    await wrapper
      .get('input[aria-label="Search username, display name, email or ID"]')
      .setValue(mockUser.username)
    await waitForRequests(350)

    const rows = dataRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain(mockUser.username)
  })
  it('disables destructive row actions on an equal-or-higher role', async () => {
    const wrapper = await mountUsers()
    const rows = dataRows(wrapper)

    // Seed order puts the peer root first and a plain member fourth, so one
    // mount covers both sides of the guard.
    const guarded = rows[0]!
    expect(guarded.text()).toContain('Root administrator')
    expect(
      guarded.get('button[aria-label="Edit user"]').attributes('disabled')
    ).toBeDefined()
    expect(
      guarded.get('button[aria-label="Delete user"]').attributes('disabled')
    ).toBeDefined()
    expect(
      guarded.get('input[type="checkbox"]').attributes('disabled')
    ).toBeDefined()

    const allowed = rows[3]!
    expect(allowed.text()).toContain('Member')
    expect(
      allowed.get('button[aria-label="Edit user"]').attributes('disabled')
    ).toBeUndefined()
    expect(
      allowed.get('input[type="checkbox"]').attributes('disabled')
    ).toBeUndefined()
  })

  it('marks the operator own row and locks every action on it', async () => {
    const wrapper = await mountUsers()

    await wrapper
      .get('input[aria-label="Search username, display name, email or ID"]')
      .setValue(mockUser.username)
    await waitForRequests(350)

    const selfRow = dataRows(wrapper)[0]!
    expect(selfRow.text()).toContain('You')
    expect(
      selfRow.get('button[aria-label="Edit user"]').attributes('disabled')
    ).toBeDefined()
    expect(
      selfRow.get('button[aria-label="Delete user"]').attributes('disabled')
    ).toBeDefined()
    expect(
      selfRow.get('input[type="checkbox"]').attributes('disabled')
    ).toBeDefined()
  })
  it('scopes the header checkbox to rows the operator may act on', async () => {
    const wrapper = await mountUsers()

    await wrapper
      .get('.data-table-header-clip thead input[type="checkbox"]')
      .setValue(true)
    await flushPromises()

    // Page 1 holds one peer root and two admins; the header must skip all three.
    const unmanageable = dataRows(wrapper).filter(
      (row) => row.get('input[type="checkbox"]').attributes('disabled') != null
    ).length
    expect(unmanageable).toBe(3)
    expect(wrapper.text()).toContain(
      `${dataRows(wrapper).length - unmanageable} selected`
    )
  })

  it('disables a selected row through the bulk bar', async () => {
    const wrapper = await mountUsers()
    const target = rowFor(wrapper, manageableUser().username)

    await target.get('input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(wrapper.text()).toContain('1 selected')

    await wrapper
      .get('button[aria-label="Disable selected users"]')
      .trigger('click')
    await waitForRequests()

    expect(useToast().toasts.map((toast) => toast.message)).toContain(
      'Disabled 1 users'
    )
    expect(wrapper.text()).not.toContain('1 selected')
  })

  it('adjusts quota from the row action group', async () => {
    const wrapper = await mountUsers()
    const target = manageableUser()
    // `target` aliases the live seed row, so snapshot before mutating.
    const quotaBefore = target.quota

    await rowFor(wrapper, target.username)
      .get('button[aria-label="Adjust quota"]')
      .trigger('click')
    await flushPromises()

    const body = new DOMWrapper(document.body)
    const dialog = body.get('[role="dialog"]')
    expect(dialog.text()).toContain('Adjust quota')

    await dialog.get('input[aria-label="Amount (USD)"]').setValue('2')
    const confirm = dialog
      .findAll('button')
      .find((button) => button.text() === 'Confirm change')
    if (!confirm) throw new Error('expected the quota confirm action')
    await confirm.trigger('click')
    await waitForRequests()

    expect(useToast().toasts.map((toast) => toast.message)).toContain(
      'Quota granted'
    )
    expect(adminUsers.find((user) => user.id === target.id)?.quota).toBe(
      quotaBefore + 2 * QUOTA_PER_DOLLAR
    )
  })
  it('reduces the quota cell to a remaining figure plus a per-state note', async () => {
    // Seed the three states onto the first rows; resetMockState restores them.
    const [normal, low, exhausted] = [
      adminUsers[1]!,
      adminUsers[2]!,
      adminUsers[3]!,
    ]
    Object.assign(normal, { quota: 4_000_000, used_quota: 1_000_000 })
    Object.assign(low, { quota: 250_000, used_quota: 4_750_000 })
    Object.assign(exhausted, { quota: 0, used_quota: 5_000_000 })

    const wrapper = await mountUsers()

    const cellFor = (user: AdminUser) =>
      rowFor(wrapper, user.username).get('[data-user-quota]')

    expect(cellFor(normal).attributes('data-quota-state')).toBe('normal')
    expect(cellFor(normal).text()).toBe('$8.00$2.00 used')

    expect(cellFor(low).attributes('data-quota-state')).toBe('low')
    expect(cellFor(low).text()).toBe('$0.50Only 5% left')

    expect(cellFor(exhausted).attributes('data-quota-state')).toBe('exhausted')
    expect(cellFor(exhausted).text()).toBe('$0.00No quota left')

    // The synthetic used/total pair and the standalone percent are both gone.
    expect(cellFor(normal).text()).not.toContain('/')
    expect(cellFor(normal).text()).not.toContain('%')
  })

  it('collapses a referral-free row to a dash and keeps active ones legible', async () => {
    const [dormant, inviterOnly, inviteeOnly] = [
      adminUsers[1]!,
      adminUsers[2]!,
      adminUsers[3]!,
    ]
    Object.assign(dormant, {
      invited_count: 0,
      affiliate_quota: 0,
      inviter_id: 0,
    })
    Object.assign(inviterOnly, {
      invited_count: 0,
      affiliate_quota: 0,
      inviter_id: 4242,
    })
    Object.assign(inviteeOnly, {
      invited_count: 6,
      affiliate_quota: 260_000,
      inviter_id: 0,
    })

    const wrapper = await mountUsers()

    const cellFor = (user: AdminUser) =>
      rowFor(wrapper, user.username).get('[data-user-invite]')

    // No "0 invited", no "$0.00", no "No referrer" — just one dash.
    const dormantCell = cellFor(dormant)
    expect(dormantCell.attributes('data-user-invite')).toBe('dormant')
    expect(dormantCell.text()).toBe('—No referral activity')
    expect(dormantCell.get('.sr-only').text()).toBe('No referral activity')

    const inviterCell = cellFor(inviterOnly)
    expect(inviterCell.attributes('data-user-invite')).toBe('active')
    expect(inviterCell.text()).toBe('↗ #4242')
    expect(inviterCell.attributes('aria-label')).toBe('Referred by #4242')

    const inviteeCell = cellFor(inviteeOnly)
    expect(inviteeCell.text()).toBe('6$0.52')
    expect(inviteeCell.attributes('aria-label')).toBe('6 invited，Earned $0.52')
  })

  it('caps the create form role picker at the operator level', async () => {
    const wrapper = await mountUsers()

    const create = wrapper
      .findAll('button')
      .find((button) => button.text().includes('New user'))
    if (!create) throw new Error('expected the create action')
    await create.trigger('click')
    await flushPromises()

    const dialog = new DOMWrapper(document.body).get('[role="dialog"]')
    await dialog.get('button[aria-label="Role"]').trigger('click')
    await flushPromises()

    // Operator level is 10, so Administrator and Root are both out of reach and
    // Guest is registration-only.
    const offered = dialog
      .findAll('[role="option"]')
      .map((option) => option.text())
    expect(offered).toEqual(['Member'])
  })

  it('deletes a row after confirmation', async () => {
    const wrapper = await mountUsers()
    const target = manageableUser()
    const before = adminUsers.length

    await rowFor(wrapper, target.username)
      .get('button[aria-label="Delete user"]')
      .trigger('click')
    await flushPromises()

    const dialog = new DOMWrapper(document.body).get('[role="dialog"]')
    expect(dialog.text()).toContain(target.username)
    const confirm = dialog
      .findAll('button')
      .find((button) => button.text() === 'Delete')
    if (!confirm) throw new Error('expected the delete confirmation')
    await confirm.trigger('click')
    await waitForRequests(50)

    expect(adminUsers).toHaveLength(before - 1)
    expect(adminUsers.some((user) => user.id === target.id)).toBe(false)
    expect(useToast().toasts.map((toast) => toast.message)).toContain(
      'User deleted'
    )
  })

  it('surfaces a load failure with a retry instead of an empty table', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(
      new ApiError('user list unavailable', { business: true })
    )
    const wrapper = await mountUsers()

    expect(wrapper.text()).toContain('Could not load the user list')
    expect(wrapper.text()).toContain('user list unavailable')
    expect(wrapper.find('.data-table-body-viewport').exists()).toBe(false)

    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Retry')
    if (!retry) throw new Error('expected the retry action')
    await retry.trigger('click')
    await waitForRequests()

    expect(wrapper.text()).not.toContain('Could not load the user list')
    expect(dataRows(wrapper)).toHaveLength(20)
  })
})
