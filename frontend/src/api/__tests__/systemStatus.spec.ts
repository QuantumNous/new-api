import { describe, expect, it } from 'vitest'

import { parseSystemStatus } from '@/api/systemStatus'
import { ApiError } from '@/api/types'

function validResponse() {
  return {
    status: 'online',
    scope: 'current_node',
    sampled_at: 1_786_700_000,
    cpu_percent: 34.2,
    memory_used_bytes: 5_583_457_484,
    memory_total_bytes: 17_179_869_184,
    disk_used_bytes: 234_075_717_632,
    disk_total_bytes: 549_755_813_888,
    network_tx_bytes_per_second: 2_202_000,
    network_rx_bytes_per_second: 13_002_300,
    network_series: [
      {
        timestamp: 1_786_699_970,
        tx_bytes_per_second: 1_800_000,
        rx_bytes_per_second: 11_000_000,
      },
    ],
    api_success_rate_24h: 99.7,
    version: 'v1.0.0-test',
  }
}

describe('parseSystemStatus', () => {
  it('parses the complete current-node contract', () => {
    expect(parseSystemStatus(validResponse())).toEqual(validResponse())
  })

  it('preserves nullable independent metrics', () => {
    const response = validResponse()
    response.status = 'degraded'
    response.cpu_percent = null as unknown as number
    response.network_tx_bytes_per_second = null as unknown as number
    response.network_rx_bytes_per_second = null as unknown as number
    response.api_success_rate_24h = null as unknown as number
    expect(parseSystemStatus(response)).toMatchObject({
      status: 'degraded',
      cpu_percent: null,
      network_tx_bytes_per_second: null,
      network_rx_bytes_per_second: null,
      api_success_rate_24h: null,
    })
  })

  it.each([
    { ...validResponse(), status: 'offline' },
    { ...validResponse(), scope: 'all_nodes' },
    { ...validResponse(), cpu_percent: '34.2' },
    { ...validResponse(), cpu_percent: null },
    { ...validResponse(), sampled_at: 0 },
    { ...validResponse(), version: '' },
    {
      ...validResponse(),
      network_series: [{ timestamp: 1, tx_bytes_per_second: -1 }],
    },
  ])('rejects malformed responses', (response) => {
    expect(() => parseSystemStatus(response)).toThrow(ApiError)
  })
})
