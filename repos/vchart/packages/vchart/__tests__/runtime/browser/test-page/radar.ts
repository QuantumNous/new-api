import { isMobile } from 'react-device-detect';
import type { IRadarChartSpec } from '../../../../src/index';
import { VChart } from '../../../../src/index';

const run = async () => {
  const mockData: any[] = [];
  const types = ['A', 'B', 'C'];

  types.forEach(type => {
    for (let i = 1; i <= 12; i++) {
      mockData.push({ month: i + '月', value: Math.random() * 100 + 10, type });
    }
  });

  const spec: IRadarChartSpec = {
    type: 'radar',
    data: [
      {
        values: mockData
      }
    ],
    categoryField: 'month',
    valueField: 'value',
    seriesField: 'type', // 声明分组字段
    axes: [
      {
        orient: 'radius', // 半径轴配置
        grid: {
          smooth: true, // 平滑的网格线
          style: {
            lineDash: [0]
          },
          alternateColor: '#f5f5f5' // 配置栅格线间的背景色
        }
      },
      {
        orient: 'angle', // 角度轴配置
        tick: {
          visible: false
        },
        domainLine: {
          visible: true,
          style: {
            stroke: '#333'
          }
        },
        grid: {
          style: {
            lineDash: [0]
          }
        }
      }
    ],
    crosshair: {
      categoryField: { visible: true },
      valueField: { visible: true }
    },
    legends: {
      visible: true,
      orient: 'top'
    }
  };
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });

  const c = document.createElement('button');
  c.innerHTML = 'release';
  c.style.marginRight = '5px';
  c.style.marginTop = '5px';
  function releaseChart() {
    cs.release();
    // cs.destroy();
  }
  c.onclick = releaseChart;
  document?.getElementsByTagName('body')[0].appendChild(c);

  const d = document.createElement('button');
  d.innerHTML = 'reRender';
  d.style.marginRight = '5px';
  d.style.marginTop = '5px';
  function reRenderChart() {
    const cs = new VChart(spec, {
      dom: document.getElementById('chart') as HTMLElement,
      //theme: 'dark',
      onError: err => {
        console.error(err);
      }
    });
    console.time('renderTime');

    cs.renderSync();
    window['vchart'] = cs;
  }
  d.onclick = reRenderChart;
  document?.getElementsByTagName('body')[0].appendChild(d);

  window['vchart'] = cs;
  console.log(cs);

  for (let i = 0; i < 1000; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    window['vchart'].release();

    await new Promise(resolve => setTimeout(resolve, 100));
    reRenderChart();
  }
};
run();
