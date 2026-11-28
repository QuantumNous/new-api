import type { IBarChartSpec } from '../../../src';
import VChart from '../../../src';
import { createDiv, removeDom } from '../../util/dom';

const createSpec = (value: number): IBarChartSpec => ({
  type: 'bar',
  width: 300,
  height: 200,
  data: [
    {
      id: 'data',
      values: [{ country: 'USA', value }]
    }
  ],
  direction: 'horizontal',
  yField: 'country',
  xField: 'value'
});

describe('vchart release update guards', () => {
  let container: HTMLElement;
  let dom: HTMLElement;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    container.style.width = '300px';
    container.style.height = '200px';
  });

  afterEach(() => {
    removeDom(container);
  });

  it('ignores updateSpec calls after release', async () => {
    const chart = new VChart(createSpec(1), {
      dom,
      animation: false
    });

    chart.renderSync();
    chart.release();

    expect(() => chart.updateSpecSync(createSpec(2))).not.toThrow();
    await expect(chart.updateSpec(createSpec(3))).resolves.toBe(chart);
    expect(() => chart.updateFullDataSync({ id: 'data', values: [{ country: 'USA', value: 4 }] })).not.toThrow();
  });
});
