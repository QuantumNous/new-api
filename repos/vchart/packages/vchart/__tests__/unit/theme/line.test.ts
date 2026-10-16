import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { VChart } from '../../../src/vchart-all';
import type { ITheme } from '../../../src/theme';
// eslint-disable-next-line no-duplicate-imports
import { ThemeManager } from '../../../src/theme';
import { createCanvas, removeDom } from '../../util/dom';
import type { ILineChartSpec } from '../../../src';
import type { IColorSchemeStruct } from '../../../src/theme/color-scheme/interface';
import { initChartDataSet } from '../../util/context';

describe('theme switch test', () => {
  let canvasDom: HTMLCanvasElement;
  let vchart: VChart;
  beforeEach(() => {
    canvasDom = createCanvas();
    canvasDom.style.position = 'relative';
    canvasDom.style.width = '500px';
    canvasDom.style.height = '500px';
    canvasDom.width = 500;
    canvasDom.height = 500;
  });

  afterEach(() => {
    removeDom(canvasDom);
    vchart.release();
  });

  it('theme switch', async () => {
    const dataSet = new DataSet();
    initChartDataSet(dataSet);
    dataSet.registerParser('csv', csvParser);
    const dataView = new DataView(dataSet);
    const data = `x,type,y
    1,1,850
    2,2,740
    3,3,900
    4,4,570
    5,5,670`;
    dataView.parse(data, {
      type: 'csv'
    });

    vchart = new VChart(
      {
        type: 'line',
        xField: 'x',
        yField: 'y',
        data: dataView,
        animation: false,
        tooltip: {
          visible: false
        }
      } as ILineChartSpec,
      {
        renderCanvas: canvasDom,
        background: 'yellow',
        autoFit: true,
        animation: false
      }
    );

    await vchart.renderAsync();

    const newTheme: ITheme = {
      colorScheme: {
        default: ['red', 'yellow', 'blue']
      },
      series: {
        line: {
          label: {
            visible: false,
            offset: 30,
            style: {}
          },
          point: {
            style: {
              size: 20
            }
          }
        }
      }
    };

    ThemeManager.registerTheme('tmp', newTheme);
    await vchart.setCurrentTheme('tmp');
    const series = vchart?.getChart()?.getAllSeries()?.[0];

    // sepc
    expect(vchart.getCurrentTheme().series?.line?.point?.style?.size).toBe(20);
    expect(series?.getSpec()?.point?.style?.size).toBe(20);

    // mark spec
    expect(vchart.getCurrentTheme().series?.line?.label?.offset).toBe(30);
    expect(series?.getSpec()?.label?.offset).toBe(30);

    // color scheme
    expect((vchart.getCurrentTheme().colorScheme?.default as IColorSchemeStruct)?.dataScheme[0]).toBe('red');
    expect(series?.getSeriesInfoList()[0].style('fill')).toBe('red');
  });

  it('set theme in spec and theme is a string', async () => {
    const dataSet = new DataSet();
    initChartDataSet(dataSet);
    dataSet.registerParser('csv', csvParser);
    const dataView = new DataView(dataSet);
    const data = `x,type,y
    1,1,850
    2,2,740
    3,3,900
    4,4,570
    5,5,670`;
    dataView.parse(data, {
      type: 'csv'
    });
    VChart.ThemeManager.registerTheme('newTheme', {
      background: 'red'
    });

    vchart = new VChart(
      {
        type: 'line',
        xField: 'x',
        yField: 'y',
        data: dataView,
        animation: false,
        tooltip: {
          visible: false
        },
        theme: 'newTheme'
      } as ILineChartSpec,
      {
        renderCanvas: canvasDom,
        background: 'yellow',
        autoFit: true,
        animation: false
      }
    );

    await vchart.renderAsync();
    // await vchart.setCurrentTheme('light');
    // sepc
    expect(vchart.getCompiler().getStage().background).toBe('red');
  });

  it('set theme in spec and theme is an object', async () => {
    const dataSet = new DataSet();
    initChartDataSet(dataSet);
    dataSet.registerParser('csv', csvParser);
    const dataView = new DataView(dataSet);
    const data = `x,type,y
    1,1,850
    2,2,740
    3,3,900
    4,4,570
    5,5,670`;
    dataView.parse(data, {
      type: 'csv'
    });

    vchart = new VChart(
      {
        type: 'line',
        xField: 'x',
        yField: 'y',
        data: dataView,
        animation: false,
        tooltip: {
          visible: false
        },
        theme: {
          background: 'red'
        }
      } as ILineChartSpec,
      {
        renderCanvas: canvasDom,
        background: 'yellow',
        autoFit: true,
        animation: false
      }
    );

    await vchart.renderAsync();
    // spec
    expect(vchart.getCompiler().getStage().background).toBe('red');
    expect(vchart.getCurrentThemeName()).toBe('light');
  });
});
