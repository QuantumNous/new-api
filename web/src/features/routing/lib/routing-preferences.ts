/*
Copyright (C) 2023-2026 QuantumNous
*/

import type { GlobalRoutingFormValues, RoutingPreference } from '../types'

/** The user-facing page always persists the global `*` rule. */
export function toGlobalRoutingPreferences(
  values: GlobalRoutingFormValues
): Record<string, RoutingPreference> {
  return { '*': { ...values } }
}
