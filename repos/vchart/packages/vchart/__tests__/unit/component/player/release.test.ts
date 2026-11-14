import type { IBarChartSpec } from '../../../../src';
import VChart from '../../../../src';
import { createDiv, removeDom } from '../../../util/dom';

const dataSpecs = [1, 2].map(value => ({
  data: [
    {
      id: 'data',
      values: [{ country: 'USA', value }]
    }
  ]
}));

const createSpec = (): IBarChartSpec =>
  ({
    type: 'bar',
    width: 300,
    height: 220,
    data: dataSpecs[0].data,
    direction: 'horizontal',
    yField: 'country',
    xField: 'value',
    player: {
      type: 'continuous',
      orient: 'bottom',
      auto: true,
      loop: true,
      interval: 1000,
      specs: dataSpecs,
      slider: {
        railStyle: {
          height: 6
        }
      },
      controller: {
        backward: {
          style: {
            size: 12
          }
        },
        forward: {
          style: {
            size: 12
          }
        },
        start: {
          order: 1,
          position: 'end'
        }
      }
    }
  } as unknown as IBarChartSpec);

describe('player component release', () => {
  let container: HTMLElement;
  let dom: HTMLElement;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
    container.style.width = '300px';
    container.style.height = '220px';
  });

  afterEach(() => {
    removeDom(container);
  });

  it('pauses the VRender player and runs base component cleanup', () => {
    const chart = new VChart(createSpec(), {
      dom,
      animation: false
    });

    chart.renderSync();

    const playerModel = chart.getChart()?.getComponentsByKey('player')[0] as any;
    const playerComponent = playerModel?._playerComponent;
    const pauseSpy = jest.spyOn(playerComponent, 'pause');

    chart.release();

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(playerModel.getOption()).toBeNull();
  });
});
