/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

export function formatInvitationUSD(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0
  return `$${Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value)}`
}
