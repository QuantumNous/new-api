import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return <p>Settings</p>
}
