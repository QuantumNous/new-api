import { createFileRoute } from '@tanstack/solid-router'
import { settingsHead, settingsTitle } from '../../../shared'

export const Route = createFileRoute('/settings')({
  head: settingsHead,
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <main>
      <h1>{settingsTitle}</h1>
      <p>Account settings</p>
    </main>
  )
}
