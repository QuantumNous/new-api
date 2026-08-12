import { isMobile } from 'react-device-detect';
import { VChart } from '../../../../src/core';
import { BarChart } from '../../../../src/chart';
import { CartesianBandAxis, CartesianLinearAxis } from '../../../../src/component';

VChart.useChart([BarChart]);
VChart.useComponent([CartesianBandAxis, CartesianLinearAxis]);

const run = () => {
  const mockData: any[] = [];
  const types = ['A', 'B', 'C'];

  types.forEach(type => {
    for (let i = 1; i <= 12; i++) {
      mockData.push({ month: i + '月', value: Math.random() * 100 + 10, type });
    }
  });

  const barChart = new VChart(
    {
      type: 'bar',
      data: [
        {
          values: mockData
        }
      ],
      xField: 'month',
      yField: 'value',
      seriesField: 'type'
    },
    {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    }
  );
  barChart.renderAsync();
};
run();
