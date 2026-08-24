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
const CHANNEL_NAME = 'flatkey-registration-email-verification'
const VERIFIED_EVENT_TYPE = 'registration-email-verified'

type RegistrationEmailVerificationMessageListener = (
  event: MessageEvent<unknown>
) => void

export type RegistrationEmailVerificationChannel = {
  postMessage: (message: unknown) => void
  addEventListener: (
    type: 'message',
    listener: RegistrationEmailVerificationMessageListener
  ) => void
  removeEventListener: (
    type: 'message',
    listener: RegistrationEmailVerificationMessageListener
  ) => void
  close: () => void
}

export type RegistrationEmailVerificationChannelFactory =
  () => RegistrationEmailVerificationChannel | null

function createRegistrationEmailVerificationChannel(): RegistrationEmailVerificationChannel | null {
  if (
    typeof window === 'undefined' ||
    typeof window.BroadcastChannel === 'undefined'
  ) {
    return null
  }

  try {
    return new window.BroadcastChannel(CHANNEL_NAME)
  } catch (_error) {
    return null
  }
}

function isRegistrationEmailVerifiedEvent(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === VERIFIED_EVENT_TYPE
  )
}

export function publishRegistrationEmailVerified(
  createChannel: RegistrationEmailVerificationChannelFactory = createRegistrationEmailVerificationChannel
): void {
  const channel = createChannel()
  if (!channel) return

  try {
    channel.postMessage({ type: VERIFIED_EVENT_TYPE })
  } catch (_error) {
    // Focus and visibility refreshes remain available when signaling fails.
  } finally {
    channel.close()
  }
}

export function subscribeRegistrationEmailVerified(
  onVerified: () => void,
  createChannel: RegistrationEmailVerificationChannelFactory = createRegistrationEmailVerificationChannel
): () => void {
  const channel = createChannel()
  if (!channel) return () => undefined

  const handleMessage: RegistrationEmailVerificationMessageListener = (
    event
  ) => {
    if (isRegistrationEmailVerifiedEvent(event.data)) onVerified()
  }

  channel.addEventListener('message', handleMessage)
  return () => {
    channel.removeEventListener('message', handleMessage)
    channel.close()
  }
}
