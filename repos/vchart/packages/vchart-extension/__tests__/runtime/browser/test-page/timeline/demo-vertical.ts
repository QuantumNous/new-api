import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

/**
 * 企业发展时间线 - 垂直布局示例
 * 参考设计图复现
 */

const timelineData = [
  {
    id: '01',
    year: '2018年',
    title: '企业成立，完成初期团队搭建和产品定位',
    time: 1,
    color: '#4A90E2'
  },
  {
    id: '02',
    year: '2020年',
    title: '发布首款核心产品，打开区域市场',
    time: 2,
    color: '#50C8C8'
  },
  {
    id: '03',
    year: '2021年',
    title: '启动数字化平台，提升内部运营效率',
    time: 3,
    color: '#F5A623'
  },
  {
    id: '04',
    year: '2022年',
    title: '完成A轮融资，加速市场拓展布局',
    time: 4,
    color: '#9B59B6'
  },
  {
    id: '05',
    year: '2024年',
    title: '推进生态合作，拓展全国影响力',
    time: 5,
    color: '#5B6AE0'
  }
];

const spec: ITimelineChartSpec = {
  type: 'timeline',
  name: 'enterprise-development',
  direction: 'vertical',
  padding: {
    left: 200,
    right: 200,
    top: 80,
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
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    },
    subtextStyle: {
      fontSize: 14,
      fill: '#666'
    }
  },
  series: [
    {
      type: 'event',
      dataId: 'timeline-data',
      timeField: 'time',
      eventField: 'year',
      subTitleField: 'title',
      labelPosition: 'left-right',
      dot: {
        style: {
          size: 14,
          fill: (datum: Datum) => String((datum as Record<string, unknown>).color ?? '#4A90E2'),
          stroke: '#fff',
          lineWidth: 2
        }
      },
      title: {
        style: {
          fill: '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      subTitle: {
        style: {
          fill: '#666',
          fontSize: 13,
          lineHeight: 20
        }
      },
      line: {
        style: {
          stroke: 'red',
          lineWidth: 3
        }
      }
    }
  ]
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
