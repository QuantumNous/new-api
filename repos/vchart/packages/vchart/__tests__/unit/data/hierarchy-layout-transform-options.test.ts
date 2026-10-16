import { treemapLayout } from '../../../src/data/transforms/treemap';
import { vennLayout } from '../../../src/data/transforms/venn';
import { disk } from '../../data/disk';

describe('hierarchy layout transform options', () => {
  test('treemap resolves lazy layout options on every transform run', () => {
    let maxDepth = 1;
    const options = () => ({
      nameField: 'name',
      valueField: 'value',
      getViewBox: () => ({ x0: 0, x1: 500, y0: 0, y1: 500 }),
      maxDepth,
      minVisibleArea: 0
    });

    const first = treemapLayout(disk, options as unknown as Parameters<typeof treemapLayout>[1]);
    expect(first.every(datum => datum.depth <= 1)).toBe(true);

    maxDepth = 2;

    const second = treemapLayout(disk, options as unknown as Parameters<typeof treemapLayout>[1]);
    expect(second.some(datum => datum.depth === 2)).toBe(true);
  });

  test('venn resolves lazy layout options on every transform run', () => {
    let setField = 'sets';
    const options = () => ({
      setField,
      valueField: 'size',
      getViewBox: () => ({ x0: 0, x1: 200, y0: 0, y1: 200 })
    });
    const data = [{ sets: ['A'], nextSets: ['B'], size: 10 }];

    const first = vennLayout(data, options as unknown as Parameters<typeof vennLayout>[1]);
    expect(first[0].sets).toEqual(['A']);

    setField = 'nextSets';

    const second = vennLayout(data, options as unknown as Parameters<typeof vennLayout>[1]);
    expect(second[0].sets).toEqual(['B']);
  });
});
