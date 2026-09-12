import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const SettingsPage = Vue.defineComponent({
  setup() {
    return () => <p>Settings</p>
  },
})

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
