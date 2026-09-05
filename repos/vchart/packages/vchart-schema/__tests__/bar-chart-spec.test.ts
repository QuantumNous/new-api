// @ts-nocheck
import Schema from '../vchart.json';
import Ajv from 'ajv';
import semver from 'semver';

describe('IBarChartSpec validation', () => {
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

  it('should throw errors when use property that version is not match', () => {
    const spec = {
      type: 'bar',
      data: {
        values: []
      },
      xField: 'x',
      yField: 'y',
      axes: [
        {
          orient: 'bottom',
          sampling: false
        }
      ]
    };

    const result = validate(spec);

    expect(result).toBeFalsy();
    expect(validate.errors.length).toBeGreaterThan(0);
  });

  it('should return true when spec is correct.', () => {
    const spec = {
      type: 'bar',
      data: {
        values: []
      },
      xField: 'x',
      yField: 'y'
    };

    const result = validate(spec);

    expect(result).toBeTruthy();
    expect(validate.errors).toBeNull();
  });
});
