import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import ConsoleNavStrip from '@/components/console/ConsoleNavStrip.vue'
import LabNavStrip from '@/components/lab/LabNavStrip.vue'
import i18n, { loadMessageDomain } from '@/i18n'

const EmptyRoute = defineComponent({ template: '<div />' })

async function routerAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/console/dashboard', name: 'dashboard', component: EmptyRoute },
      { path: '/console/models', name: 'models', component: EmptyRoute },
      { path: '/lab/chat', name: 'lab-chat', component: EmptyRoute },
      { path: '/lab/studio', name: 'lab-studio', component: EmptyRoute },
      { path: '/lab/assets', name: 'lab-assets', component: EmptyRoute },
      { path: '/lab/notes', name: 'lab-notes', component: EmptyRoute },
      { path: '/lab/plugins', name: 'lab-plugins', component: EmptyRoute },
    ],
  })
  await router.push(path)
  await router.isReady()
  return router
}

describe('hand-drawn mobile navigation', () => {
  it('marks the console strip and keeps the active route semantic', async () => {
    await loadMessageDomain('console')
    const router = await routerAt('/console/models')
    const wrapper = mount(ConsoleNavStrip, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.attributes('data-handdrawn')).toBe('navigation-strip')
    expect(wrapper.get('[aria-current="page"]').text()).toBeTruthy()
  })

  it('marks the Lab strip and keeps the active route semantic', async () => {
    await Promise.all([loadMessageDomain('console'), loadMessageDomain('lab')])
    const router = await routerAt('/lab/chat')
    const wrapper = mount(LabNavStrip, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.attributes('data-handdrawn')).toBe('navigation-strip')
    expect(wrapper.get('[aria-current="page"]').text()).toBeTruthy()
  })
})
