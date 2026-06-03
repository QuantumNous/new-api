import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAffiliateLogsExportQuery,
  buildAffiliateLogsParams,
  buildAffiliateLogsQuery,
  buildAffiliateLogsCsv,
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
        tokenName: ' team-token ',
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

  test('builds scoped export query without pagination params', () => {
    assert.equal(
      buildAffiliateLogsExportQuery({
        p: 3,
        page_size: 20,
        model_name: 'gpt-4',
        group: 'default',
        user_id: 200,
      }),
      '/api/affiliate/logs/export?model_name=gpt-4&group=default&user_id=200'
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
      '¥17.5'
    )
    assert.equal(formatRawQuota(2500), '2,500')
  })

  test('keeps tiny affiliate RMB values visible through the shared formatter', () => {
    assert.equal(
      formatAffiliateRmbFromQuota(
        1,
        {
          quotaPerUnit: 1000,
          usdExchangeRate: 1,
        },
        2
      ),
      '¥0.01'
    )
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

  test('prefers backend unavailable messages for default parity with classic', () => {
    assert.equal(
      getAffiliateUnavailableMessage(
        'not_opened',
        '分销功能未开通，请联系管理员开通。',
        t
      ),
      '分销功能未开通，请联系管理员开通。'
    )
  })

  test('exports affiliate logs with RMB primary amount and raw quota appendix', () => {
    const csv = buildAffiliateLogsCsv(
      [
        {
          id: 1,
          user_id: 200,
          created_at: 1780416000,
          type: 2,
          content: '',
          username: '',
          token_name: 'secret-token',
          model_name: 'gpt-4o,mini',
          quota: 2500,
          prompt_tokens: 12,
          completion_tokens: 34,
          use_time: 456,
          is_stream: false,
          channel: 9,
          channel_name: 'secret-channel',
          token_id: 88,
          group: 'default',
          ip: '127.0.0.1',
          other: '',
          request_id: 'req-secret',
          upstream_request_id: 'upstream-secret',
        },
      ],
      {
        quotaPerUnit: 1000,
        usdExchangeRate: 7,
      }
    )

    const lines = csv.split('\n')
    assert.equal(
      lines[0],
      'time,user_id,username,type,model,group,consumption_rmb,raw_quota'
    )
    assert.match(lines[1], /^2026-/)
    assert.match(lines[1], /,200,,2,"gpt-4o,mini",default,¥17\.5,2500$/)
    assert.equal(csv.includes('secret-channel'), false)
    assert.equal(csv.includes('secret-token'), false)
    assert.equal(csv.includes('req-secret'), false)
  })
})
