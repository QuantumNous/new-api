import { DEFAULT_MAP_LOOK_UP_KEY } from '../../../src/constant/data';
import { lookup, type ILookUpOpt } from '../../../src/data/transforms/lookup';
import { map, type IMapOpt } from '../../../src/data/transforms/map';

describe('map and lookup transform options', () => {
  test('map resolves lazy name options on every transform run', () => {
    let nameProperty = 'name';
    let nameMap: Record<string, string> = { Alpha: 'A' };
    const options = () =>
      ({
        nameMap,
        nameProperty
      } as IMapOpt);
    const data = {
      features: [
        {
          properties: {
            name: 'Alpha',
            code: 'Beta'
          }
        }
      ]
    };

    const first = map(data as Parameters<typeof map>[0], options as unknown as Parameters<typeof map>[1]);
    expect(first[0][DEFAULT_MAP_LOOK_UP_KEY]).toBe('A');

    nameProperty = 'code';
    nameMap = { Beta: 'B' };

    const second = map(data as Parameters<typeof map>[0], options as unknown as Parameters<typeof map>[1]);
    expect(second[0][DEFAULT_MAP_LOOK_UP_KEY]).toBe('B');
  });

  test('lookup resolves lazy field options on every transform run', () => {
    let fields = 'name';
    const options = {
      from: () => [
        { name: 'A', value: 1 },
        { code: 'A', value: 2 }
      ],
      key: 'lookupKey',
      fields: () => fields,
      values: ['value'],
      as: ['matchedValue']
    };
    const data = [{ lookupKey: 'A' }];

    const first = lookup(
      data as unknown as Parameters<typeof lookup>[0],
      options as unknown as ILookUpOpt
    ) as unknown as Array<Record<string, unknown>>;
    expect(first[0].matchedValue).toBe(1);

    fields = 'code';

    const second = lookup(
      data as unknown as Parameters<typeof lookup>[0],
      options as unknown as ILookUpOpt
    ) as unknown as Array<Record<string, unknown>>;
    expect(second[0].matchedValue).toBe(2);
  });
});
