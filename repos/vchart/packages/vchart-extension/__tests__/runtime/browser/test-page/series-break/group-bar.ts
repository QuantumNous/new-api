import { IBarChartSpec, default as VChart } from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '../../../../../src';

const monthes = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dataGroup1 = [44, 128, 180, 345, 3050, 3590, 3840, 3630, 3120, 420, 240, 80];
const dataGroup2 = [64, 138, 164, 408, 3120, 3540, 3875, 3420, 720, 320, 160, 20];

const source = [];
for (let index = 0; index < monthes.length; index++) {
  const month = monthes[index];

  source.push({
    month,
    value: dataGroup1[index],
    type: 'Attraction 1'
  });

  source.push({
    month,
    value: dataGroup2[index],
    type: 'Attraction 2'
  });
}
const spec = {
  type: 'bar',
  height: 500,
  data: {
    values: source
  },
  xField: ['month', 'type'],
  yField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'left',
      breaks: [
        {
          range: [500, 3000]
        }
      ],
      domainLine: {
        visible: true
      }
    }
  ]
};

const run = () => {
  registerSeriesBreak();
  appendSeriesBreakConfig(spec as IBarChartSpec);

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();
