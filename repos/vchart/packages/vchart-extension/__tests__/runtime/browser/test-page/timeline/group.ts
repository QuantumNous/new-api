import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

const timelineData = [
  {
    id: 'alpha-plan',
    group: '研发',
    stage: '计划',
    time: 1,
    event: '需求评审',
    detail: 'PRD 评审'
  },
  {
    id: 'alpha-design',
    group: '设计',
    stage: '设计',
    time: 2,
    event: '视觉稿',
    detail: '核心页面'
  },
  {
    id: 'alpha-dev',
    group: '研发',
    stage: '开发',
    time: 3,
    event: '功能联调',
    detail: '基础功能'
  },
  {
    id: 'alpha-test',
    group: '研发',
    stage: '测试',
    time: 4,
    event: '灰度验证',
    detail: '核心流程'
  },
  {
    id: 'alpha-campaign',
    group: '运营',
    stage: '运营',
    time: 5,
    event: '上线预热',
    detail: '活动物料'
  },
  {
    id: 'alpha-launch',
    group: '运营',
    stage: '发布',
    time: 6,
    event: '正式上线',
    detail: '全量发布'
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
  name: 'timeline-group',
  direction: 'horizontal',
  padding: {
    left: 80,
    right: 40,
    top: 20,
    bottom: 40
  },
  data: [
    {
      id: 'timeline-data',
      values: timelineData
    }
  ],
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      label: {
        formatMethod: (value: string | string[]) => {
          const raw = Array.isArray(value) ? value[0] : value;
          return raw ? `第${raw}阶段` : '';
        }
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
          key: '分组',
          value: (datum?: Datum) => getDatumString(datum, 'group')
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
