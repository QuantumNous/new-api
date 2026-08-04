/*
Copyright (C) 2025 QuantumNous

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

import { expect, test } from 'bun:test';
import { buildDashboardAnalysisCsv, formatAnalysisPeriod } from './analysisCsv';

const parseCsv = (input) => {
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' && text[index + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
    } else {
      cell += character;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

test('empty analysis produces no CSV payload', () => {
  expect(buildDashboardAnalysisCsv({ rows: [], isAdminUser: true })).toBe('');
});

test('CSV period formatting is fixed to Asia/Shanghai', () => {
  // 2024-01-01 00:00:00 CST, regardless of the browser/worker local timezone.
  expect(formatAnalysisPeriod(1704038400)).toBe('2024-1-1 00:00:00');
});

test('admin CSV preserves formula safety and amount conservation', () => {
  const csv = buildDashboardAnalysisCsv({
    isAdminUser: true,
    dimensions: [
      'period',
      'username',
      'model_name',
      'token_name',
      'group',
      'channel',
    ],
    quotaPerUnit: 500000,
    t: (value) => value,
    rows: [
      {
        period: 1704067200,
        username: '=2+3',
        model_name: '+MODEL',
        token_name: '-TOKEN',
        group: ' @GROUP',
        channel_id: 44,
        request_count: 1,
        prompt_tokens: 2,
        completion_tokens: 3,
        quota: 500000,
      },
      {
        period: 1704070800,
        username: 'normal',
        model_name: '@MODEL',
        token_name: 'quoted,"token"',
        group: 'line\nvalue',
        channel_id: 35,
        request_count: 2,
        prompt_tokens: 4,
        completion_tokens: 5,
        quota: 250000,
      },
    ],
  });

  expect(csv.startsWith('\uFEFF')).toBe(true);
  const rows = parseCsv(csv);
  const header = rows[0];
  const amountIndex = header.indexOf('消费金额（USD）');
  expect(amountIndex).toBeGreaterThan(-1);
  expect(Number(rows[1][amountIndex]) + Number(rows[2][amountIndex])).toBe(1.5);

  expect(rows[1][1]).toBe("'=2+3");
  expect(rows[1][2]).toBe("'+MODEL");
  expect(rows[1][3]).toBe("'-TOKEN");
  expect(rows[1][4]).toBe("' @GROUP");
  expect(rows[2][2]).toBe("'@MODEL");
  expect(rows[2][3]).toBe('quoted,"token"');
});

test('CSV follows the dimensions returned by the analysis query', () => {
  const csv = buildDashboardAnalysisCsv({
    isAdminUser: true,
    dimensions: ['period', 'model_name'],
    quotaPerUnit: 500000,
    rows: [
      {
        period: 1704067200,
        username: 'hidden-user',
        model_name: 'visible-model',
        token_name: 'hidden-token',
        group: 'hidden-group',
        channel_id: 48,
        request_count: 1,
        quota: 500000,
      },
    ],
  });

  const rows = parseCsv(csv);
  expect(rows[0]).toEqual([
    '时间',
    '模型',
    '成功请求数',
    '输入 Tokens',
    '输出 Tokens',
    '消费金额（USD）',
  ]);
  expect(rows[1]).toEqual([
    '2024-1-1 08:00:00',
    'visible-model',
    '1',
    '0',
    '0',
    '1.000000',
  ]);
});

test('user CSV never exports admin-only dimensions', () => {
  const csv = buildDashboardAnalysisCsv({
    isAdminUser: false,
    dimensions: ['period', 'username', 'model_name', 'channel'],
    rows: [
      {
        period: 1704067200,
        username: 'must-not-export',
        model_name: 'visible-model',
        channel_id: 49,
        request_count: 1,
      },
    ],
  });

  const rows = parseCsv(csv);
  expect(rows[0]).toEqual([
    '时间',
    '模型',
    '成功请求数',
    '输入 Tokens',
    '输出 Tokens',
    '消费金额（USD）',
  ]);
  expect(rows[1][1]).toBe('visible-model');
  expect(rows[1]).not.toContain('must-not-export');
  expect(rows[1]).not.toContain('49');
});

test('CSV fails closed when the response omits dimensions metadata', () => {
  const csv = buildDashboardAnalysisCsv({
    isAdminUser: true,
    rows: [
      {
        period: 1704067200,
        username: 'must-not-export',
        model_name: 'must-not-export',
        request_count: 1,
      },
    ],
  });

  const rows = parseCsv(csv);
  expect(rows[0]).toEqual([
    '成功请求数',
    '输入 Tokens',
    '输出 Tokens',
    '消费金额（USD）',
  ]);
  expect(rows[1]).toEqual(['1', '0', '0', '0.000000']);
});
