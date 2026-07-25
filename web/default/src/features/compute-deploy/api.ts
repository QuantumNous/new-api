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
import { api } from '@/lib/api'

/**
 * User-facing GPU rental API.
 *
 * WHITELABEL: the backend never serializes the underlying marketplace's
 * provider, host, or offer id. Clients rent by GPU *type* (`gpu_name`); the
 * backend resolves the cheapest concrete offer server-side.
 */

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

/** A rentable GPU offer, provider-agnostic. */
export interface ComputeOffer {
  gpu_name: string
  num_gpus: number
  gpu_ram_gb: number
  cost_per_hour: number
  cpu_cores: number
  ram_gb: number
  disk_gb: number
  reliability: number
}

type ComputeInstanceStatus = 'provisioning' | 'running' | 'stopped' | 'error'

/** A GPU instance the signed-in user has rented. */
export interface ComputeInstance {
  id: number
  label: string
  gpu_name: string
  cost_per_hour: number
  status: ComputeInstanceStatus
  created_time: number
}

/** SSH connection details for an instance the user owns. */
export interface ComputeConnection {
  ssh_host: string
  ssh_port: number
  status: string
  username: string
}

export interface CreateInstanceParams {
  gpu_name: string
  duration_hours: number
  ssh_public_key: string
  disk_gb?: number
}

export const computeDeployKeys = {
  all: ['compute-deploy'] as const,
  offers: () => [...computeDeployKeys.all, 'offers'] as const,
  instances: () => [...computeDeployKeys.all, 'instances'] as const,
  connection: (id: number) =>
    [...computeDeployKeys.all, 'connection', id] as const,
}

export async function getComputeOffers(): Promise<
  ApiResponse<{ items: ComputeOffer[] }>
> {
  const res = await api.get('/api/compute/gpu-offers')
  return res.data
}

export async function getMyInstances(): Promise<
  ApiResponse<{ items: ComputeInstance[] }>
> {
  const res = await api.get('/api/compute/instances')
  return res.data
}

export async function getInstanceConnection(
  id: number
): Promise<ApiResponse<ComputeConnection>> {
  const res = await api.get(`/api/compute/instances/${id}/connection`)
  return res.data
}

export async function createInstance(
  params: CreateInstanceParams
): Promise<ApiResponse<{ id: number; status: string; charged_quota: number }>> {
  const res = await api.post('/api/compute/instances', params)
  return res.data
}

export async function stopInstance(
  id: number
): Promise<ApiResponse<{ id: number; status: string }>> {
  const res = await api.post(`/api/compute/instances/${id}/stop`, {})
  return res.data
}

/** Collapse many offers per GPU model to one card at the cheapest price. */
export function cheapestByGpu(offers: ComputeOffer[]): ComputeOffer[] {
  const byGpu = new Map<string, ComputeOffer>()
  for (const o of offers) {
    const prev = byGpu.get(o.gpu_name)
    if (!prev || o.cost_per_hour < prev.cost_per_hour) {
      byGpu.set(o.gpu_name, o)
    }
  }
  return Array.from(byGpu.values()).sort(
    (a, b) => a.cost_per_hour - b.cost_per_hour
  )
}
