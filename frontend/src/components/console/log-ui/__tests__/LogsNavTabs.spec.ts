import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import LogsNavTabs from '@/components/console/log-ui/LogsNavTabs.vue'
import i18n, { loadMessageDomain } from '@/i18n'
import { useAuthStore } from '@/stores/auth'

const EmptyRoute = defineComponent({ template: '<div />' })

async function mountTabs(role: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.persist({
    id: 1,
    username: 'tester',
    display_name: 'Tester',
    email: 'tester@example.com',
    role,
    status: 1,
    quota: 0,
    used_quota: 0,
    request_count: 0,
    created_at: 1_700_000_000,
  })
  auth.checked = true

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/logs', name: 'logs', component: EmptyRoute },
      { path: '/logs/drawing', name: 'logs-drawing', component: EmptyRoute },
      { path: '/logs/tasks', name: 'logs-tasks', component: EmptyRoute },
      {
        path: '/logs/operations',
        name: 'logs-operations',
        component: EmptyRoute,
      },
    ],
  })
  await router.push('/logs')
  await router.isReady()

  return mount(LogsNavTabs, {
    props: { active: 'consume' },
    global: { plugins: [pinia, router, i18n] },
  })
}

beforeEach(async () => {
  await loadMessageDomain('console')
})

describe('operation log navigation tab', () => {
  it('shows the fourth tab to administrators', async () => {
    const wrapper = await mountTabs(10)
    expect(wrapper.findAll('a')).toHaveLength(4)
    expect(wrapper.find('a[href="/logs/operations"]').exists()).toBe(true)
  })

  it('keeps ordinary users on the three self-service tabs', async () => {
    const wrapper = await mountTabs(1)
    expect(wrapper.findAll('a')).toHaveLength(3)
    expect(wrapper.find('a[href="/logs/operations"]').exists()).toBe(false)
  })
})
