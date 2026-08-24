/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
export function buildGoogleOneTapLoginUri(returnTo?: string): string {
  const safeReturnTo =
    returnTo?.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/dashboard'
  return `/api/oauth/google/one-tap?${new URLSearchParams({ return_to: safeReturnTo })}`
}
