import { VChart } from '../../../src/vchart-all';
import type { IRadarChartSpec } from '../../../src';
import type { ITheme } from '../../../src/theme';
import { ThemeManager } from '../../../src/theme';
import { createCanvas, removeDom } from '../../util/dom';

describe('radar theme test', () => {
  const themeName = 'radar-theme-area-visible';
  let canvasDom: HTMLCanvasElement;
  let vchart: VChart | undefined;

  beforeEach(() => {
    canvasDom = createCanvas();
    canvasDom.style.position = 'relative';
    canvasDom.style.width = '500px';
    canvasDom.style.height = '500px';
    canvasDom.width = 500;
    canvasDom.height = 500;
  });

  afterEach(() => {
    vchart?.release();
    removeDom(canvasDom);
    ThemeManager.setCurrentTheme('light');
    ThemeManager.removeTheme(themeName);
  });

  it('should preserve radar theme area visibility when chart area only provides style', async () => {
    const theme: ITheme = {
      chart: {
        radar: {
          series: {
            radar: {
              area: {
                visible: true,
                style: {
                  fillOpacity: 0.1,
                  lineDash: [4, 2]
                }
              }
            }
          }
        }
      }
    };

    ThemeManager.registerTheme(themeName, theme);
    ThemeManager.setCurrentTheme(themeName);

    vchart = new VChart(
      {
        type: 'radar',
        data: [
          {
            id: 'radarData',
            values: [
              { key: 'Strength', value: 2 },
              { key: 'Speed', value: 3 },
              { key: 'Shooting', value: 3 }
            ]
          }
        ],
        categoryField: 'key',
        valueField: 'value',
        animation: false,
        tooltip: {
          visible: false
        },
        area: {
          style: {
            fillOpacity: 0.1,
            lineDash: [2, 2]
          }
        }
      } as IRadarChartSpec,
      {
        renderCanvas: canvasDom,
        background: 'yellow',
        autoFit: true,
        animation: false
      }
    );

    await vchart.renderAsync();

    const series = vchart.getChart()?.getAllSeries()?.[0];

    expect(series?.getSpec()?.area?.visible).toBe(true);
    expect(series?.getSpec()?.area?.style?.lineDash).toEqual([2, 2]);
  });

  it('should preserve radar seriesStyle after setting current theme', async () => {
    vchart = new VChart(
      {
        type: 'radar',
        data: [
          {
            id: 'd',
            values: [
              { key: 'A', value: 90, group: 'S1' },
              { key: 'B', value: 60, group: 'S1' },
              { key: 'C', value: 70, group: 'S1' },
              { key: 'D', value: 80, group: 'S1' },
              { key: 'A', value: 40, group: 'S2' },
              { key: 'B', value: 80, group: 'S2' },
              { key: 'C', value: 55, group: 'S2' },
              { key: 'D', value: 65, group: 'S2' }
            ]
          }
        ],
        categoryField: 'key',
        valueField: 'value',
        seriesField: 'group',
        animation: false,
        tooltip: {
          visible: false
        },
        area: {
          visible: true
        },
        seriesStyle: [
          {
            name: 'S1',
            area: {
              style: {
                fill: '#ff00ff',
                fillOpacity: 0.9
              }
            },
            line: {
              style: {
                stroke: '#ff00ff'
              }
            }
          },
          {
            name: 'S2',
            area: {
              style: {
                fill: '#00ffff',
                fillOpacity: 0.9
              }
            },
            line: {
              style: {
                stroke: '#00ffff'
              }
            }
          }
        ],
        axes: [
          { orient: 'radius', min: 0, max: 100, grid: { visible: true } },
          { orient: 'angle', grid: { visible: true } }
        ]
      } as IRadarChartSpec,
      {
        renderCanvas: canvasDom,
        background: 'yellow',
        autoFit: true,
        animation: false
      }
    );

    await vchart.renderAsync();

    const series = vchart.getChart()?.getAllSeries()?.[0];
    const getMarkAttributes = (markName: string) =>
      series
        ?.getMarkInName(markName)
        ?.getGraphics()
        .map(graphic => graphic.attribute);

    expect(getMarkAttributes('area')?.map(attribute => [attribute.fill, attribute.fillOpacity])).toEqual([
      ['#ff00ff', 0.9],
      ['#00ffff', 0.9]
    ]);
    expect(getMarkAttributes('line')?.map(attribute => attribute.stroke)).toEqual(['#ff00ff', '#00ffff']);

    await vchart.setCurrentTheme(vchart.getCurrentThemeName());

    expect(getMarkAttributes('area')?.map(attribute => [attribute.fill, attribute.fillOpacity])).toEqual([
      ['#ff00ff', 0.9],
      ['#00ffff', 0.9]
    ]);
    expect(getMarkAttributes('line')?.map(attribute => attribute.stroke)).toEqual(['#ff00ff', '#00ffff']);
  });
});
