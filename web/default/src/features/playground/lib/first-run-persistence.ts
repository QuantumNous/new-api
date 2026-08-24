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

/**
 * Per-user persistence for the Playground first-run onboarding.
 *
 * The onboarding is one-shot in the URL (`?first=1`) but must survive tab
 * switches / reloads for a brand-new user until they complete their first
 * successful call. We record two flags in localStorage, namespaced by the
 * authed user id so a shared browser never leaks onboarding state between
 * accounts:
 *   - `started`: the user has entered first-run mode at least once.
 *   - `done`:    the user has completed their first successful call.
 *
 * Onboarding is "active" while started && !done. Re-entry via `?first=1`
 * clears `done` so the wizard replays even after completion.
 *
 * All access is guarded (`typeof window` + try/catch) to match the defensive
 * style of `lib/storage.ts` — SSR / disabled-storage / quota errors must never
 * crash the Playground.
 */

const STARTED_KEY_PREFIX = 'playground_first_run_started:'
const DONE_KEY_PREFIX = 'playground_first_run_done:'

const FLAG_VALUE = '1'

/** A user id that persistence can key on. Falsy ids skip persistence. */
type UserId = number | string | null | undefined

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function normalizeUserId(userId: UserId): string | null {
  if (userId === null || userId === undefined || userId === '') return null
  return String(userId)
}

function startedKey(userId: string): string {
  return `${STARTED_KEY_PREFIX}${userId}`
}

function doneKey(userId: string): string {
  return `${DONE_KEY_PREFIX}${userId}`
}

/** Mark that the user has entered first-run onboarding at least once. */
export function markFirstRunStarted(userId: UserId): void {
  const id = normalizeUserId(userId)
  if (!id || !isStorageAvailable()) return
  try {
    window.localStorage.setItem(startedKey(id), FLAG_VALUE)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to mark first-run started:', error)
  }
}

/** Mark first-run onboarding complete so it won't reshow on later returns. */
export function markFirstRunDone(userId: UserId): void {
  const id = normalizeUserId(userId)
  if (!id || !isStorageAvailable()) return
  try {
    window.localStorage.setItem(doneKey(id), FLAG_VALUE)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to mark first-run done:', error)
  }
}

/** Clear the done flag so an explicit `?first=1` re-triggers onboarding. */
export function clearFirstRunDone(userId: UserId): void {
  const id = normalizeUserId(userId)
  if (!id || !isStorageAvailable()) return
  try {
    window.localStorage.removeItem(doneKey(id))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear first-run done:', error)
  }
}

/** True while onboarding should persist: started and not yet completed. */
export function isFirstRunActive(userId: UserId): boolean {
  const id = normalizeUserId(userId)
  if (!id || !isStorageAvailable()) return false
  try {
    const started = window.localStorage.getItem(startedKey(id)) === FLAG_VALUE
    const done = window.localStorage.getItem(doneKey(id)) === FLAG_VALUE
    return started && !done
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to read first-run state:', error)
    return false
  }
}
