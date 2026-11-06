import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

const timelineData = [
  {
    id: '1',
    year: '2018年',
    step: '01',
    title: '企业成立',
    detail: '完成初期团队搭建和产品定位',
    time: 1,
    color: '#5B8FF9'
  },
  {
    id: '2',
    year: '2020年',
    step: '02',
    title: '发布首款核心产品',
    detail: '打开区域市场',
    time: 2,
    color: '#5AD8A6'
  },
  {
    id: '3',
    year: '2021年',
    step: '03',
    title: '启动数字化平台',
    detail: '提升内部运营效率',
    time: 3,
    color: '#E8684A'
  },
  {
    id: '4',
    year: '2022年',
    step: '04',
    title: '完成A轮融资',
    detail: '加速市场拓展布局',
    time: 4,
    color: '#9270CA'
  },
  {
    id: '5',
    year: '2024年',
    step: '05',
    title: '推进生态合作',
    detail: '拓展全国影响力',
    time: 5,
    color: '#6C5DD3'
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
  name: 'enterprise-development',
  direction: 'vertical',
  padding: {
    left: 200,
    right: 200,
    top: 120,
    bottom: 80
  },
  background: '#f5f5f5',
  data: [
    {
      id: 'timeline-data',
      values: timelineData
    }
  ],
  title: {
    visible: true,
    text: '企业发展时间线',
    subtext: '展示企业在关键年份的战略动作与发展节点',
    textStyle: {
      fontSize: 32,
      fontWeight: 'bold',
      fill: '#1a1a1a'
    }
  },
  axes: [
    {
      orient: 'left',
      type: 'band',
      // inverse: true,
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
      eventField: 'year',
      subTitleField: 'title',
      labelPosition: 'right',
      arrow: {
        visible: false
      },
      dot: {
        style: {
          size: 20,
          fill: (datum: Datum) => String((datum as Record<string, unknown>).color ?? '#5B8FF9'),
          lineWidth: 4,
          stroke: '#ffffff'
        }
      },
      line: {
        style: {
          stroke: '#d9d9d9',
          lineWidth: 4
        }
      },
      title: {
        style: {
          fill: '#1a1a1a',
          fontSize: 18,
          fontWeight: 600
        }
      },
      subTitle: {
        style: {
          fill: '#1a1a1a',
          fontSize: 15,
          fontWeight: 'normal'
        }
      }
    }
  ],
  tooltip: {
    mark: {
      title: {
        value: (datum?: Datum) => getDatumString(datum, 'year')
      },
      content: [
        {
          key: '阶段',
          value: (datum?: Datum) => getDatumString(datum, 'step')
        },
        {
          key: '标题',
          value: (datum?: Datum) => getDatumString(datum, 'title')
        },
        {
          key: '详情',
          value: (datum?: Datum) => getDatumString(datum, 'detail')
        }
      ]
    }
  }
};

declare global {
  interface Window {
    vchartVertical?: VChart;
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
  window.vchartVertical = cs;
};

run();
