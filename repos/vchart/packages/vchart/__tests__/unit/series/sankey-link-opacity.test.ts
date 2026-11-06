// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import VChart from '../../../src';
import { createDiv, removeDom } from '../../util/dom';

const createSpec = () => ({
  type: 'sankey',
  padding: 5,
  width: 600,
  height: 400,
  data: [
    {
      values: [
        {
          nodes: [{ nodeName: 'A' }, { nodeName: 'B' }, { nodeName: 'C' }],
          links: [
            { source: 0, target: 1, value: 10 },
            { source: 1, target: 2, value: 8 }
          ]
        }
      ]
    }
  ],
  categoryField: 'nodeName',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  direction: 'vertical',
  nodeAlign: 'start',
  nodeGap: 2,
  nodeWidth: '30%',
  minNodeHeight: 4,
  link: {
    style: {
      fill: '#333333',
      fillOpacity: 0.1
    }
  }
});

describe('sankey link opacity', () => {
  let container: HTMLElement;
  let dom: HTMLElement;
  let chart: VChart;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    container.style.position = 'fixed';
    container.style.width = '600px';
    container.style.height = '400px';
    container.style.top = '0px';
    container.style.left = '0px';
  });

  afterEach(() => {
    chart?.release();
    removeDom(container);
  });

  test('should only render one link path when no runtime ratio is active', () => {
    chart = new VChart(createSpec(), {
      dom,
      animation: false
    });
    chart.renderSync();

    const series = chart.getChart().getAllSeries()[0] as any;
    const link = series._linkMark.getGraphics()[0];
    const [back, front] = link.getSubGraphic();

    expect(link.attribute.fillOpacity).toBe(0.1);
    expect(link.attribute.ratio).toBeUndefined();
    expect(back.attribute.path).toBe('');
    expect(back.attribute.fillOpacity).toBe(0.1);
    expect(front.attribute.path).not.toBe('');
    expect(front.attribute.fillOpacity).toBe(0.1);
  });
});
