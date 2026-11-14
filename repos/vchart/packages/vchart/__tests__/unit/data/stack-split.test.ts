import { stackSplit } from '../../../src/data/transforms/stack-split';
import { DataSet, csvParser, DataView } from '@visactor/vdataset';

const generateDataSet = () => {
  const dataSet = new DataSet();
  dataSet.registerParser('csv', csvParser);
  const dataView = new DataView(dataSet);

  const data = `x,type,y
1,1,850
1,2,840
2,2,740
2,3,670
3,3,900
4,4,570
5,5,670`;

  dataView.parse(data, {
    type: 'csv'
  });

  return { dataSet, dataView };
};

test('stackSplit of one field', () => {
  const { dataView } = generateDataSet();

  expect(stackSplit([dataView], { fields: ['x'] })).toEqual({
    groupField: 'x',
    nodes: {
      '1': {
        values: [
          { type: '1', x: '1', y: '850' },
          { type: '2', x: '1', y: '840' }
        ]
      },
      '2': {
        values: [
          { type: '2', x: '2', y: '740' },
          { type: '3', x: '2', y: '670' }
        ]
      },
      '3': {
        values: [{ type: '3', x: '3', y: '900' }]
      },
      '4': {
        values: [{ type: '4', x: '4', y: '570' }]
      },
      '5': {
        values: [{ type: '5', x: '5', y: '670' }]
      }
    }
  });
});

test('stackSplit resolves lazy fields on every transform run', () => {
  const { dataView } = generateDataSet();
  let fields = ['x'];
  const options = () => ({ fields });

  expect(stackSplit([dataView], options as unknown as Parameters<typeof stackSplit>[1]).groupField).toBe('x');

  fields = ['type'];

  expect(stackSplit([dataView], options as unknown as Parameters<typeof stackSplit>[1]).groupField).toBe('type');
});

test('stackSplit of one field', () => {
  const { dataView } = generateDataSet();

  expect(stackSplit([dataView], { fields: ['x', 'type'] })).toEqual({
    groupField: 'x',
    nodes: {
      '1': {
        groupField: 'type',
        nodes: {
          '1': {
            values: [{ type: '1', x: '1', y: '850' }]
          },
          '2': {
            values: [{ type: '2', x: '1', y: '840' }]
          }
        }
      },
      '2': {
        groupField: 'type',
        nodes: {
          '2': {
            values: [{ type: '2', x: '2', y: '740' }]
          },
          '3': {
            values: [{ type: '3', x: '2', y: '670' }]
          }
        }
      },
      '3': {
        groupField: 'type',
        nodes: {
          '3': {
            values: [{ type: '3', x: '3', y: '900' }]
          }
        }
      },
      '4': {
        groupField: 'type',
        nodes: {
          '4': {
            values: [{ type: '4', x: '4', y: '570' }]
          }
        }
      },
      '5': {
        groupField: 'type',
        nodes: {
          '5': { values: [{ type: '5', x: '5', y: '670' }] }
        }
      }
    }
  });
});
