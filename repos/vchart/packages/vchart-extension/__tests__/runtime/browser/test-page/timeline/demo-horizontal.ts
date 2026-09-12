import { VChart, type Datum } from '@visactor/vchart';
import { registerTimelineChart } from '../../../../../src';
import type { ITimelineChartSpec } from '../../../../../src/charts/timeline';

/**
 * 企业优势列表 - 水平布局示例
 * 参考设计图复现
 */

const timelineData = [
  {
    id: '1',
    year: '2021',
    title: '品牌影响力',
    detail: '在目标用户群中具备较强认知与信任度',
    time: 1,
    color: '#4A90E2'
  },
  {
    id: '2',
    year: '2022',
    title: '技术研发力',
    detail: '拥有自研核心系统与持续创新能力',
    time: 2,
    color: '#50C8C8'
  },
  {
    id: '3',
    year: '2023',
    title: '市场增长快',
    detail: '近一年用户规模实现快速增长',
    time: 3,
    color: '#F5A623'
  },
  {
    id: '4',
    year: '2020',
    title: '服务满意度',
    detail: '用户对服务体系整体评分较高',
    time: 4,
    color: '#9B59B6'
  },
  {
    id: '5',
    year: '2022',
    title: '数据资产全',
    detail: '构建了完整用户标签与画像体系',
    time: 5,
    color: '#8E44AD'
  },
  {
    id: '6',
    year: '2023',
    title: '创新能力强',
    detail: '新产品上线频率高于行业平均',
    time: 6,
    color: '#2ECC71'
  }
];

const spec: ITimelineChartSpec = {
  type: 'timeline',
  name: 'enterprise-advantages',
  direction: 'horizontal',
  padding: {
    left: 60,
    right: 60,
    top: 150,
    bottom: 150
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
    text: '企业优势列表',
    subtext: '展示企业在不同维度上的核心优势与表现值',
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
      dot: {
        style: {
          size: 12,
          fill: (datum: Datum) => String((datum as Record<string, unknown>).color ?? '#4A90E2'),
          stroke: '#fff',
          lineWidth: 2
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
