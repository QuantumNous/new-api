// @ts-nocheck
import Schema from '../vchart.json';
import Ajv from 'ajv';
import semver from 'semver';

describe('IPieChartSpec validation', () => {
  let validate;
  beforeAll(() => {
    const currentVersion = '1.0.0';
    // 新增的属性都是升级的中间版本，所以只要比中间版本高就可以了
    function isGreaterThan(version: string, middleVersion: string): boolean {
      const result = semver.compare(
        `${semver.major(currentVersion)}.${semver.minor(currentVersion)}.0`,
        `${semver.major(middleVersion)}.${semver.minor(middleVersion)}.0`
      );
      return result === undefined ? false : result >= 0;
    }

    const ajv = new Ajv({
      strictSchema: false,
      allowUnionTypes: true
    });
    // ajvKeywords(ajv);

    ajv.addKeyword({
      keyword: 'since',
      validate: function validate2(schema) {
        // @ts-ignore
        validate2.errors = [
          {
            keyword: 'since',
            message: `The version used by this attribute must not be lower than ${schema}`,
            params: { keyword: 'since' }
          }
        ];
        return schema ? isGreaterThan(currentVersion, schema) : true;
      },
      errors: true
    });

    // validate is a type guard for MyData - type is inferred from schema type
    validate = ajv.compile(Schema);
  });

  it('should return true when spec is correct.', () => {
    const spec = {
      type: 'pie',
      title: {
        text: '饼图'
      },
      data: {
        values: [
          { type: 'oxygen', value: '46.60' },
          { type: 'silicon', value: '27.72' },
          { type: 'aluminum', value: '8.13' },
          { type: 'iron', value: '5' },
          { type: 'calcium', value: '3.63' },
          { type: 'potassium', value: '2.59' },
          { type: 'others', value: '3.5' }
        ]
      },
      valueField: 'value',
      categoryField: 'type',
      outerRadius: 0.9,
      label: {
        visible: true,
        position: 'inside',
        style: {
          fill: 'white'
        }
      },
      legends: {
        visible: true
      }
    };
    const result = validate(spec);

    expect(result).toBeTruthy();
    expect(validate.errors).toBeNull();
  });
});
