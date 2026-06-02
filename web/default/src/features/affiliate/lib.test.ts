import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAffiliateLogsParams,
  buildAffiliateLogsQuery,
  formatAffiliateRmbFromQuota,
  formatRawQuota,
  getAffiliateUnavailableMessage,
} from './lib'

const t = (key: string) => key

describe('default affiliate helpers', () => {
  test('builds scoped logs params without unsupported sensitive filters', () => {
    const params = buildAffiliateLogsParams(
      {
        model: 'gpt-4',
        group: ' default ',
        userId: '200',
        secondLevelUserId: '100',
        requestStatus: 'success',
        startTime: '2026-06-03T00:00:00.000Z',
        endTime: '2026-06-03T01:00:00.000Z',
      },
      2,
      20
    )

    assert.deepEqual(
      {
        p: params.p,
        page_size: params.page_size,
        model_name: params.model_name,
        group: params.group,
        user_id: params.user_id,
        second_level_user_id: params.second_level_user_id,
        request_status: params.request_status,
      },
      {
        p: 2,
        page_size: 20,
        model_name: 'gpt-4',
        group: 'default',
        user_id: 200,
        second_level_user_id: 100,
        request_status: 'success',
      }
    )
    assert.equal(Object.keys(params).includes('channel'), false)
    assert.equal(Object.keys(params).includes('token_name'), false)
    assert.equal(Object.keys(params).includes('request_id'), false)
  })

  test('builds affiliate logs query', () => {
    assert.equal(
      buildAffiliateLogsQuery({
        p: 1,
        page_size: 10,
        model_name: 'gpt-4',
        user_id: 200,
      }),
      '/api/affiliate/logs?p=1&page_size=10&model_name=gpt-4&user_id=200'
    )
  })

  test('formats RMB as the primary affiliate amount', () => {
    assert.equal(
      formatAffiliateRmbFromQuota(
        2500,
        {
          quotaPerUnit: 1000,
          usdExchangeRate: 7,
        },
        2
      ),
      '¥17.50'
    )
    assert.equal(formatRawQuota(2500), '2,500')
  })

  test('maps unavailable reasons to friendly messages', () => {
    assert.equal(
      getAffiliateUnavailableMessage('module_disabled', '', t),
      'Affiliate module is disabled'
    )
    assert.equal(
      getAffiliateUnavailableMessage(undefined, '', t),
      'Affiliate feature is unavailable'
    )
  })
})
