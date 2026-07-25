/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { api } from '@/lib/api'
import type {
  ApiEnvelope,
  ModelHealthDetail,
  ModelHealthOverview,
  ModelHealthWindow,
} from './types'

function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope || envelope.success !== true || envelope.data === undefined) {
    throw new Error(envelope?.message || 'Invalid API response')
  }
  return envelope.data
}

export async function getModelHealthOverview(
  hours: ModelHealthWindow
): Promise<ModelHealthOverview> {
  const response = await api.get<ApiEnvelope<ModelHealthOverview>>(
    '/api/data/model_health',
    { params: { hours } }
  )
  return unwrapEnvelope(response.data)
}

export async function getModelHealthDetail(
  model: string,
  hours: ModelHealthWindow
): Promise<ModelHealthDetail> {
  const response = await api.get<ApiEnvelope<ModelHealthDetail>>(
    '/api/data/model_health/detail',
    { params: { model, hours } }
  )
  return unwrapEnvelope(response.data)
}
