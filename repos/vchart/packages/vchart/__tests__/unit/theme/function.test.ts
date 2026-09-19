import { ThemeManager, type ITheme } from '../../../src/theme';
import type { IBarSeriesSpec } from '../../../src/series/bar/interface';
import { functionTransform } from '../../../src/util/spec/transform';
import { mergeSpec } from '@visactor/vutils-extension';

const data = [
  { category: 'positive', value: 10 },
  { category: 'negative', value: -5 }
];

describe('theme function style', () => {
  const directThemeName = 'theme-function-direct';
  const registeredThemeName = 'theme-function-registered';
  const overrideThemeName = 'theme-function-override';
  const registeredFunctionName = 'theme.function.barFill';

  const functions = new Map<string, (datum: (typeof data)[number]) => string>();
  const functionRegistry = {
    getFunction: (key: string) => functions.get(key) ?? null
  };

  afterEach(() => {
    ThemeManager.removeTheme(directThemeName);
    ThemeManager.removeTheme(registeredThemeName);
    ThemeManager.removeTheme(overrideThemeName);
    functions.clear();
  });

  const transformBarSpec = (themeName: string, bar?: IBarSeriesSpec['bar']) => {
    const currentTheme = ThemeManager.getTheme(themeName);
    const barTheme = functionTransform(currentTheme.series?.bar?.bar, functionRegistry);
    return mergeSpec({}, barTheme, bar);
  };

  it('supports callbacks in theme mark styles and states', () => {
    const theme: ITheme = {
      series: {
        bar: {
          bar: {
            style: {
              fill: datum => (datum.value < 0 ? 'red' : 'green')
            },
            state: {
              hover: {
                lineWidth: datum => (datum.value < 0 ? 1 : 3)
              }
            }
          }
        }
      }
    };
    ThemeManager.registerTheme(directThemeName, theme);

    const spec = transformBarSpec(directThemeName);
    const fill = spec.style?.fill;
    const hoverLineWidth = spec.state?.hover?.lineWidth;

    expect(typeof fill).toBe('function');
    expect((fill as (datum: (typeof data)[number]) => string)(data[0])).toBe('green');
    expect((fill as (datum: (typeof data)[number]) => string)(data[1])).toBe('red');
    expect(typeof hoverLineWidth).toBe('function');
    expect((hoverLineWidth as (datum: (typeof data)[number]) => number)(data[0])).toBe(3);
    expect((hoverLineWidth as (datum: (typeof data)[number]) => number)(data[1])).toBe(1);
  });

  it('resolves registered function names in theme mark styles', () => {
    functions.set(registeredFunctionName, (datum: (typeof data)[number]) => (datum.value < 0 ? 'red' : 'green'));
    ThemeManager.registerTheme(registeredThemeName, {
      series: {
        bar: {
          bar: {
            style: {
              fill: registeredFunctionName
            }
          }
        }
      }
    });

    const spec = transformBarSpec(registeredThemeName);
    const fill = spec.style?.fill;

    expect(typeof fill).toBe('function');
    expect((fill as (datum: (typeof data)[number]) => string)(data[0])).toBe('green');
    expect((fill as (datum: (typeof data)[number]) => string)(data[1])).toBe('red');
  });

  it('keeps mark spec styles at a higher priority than theme callbacks', () => {
    ThemeManager.registerTheme(overrideThemeName, {
      series: {
        bar: {
          bar: {
            style: {
              fill: () => 'red'
            }
          }
        }
      }
    });

    const spec = transformBarSpec(overrideThemeName, {
      style: {
        fill: 'blue'
      }
    });

    expect(spec.style?.fill).toBe('blue');
  });
});
