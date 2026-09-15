import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { VChart } from '../../../src/vchart-all';
import { createCanvas, removeDom } from '../../util/dom';
import type { IHeatmapChartSpec } from '../../../src';

/**
 * 热力图 Rect 单元尺寸验证（支持非等宽高）
 * - 验证系列默认形状为 'rect'
 * - 验证单元图元的 size 返回二维并在 X/Y 轴带宽不等时宽高不同
 */
describe('heatmap rect cell size', () => {
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

  it('rect shape and non-equal size per cell', async () => {
    const dataSet = new DataSet();
    dataSet.registerParser('csv', csvParser);
    const dataView = new DataView(dataSet);

    // x 两类，y 四类，确保轴带宽不同
    const data = `x,y,v\nA,1,10\nA,2,20\nA,3,30\nA,4,40\nB,1,50\nB,2,60\nB,3,70\nB,4,80`;
    dataView.parse(data, { type: 'csv' });

    vchart = new VChart(
      {
        type: 'heatmap',
        xField: 'x',
        yField: 'y',
        valueField: 'v',
        data: dataView,
        animation: false,
        tooltip: { visible: false }
      } as IHeatmapChartSpec,
      {
        renderCanvas: canvasDom,
        autoFit: true,
        animation: false
      }
    );

    await vchart.renderAsync();

    const series = vchart.getChart().getAllSeries()[0];
    expect(series.getDefaultShapeType()).toBe('rect');

    const datum = (series as any).getViewData().latestData[0];
    const cellMark = (series as any).getActiveMarks()[0];
    const size = cellMark.getAttribute('size', datum);

    expect(Array.isArray(size)).toBe(true);
    expect(size.length).toBe(2);
    expect(size[0]).not.toBe(size[1]);
  });
});
