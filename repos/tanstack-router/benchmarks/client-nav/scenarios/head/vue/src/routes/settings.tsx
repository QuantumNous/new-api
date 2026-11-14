import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { settingsHead, settingsTitle } from '../../../shared'

const SettingsPage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <h1>{settingsTitle}</h1>
        <p>Account settings</p>
      </main>
    )
  },
})

export const Route = createFileRoute('/settings')({
  head: settingsHead,
  component: SettingsPage,
})
