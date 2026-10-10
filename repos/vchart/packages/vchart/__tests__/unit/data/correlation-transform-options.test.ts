import { correlation, type ICorrelationOpt } from '../../../src/data/transforms/correlation';
import { correlationCenter, type ICorrelationCenterOpt } from '../../../src/data/transforms/correlation-center';
import { CORRELATION_X, CORRELATION_Y } from '../../../src/constant/correlation';

describe('correlation transform options', () => {
  test('resolves lazy layout options on every transform run', () => {
    let center: [number, number] = [100, 100];
    const options: ICorrelationOpt = {
      view: () => ({ x0: 0, x1: 200, y0: 0, y1: 200 }),
      field: 'value',
      center: () => center,
      innerRadius: 40,
      outerRadius: 40,
      radiusRange: [5, 5] as [number, number],
      startAngle: 0,
      endAngle: 0
    };

    const first = correlation([{ category: 'a', value: 1 }], options) as Record<string, number>[];
    expect(first[0][CORRELATION_X]).toBeCloseTo(140);
    expect(first[0][CORRELATION_Y]).toBeCloseTo(100);

    center = [60, 80];

    const second = correlation([{ category: 'a', value: 1 }], options) as Record<string, number>[];
    expect(second[0][CORRELATION_X]).toBeCloseTo(100);
    expect(second[0][CORRELATION_Y]).toBeCloseTo(80);
  });

  test('resolves lazy value field options on every transform run', () => {
    let field = 'value';
    const options: ICorrelationOpt = {
      view: () => ({ x0: 0, x1: 200, y0: 0, y1: 200 }),
      field: () => field,
      center: [60, 100],
      innerRadius: 10,
      outerRadius: 50,
      radiusRange: [5, 5] as [number, number],
      startAngle: 0,
      endAngle: 0
    };
    const data = [
      { category: 'a', value: 0, nextValue: 10 },
      { category: 'b', value: 10, nextValue: 10 }
    ];

    const first = correlation(data, options) as Record<string, number>[];
    expect(first[0][CORRELATION_X]).toBeCloseTo(70);

    field = 'nextValue';

    const second = correlation(data, options) as Record<string, number>[];
    expect(second[0][CORRELATION_X]).toBeCloseTo(90);
  });

  test('resolves lazy center data options on every transform run', () => {
    let keyword = 'before';
    let categoryField = 'name';
    const options: ICorrelationCenterOpt = {
      keyword: () => keyword,
      categoryField: () => categoryField
    };
    const data = [{ latestData: [{}] }];

    expect(correlationCenter(data, options)).toMatchObject({ name: 'before' });

    keyword = 'after';
    categoryField = 'label';

    expect(correlationCenter(data, options)).toMatchObject({ label: 'after' });
  });
});
