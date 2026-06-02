import { describe, expect, test } from 'bun:test';

import {
  buildUsageLogsListUrl,
  buildUsageLogsStatUrl,
} from './usageLogsUrls.js';

const values = {
  username: 'alice',
  token_name: 'secret-token',
  model_name: 'gpt-4o',
  start_timestamp: '2026-06-01 00:00:00',
  end_timestamp: '2026-06-02 00:00:00',
  channel: '9',
  group: 'default',
  request_id: 'req-123',
  request_status: 'error',
  user_id: '200',
  second_level_user_id: '100',
};

describe('usage log URL builders', () => {
  test('builds the existing admin usage log list URL', () => {
    const url = buildUsageLogsListUrl({
      mode: 'default',
      isAdminUser: true,
      page: 2,
      pageSize: 20,
      logType: 2,
      values,
    });

    expect(url).toContain('/api/log/?');
    expect(url).toContain('p=2');
    expect(url).toContain('page_size=20');
    expect(url).toContain('type=2');
    expect(url).toContain('username=alice');
    expect(url).toContain('token_name=secret-token');
    expect(url).toContain('channel=9');
    expect(url).toContain('request_id=req-123');
  });

  test('builds the affiliate scoped list URL without unsupported sensitive filters', () => {
    const url = buildUsageLogsListUrl({
      mode: 'affiliate',
      isAdminUser: true,
      page: 1,
      pageSize: 10,
      logType: 5,
      values,
    });

    expect(url).toContain('/api/affiliate/logs?');
    expect(url).toContain('p=1');
    expect(url).toContain('page_size=10');
    expect(url).toContain('type=5');
    expect(url).toContain('model_name=gpt-4o');
    expect(url).toContain('group=default');
    expect(url).toContain('user_id=200');
    expect(url).toContain('second_level_user_id=100');
    expect(url).toContain('request_status=error');
    expect(url).not.toContain('username=');
    expect(url).not.toContain('token_name=');
    expect(url).not.toContain('channel=');
    expect(url).not.toContain('request_id=');
  });

  test('does not request statistics for affiliate scoped usage logs', () => {
    const url = buildUsageLogsStatUrl({
      mode: 'affiliate',
      isAdminUser: false,
      logType: 2,
      values,
    });

    expect(url).toBeNull();
  });
});
