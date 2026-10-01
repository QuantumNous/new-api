import { IBarChartSpec, default as VChart } from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '../../../../../src';

const spec = {
  height: 400,
  type: 'bar',
  data: {
    values: [
      {
        country: 'USA',
        visits: 23725
      },
      {
        country: 'China',
        visits: 1882
      },
      {
        country: 'Japan',
        visits: 1809
      },
      {
        country: 'Germany',
        visits: 1322
      },
      {
        country: 'UK',
        visits: 1122
      },
      {
        country: 'France',
        visits: 1114
      },
      {
        country: 'India',
        visits: 984
      },
      {
        country: 'Spain',
        visits: 711
      },
      {
        country: 'Netherlands',
        visits: 665
      },
      {
        country: 'Russia',
        visits: 580
      },
      {
        country: 'South Korea',
        visits: 443
      },
      {
        country: 'Canada',
        visits: 441
      }
    ]
  },
  xField: 'country',
  yField: 'visits',
  axes: [
    {
      orient: 'left',
      breaks: [
        {
          scopeType: 'count',
          range: [2100, 22900]
        },
        {
          range: [700, 900]
        }
      ],
      domainLine: {
        visible: true
      }

      // sampling: false
      // max: 24000
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
