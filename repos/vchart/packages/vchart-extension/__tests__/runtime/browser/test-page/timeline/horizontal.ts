import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

const timelineData = [
  {
    id: 'q1',
    quarter: '2023 年 Q1',
    title: '项目启动',
    detail: '· 团队组建\n· 确定技术选型',
    position: 'top',
    color: '#8f69ff',
    time: 1
  },
  {
    id: 'q2',
    quarter: '2023 年 Q2',
    title: '产品 MVP',
    detail: '· 完成核心功能开发\n· 发布内测版本',
    position: 'bottom',
    color: '#4c7dff',
    time: 2
  },
  {
    id: 'q3',
    quarter: '2023 年 Q3',
    title: '市场推广',
    detail: '· 线上营销活动\n· 拓展商企合作伙伴',
    position: 'top',
    color: '#f4c21f',
    time: 3
  },
  {
    id: 'q4',
    quarter: '2023 年 Q4',
    title: 'A 轮融资',
    detail: '· 完成融资千万\n· 扩大研发团队',
    position: 'bottom',
    color: '#f39b3d',
    time: 4
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
  name: 'timeline-horizontal',
  direction: 'horizontal',
  padding: {
    left: 80,
    right: 80,
    top: 120,
    bottom: 120
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
        visible: false
      },
      tick: {
        visible: false
      },
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      }
    }
  ],
  series: [
    {
      type: 'event',
      dataId: 'timeline-data',
      timeField: 'time',
      eventField: 'title',
      subTitleField: 'detail',
      dotTypeField: 'quarter',
      labelPosition: 'top-bottom',
      dot: {
        style: {
          size: 12,
          fill: (datum: Datum) => String((datum as Record<string, unknown>).color ?? '')
        }
      },
      title: {
        style: {
          fill: '#2e2f32',
          fontSize: 14,
          fontWeight: 600
        }
      },
      subTitle: {
        style: {
          fill: '#6b6f76',
          fontSize: 12,
          lineHeight: 18
        }
      }
    }
  ],
  tooltip: {
    mark: {
      title: {
        value: (datum?: Datum) => getDatumString(datum, 'title')
      },
      content: [
        {
          key: '季度',
          value: (datum?: Datum) => getDatumString(datum, 'quarter')
        },
        {
          key: '内容',
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
