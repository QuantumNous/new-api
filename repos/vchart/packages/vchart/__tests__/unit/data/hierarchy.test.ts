import { hierarchyDimensionStatistics } from '../../../src/data/transforms/hierarchy-dimension-statistics';
import { filterHierarchyDataByRange, isHierarchyItem } from '../../../src/util';
import { disk } from '../../data/disk';

describe('hierarchy data statistic test', () => {
  test('test hierarchy dimension statistic', () => {
    const result = hierarchyDimensionStatistics([{ latestData: disk } as any], {
      fields: [
        {
          key: 'name',
          operations: ['values']
        },
        {
          key: 'value',
          operations: ['max', 'min']
        }
      ]
    }) as any;
    expect(result.name.values.length).toEqual(1995);
    expect(result.value.max).toEqual(1512668);
    expect(result.value.min).toEqual(0);
  });

  test('test valid hierarchyData', () => {
    const isHierarchy = disk.some(d => isHierarchyItem(d));
    expect(isHierarchy).toBe(true);
    const data = [
      {
        id: 1,
        value: 10
      },
      {
        id: 5,
        value: 25
      }
    ];
    expect(data.some(d => isHierarchyItem(d))).toBe(false);
  });

  test('filterHierarchyDataByRange', () => {
    const data = [
      {
        id: 1,
        children: [
          {
            id: 2,
            value: 15,
            children: [
              {
                id: 3,
                value: 20
              }
            ]
          },
          {
            id: 4,
            value: 5
          }
        ]
      },
      {
        id: 5,
        value: 25
      }
    ];

    const result = filterHierarchyDataByRange(data, 15, 25);
    expect(data.some(d => isHierarchyItem(d))).toBe(true);
    expect(JSON.stringify(result)).toEqual(
      '[{"id":1,"children":[{"id":2,"value":15,"children":[{"id":3,"value":20}]}]},{"id":5,"value":25}]'
    );
  });
});
