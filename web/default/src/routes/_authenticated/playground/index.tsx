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
import { createFileRoute, redirect } from '@tanstack/react-router'

// Playground is a developer-debugging console inherited from upstream
// new-api. DeepRouter is a utility (account + wallet), NOT a chat
// destination ("不做 chat 是红线", onboarding-v2 §2) — end users never use
// it. Any hit on /playground (stray link, typed URL, stale bookmark)
// bounces to the dashboard. The Playground feature code is kept (not
// deleted) so it can be re-enabled behind a developer flag later if needed.
export const Route = createFileRoute('/_authenticated/playground/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
