import { isMobile } from 'react-device-detect';
import { VChart } from '../../../../src/vchart-simple';

const run = () => {
  const mockData: any[] = [];
  const types = ['A', 'B', 'C'];

  types.forEach(type => {
    for (let i = 1; i <= 12; i++) {
      mockData.push({ month: i + '月', value: Math.random() * 100 + 10, type });
    }
  });

  const lineChart = new VChart(
    {
      type: 'line',
      width: 300,
      height: 300,
      data: [
        {
          values: mockData
        }
      ],
      xField: 'month',
      yField: 'value',
      seriesField: 'type',
      legends: {
        visible: true
      },
      label: {
        visible: true
      },
      crosshair: {
        xField: { visible: true },
        yField: { visible: true }
      }
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );

  lineChart.renderAsync();

  const barChart = new VChart(
    {
      type: 'bar',
      width: 300,
      height: 300,
      data: [
        {
          values: mockData
        }
      ],
      xField: 'month',
      yField: 'value',
      seriesField: 'type',
      legends: {
        visible: true
      },
      label: {
        visible: true
      },
      crosshair: {
        xField: { visible: true },
        yField: { visible: true }
      }
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  barChart.renderAsync();

  const pieChart = new VChart(
    {
      type: 'pie',
      data: [
        {
          id: 'id0',
          values: [
            { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
            { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
            { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
            { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
            { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
            { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
            { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
            { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
          ]
        }
      ],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      pie: {
        style: {
          cornerRadius: 10,
          texture: datum => datum['texture']
        },
        state: {
          hover: {
            outerRadius: 0.85,
            stroke: '#000',
            lineWidth: 1
          },
          selected: {
            outerRadius: 0.85,
            stroke: '#000',
            lineWidth: 1
          }
        }
      },
      legends: {
        visible: true,
        orient: 'left',
        item: {
          shape: {
            style: {
              symbolType: 'circle',
              texture: datum => datum['texture']
            }
          }
        }
      },
      tooltip: {
        mark: {
          content: [
            {
              key: datum => datum['type'],
              value: datum => datum['value'] + '%'
            }
          ]
        }
      },
      label: {
        visible: true
      }
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  pieChart.renderAsync();
};
run();
