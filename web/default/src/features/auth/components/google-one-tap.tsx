/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { useEffect } from 'react'
import { buildGoogleOneTapLoginUri } from '../lib/google-one-tap'

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

type GoogleOneTapProps = {
  clientId?: string
  enabled: boolean
  returnTo?: string
}

export function GoogleOneTap({
  clientId,
  enabled,
  returnTo,
}: GoogleOneTapProps) {
  const normalizedClientId = clientId?.trim()

  useEffect(() => {
    if (!enabled || !normalizedClientId) return
    if (document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [enabled, normalizedClientId])

  if (!enabled || !normalizedClientId) return null

  return (
    <div
      id='g_id_onload'
      data-auto_prompt='true'
      data-client_id={normalizedClientId}
      data-context='signin'
      data-itp_support='true'
      data-login_uri={buildGoogleOneTapLoginUri(returnTo)}
      data-use_fedcm_for_prompt='true'
    />
  )
}
