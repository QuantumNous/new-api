// src/services/session.server.ts
import { useSession } from '@tanstack/solid-start/server'
import type { User } from '~/prisma-generated/client'

type SessionUser = {
  userEmail: User['email']
}

export function useAppSession() {
  return useSession<SessionUser>({
    password: 'ChangeThisBeforeShippingToProdOrYouWillBeFired',
  })
}
