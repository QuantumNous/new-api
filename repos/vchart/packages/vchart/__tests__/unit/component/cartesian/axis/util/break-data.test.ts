/**
 *  break-data 的测试用例
 */
import { breakData } from '../../../../../../src/component/axis/mixin/util/break-data';

describe('break data ', () => {
  it('break data by break points when scopeType is "length"', () => {
    const data = [
      44, 108, 128, 266, 180, 344, 345, 753, 3050, 6170, 3590, 7130, 3840, 7715, 3630, 7050, 3120, 3840, 420, 740, 240,
      400, 80, 100
    ];
    const breakPoints = [500, 3000];
    const { domain, scope } = breakData(data, breakPoints, 'length');

    expect(domain).toStrictEqual([
      [44, 500],
      [500, 3000],
      [3000, 7715]
    ]);

    expect(scope.length).toEqual(3);
    expect(scope[0][0]).toBeCloseTo(0);
    expect(scope[0][1]).toBeCloseTo(0.06136455389584174);
    expect(scope[1][0]).toBeCloseTo(0.06136455389584174);
    expect(scope[1][1]).toBeCloseTo(0.36549589557260126);
    expect(scope[2][0]).toBeCloseTo(0.36549589557260126);
    expect(scope[2][1]).toBeCloseTo(1);
  });

  it('break data by break points when scopeType is "count"', () => {
    const data = [
      44, 108, 128, 266, 180, 344, 345, 753, 3050, 6170, 3590, 7130, 3840, 7715, 3630, 7050, 3120, 3840, 420, 740, 240,
      400, 80, 100
    ];
    const breakPoints = [500, 3000];
    const { domain, scope } = breakData(data, breakPoints, 'count');

    expect(domain).toStrictEqual([
      [44, 500],
      [500, 3000],
      [3000, 7715]
    ]);

    expect(scope.length).toEqual(3);
    expect(scope[0][0]).toBeCloseTo(0);
    expect(scope[0][1]).toBeCloseTo(0.5);
    expect(scope[1][0]).toBeCloseTo(0.5);
    expect(scope[1][1]).toBeCloseTo(0.5833333333333334);
    expect(scope[2][0]).toBeCloseTo(0.5833333333333334);
    expect(scope[2][1]).toBeCloseTo(1);
  });
});
