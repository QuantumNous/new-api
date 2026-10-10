// src/services/session.server.ts
import { useSession } from '@tanstack/react-start/server'
import type { User } from '@prisma/client'

type SessionUser = {
  userEmail: User['email']
}

export function useAppSession() {
  return useSession<SessionUser>({
    password: 'ChangeThisBeforeShippingToProdOrYouWillBeFired',
  })
}
