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
