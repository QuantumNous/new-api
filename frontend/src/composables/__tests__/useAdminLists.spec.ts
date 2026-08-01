import { createPinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { useAdminPlans } from '@/composables/useAdminPlans'
import { useAdminRedemption } from '@/composables/useAdminRedemption'
import i18n from '@/i18n'
import type {
  AdminPlan,
  AdminPlanPage,
  AdminRedemptionCode,
  AdminRedemptionPage,
} from '@/types/console'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function planPage(marker: number): AdminPlanPage {
  return {
    items: [{ id: marker } as AdminPlan],
    total: 1,
    page: 1,
    page_size: 20,
    status_counts: {},
    kind_counts: {},
    filtered_subscribers: 0,
    filtered_revenue: 0,
  }
}

function redemptionPage(marker: number): AdminRedemptionPage {
  return {
    items: [{ id: marker } as AdminRedemptionCode],
    total: 1,
    page: 1,
    page_size: 20,
    type_counts: {},
    status_counts: {},
  }
}

const wrappers: VueWrapper[] = []
let plansState: ReturnType<typeof useAdminPlans> | null = null
let redemptionState: ReturnType<typeof useAdminRedemption> | null = null

const AdminListHost = defineComponent({
  props: { kind: { type: String, required: true } },
  setup(props) {
    if (props.kind === 'plans') plansState = useAdminPlans()
    else redemptionState = useAdminRedemption()
    return () => null
  },
})

function setupPlans(): ReturnType<typeof useAdminPlans> {
  plansState = null
  wrappers.push(
    mount(AdminListHost, {
      props: { kind: 'plans' },
      global: { plugins: [createPinia(), i18n] },
    })
  )
  if (!plansState) throw new Error('expected plans composable instance')
  return plansState
}

function setupRedemption(): ReturnType<typeof useAdminRedemption> {
  redemptionState = null
  wrappers.push(
    mount(AdminListHost, {
      props: { kind: 'redemption' },
      global: { plugins: [createPinia(), i18n] },
    })
  )
  if (!redemptionState)
    throw new Error('expected redemption composable instance')
  return redemptionState
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('admin list request ordering', () => {
  it('keeps the newest plan filter response when an older request lands late', async () => {
    const requests = [
      deferred<AdminPlanPage>(),
      deferred<AdminPlanPage>(),
      deferred<AdminPlanPage>(),
    ]
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(requests[0].promise as never)
      .mockReturnValueOnce(requests[1].promise as never)
      .mockReturnValueOnce(requests[2].promise as never)

    const state = setupPlans()
    requests[0].resolve(planPage(0))
    await flushPromises()

    state.statusFilter.value = 'active'
    await nextTick()
    state.statusFilter.value = 'disabled'
    await nextTick()

    requests[2].resolve(planPage(2))
    await flushPromises()
    requests[1].resolve(planPage(1))
    await flushPromises()

    expect(state.rows.value[0]?.id).toBe(2)
    expect(state.loading.value).toBe(false)
  })

  it('keeps the newest redemption filter response when an older request lands late', async () => {
    const requests = [
      deferred<AdminRedemptionPage>(),
      deferred<AdminRedemptionPage>(),
      deferred<AdminRedemptionPage>(),
    ]
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(requests[0].promise as never)
      .mockReturnValueOnce(requests[1].promise as never)
      .mockReturnValueOnce(requests[2].promise as never)

    const state = setupRedemption()
    requests[0].resolve(redemptionPage(0))
    await flushPromises()

    state.statusFilter.value = 'unused'
    await nextTick()
    state.statusFilter.value = 'disabled'
    await nextTick()

    requests[2].resolve(redemptionPage(2))
    await flushPromises()
    requests[1].resolve(redemptionPage(1))
    await flushPromises()

    expect(state.rows.value[0]?.id).toBe(2)
    expect(state.loading.value).toBe(false)
  })

  it('returns to the first page when the page size changes', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(planPage(0) as never)
    const state = setupPlans()
    await flushPromises()

    state.page.value = 3
    await nextTick()
    await flushPromises()
    state.pageSize.value = 50
    await nextTick()
    await flushPromises()

    expect(state.page.value).toBe(1)
    expect(get).toHaveBeenLastCalledWith(
      '/api/plan/',
      expect.objectContaining({ p: 1, page_size: 50 }),
      expect.anything()
    )
  })
})
