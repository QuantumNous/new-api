import { sankeyLayout, type ISankeyOpt } from '../../../src/data/transforms/sankey';

describe('sankey transform options', () => {
  test('resolves lazy layout options on every transform run without mutating source links', () => {
    let valueField = 'amount';
    const options = () =>
      ({
        view: () => ({ x0: 0, x1: 200, y0: 0, y1: 200 }),
        sourceField: 'from',
        targetField: 'to',
        valueField,
        nodeWidth: 10,
        nodeGap: 8
      } as ISankeyOpt);
    const data = [
      {
        links: [{ from: 'A', to: 'B', amount: 1, nextAmount: 2 }]
      }
    ];

    const first = sankeyLayout(
      data as unknown as Parameters<typeof sankeyLayout>[0],
      options as unknown as Parameters<typeof sankeyLayout>[1]
    );
    expect(first[0].links[0].value).toBe(1);
    expect(data[0].links[0]).toEqual({ from: 'A', to: 'B', amount: 1, nextAmount: 2 });

    valueField = 'nextAmount';

    const second = sankeyLayout(
      data as unknown as Parameters<typeof sankeyLayout>[0],
      options as unknown as Parameters<typeof sankeyLayout>[1]
    );
    expect(second[0].links[0].value).toBe(2);
    expect(data[0].links[0]).toEqual({ from: 'A', to: 'B', amount: 1, nextAmount: 2 });
  });
});
