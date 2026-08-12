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
});
