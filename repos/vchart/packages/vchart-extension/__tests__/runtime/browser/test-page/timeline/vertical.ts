import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

const timelineData = [
  {
    id: 'alpha-kickoff',
    project: 'Project Alpha',
    group: '研发',
    stage: '立项',
    time: new Date('2024-01-02').getTime(),
    event: '立项',
    detail: '需求确认'
  },
  {
    id: 'alpha-design',
    project: 'Project Alpha',
    group: '研发',
    stage: '设计',
    time: new Date('2024-02-01').getTime(),
    event: '设计',
    detail: '视觉/交互'
  },
  {
    id: 'alpha-release',
    project: 'Project Alpha',
    group: '研发',
    stage: '发布',
    time: new Date('2024-03-01').getTime(),
    event: '发布',
    detail: '对外上线'
  },
  {
    id: 'beta-warmup',
    project: 'Project Beta',
    group: '运营',
    stage: '预热',
    time: new Date('2024-01-06').getTime(),
    event: '预热',
    detail: '内容投放'
  },
  {
    id: 'beta-campaign',
    project: 'Project Beta',
    group: '运营',
    stage: '活动',
    time: new Date('2024-02-05').getTime(),
    event: '活动',
    detail: '主站曝光'
  },
  {
    id: 'beta-review',
    project: 'Project Beta',
    group: '运营',
    stage: '复盘',
    time: new Date('2024-03-05').getTime(),
    event: '复盘',
    detail: '指标总结'
  }
];

const getDatumString = (datum: Datum | undefined, key: string) => {
  if (!datum || typeof datum !== 'object') {
    return '';
  }
  const value = (datum as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
};

const spec: ITimelineChartSpec = {
  type: 'timeline',
  name: 'timeline-vertical',
  direction: 'vertical',
  data: [
    {
      id: 'timeline-data',
      values: timelineData
    }
  ],
  axes: [
    {
      orient: 'left',
      type: 'time',
      label: {
        // formatMethod: (value: string | string[]) => {
        //   const raw = Array.isArray(value) ? value[0] : value;
        //   const timeValue = Number(raw);
        //   if (Number.isFinite(timeValue)) {
        //     return new Date(timeValue).toLocaleDateString();
        //   }
        //   return raw ? String(raw) : '';
        // }
      }
    }
  ],
  series: [
    {
      type: 'event',
      dataId: 'timeline-data',
      timeField: 'time',
      seriesField: 'group',
      eventField: 'event',
      dotTypeField: 'stage',
      title: {
        style: {
          fill: '#2e2f32'
        }
      },
      subTitle: {
        style: {
          fill: '#6b6f76',
          dy: 6
        }
      }
    }
  ],
  tooltip: {
    mark: {
      title: {
        value: (datum?: Datum) => getDatumString(datum, 'event')
      },
      content: [
        {
          key: '项目',
          value: (datum?: Datum) => getDatumString(datum, 'project')
        },
        {
          key: '阶段',
          value: (datum?: Datum) => getDatumString(datum, 'stage')
        },
        {
          key: '说明',
          value: (datum?: Datum) => getDatumString(datum, 'detail')
        }
      ]
    }
  }
};

declare global {
  interface Window {
    vchart?: VChart;
  }
}

const run = () => {
  registerTimelineChart();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    onError: err => {
      console.error(err);
    }
  });
  cs.renderSync();
  window.vchart = cs;
};

run();
