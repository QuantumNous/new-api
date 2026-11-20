import { flatten } from '../../utils/flatten';

describe('flatten', () => {
  it('should flatten form values into flat form data', () => {
    expect(
      flatten({
        hey: 'test',
        array: [
          {
            test: '1',
            test2: '2',
            test3: null,
          },
        ],
        test: {
          nested: {
            test: 'bill',
            test3: null,
          },
        },
        test1: null,
      }),
    ).toMatchSnapshot();
  });

  it('should preserve Date values as leaf nodes and not drop them', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');

    expect(flatten({ name: 'Alice', createdAt: date, age: 30 })).toEqual({
      name: 'Alice',
      createdAt: date,
      age: 30,
    });
  });

  it('should preserve nested Date values as leaf nodes', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');

    expect(flatten({ range: { start, end }, label: 'year' })).toEqual({
      'range.start': start,
      'range.end': end,
      label: 'year',
    });
  });
});
