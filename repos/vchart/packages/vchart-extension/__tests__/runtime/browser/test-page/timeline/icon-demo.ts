import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

/**
 * Icon 功能演示 - 水平布局示例
 * 展示 iconMark 与 title 关于 lineMark 对称的效果
 */

const timelineData = [
  {
    id: '1',
    year: '2021',
    title: '产品发布',
    detail: '发布第一代产品，获得市场认可',
    icon: 'star',
    time: 1,
    color: '#4A90E2'
  },
  {
    id: '2',
    year: '2022',
    title: '技术突破',
    detail: '核心技术获得重大突破',
    icon: 'triangleUp',
    time: 2,
    color: '#50C8C8'
  },
  {
    id: '3',
    year: '2023',
    title: '市场扩展',
    detail: '业务覆盖全国主要城市',
    icon: 'diamond',
    time: 3,
    color: '#F5A623'
  },
  {
    id: '4',
    year: '2024',
    title: '国际化',
    detail: '进军国际市场，开启新篇章',
    icon: 'cross',
    time: 4,
    color: '#9B59B6'
  }
];

const spec: ITimelineChartSpec = {
  type: 'timeline',
  name: 'icon-demo',
  direction: 'horizontal',
  padding: {
    left: 60,
    right: 60,
    top: 120,
    bottom: 120
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
    text: 'Icon 功能演示',
    subtext: 'iconMark 与 title 关于 lineMark 对称显示',
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
      eventField: 'title',
      subTitleField: 'detail',
      labelPosition: 'top-bottom',
      dotLabelGap: 8,
      dot: {
        style: {
          size: 10,
          fill: (datum: Datum) => String((datum as Record<string, unknown>).color ?? '#4A90E2'),
          stroke: '#fff',
          lineWidth: 2
        }
      },
      icon: {
        style: {
          size: 24,
          fill: (datum: Datum) => String((datum as Record<string, unknown>).color ?? '#4A90E2')
        }
      },
      title: {
        style: {
          fill: '#333',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      subTitle: {
        style: {
          fill: '#666',
          fontSize: 12,
          lineHeight: 18
        }
      },
      line: {
        style: {
          stroke: '#c0c3c7',
          lineWidth: 2
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
