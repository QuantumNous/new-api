import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import type { IBarChartSpec } from '../../../../src/index';
import type { ITheme } from '../../../../src/theme';

// 方式一：直接注册主题，主题中直接配置函数
const directThemeName = 'local-theme-function-direct'; // 直接注册主题名
const directTheme: ITheme = {
  series: {
    bar: {
      bar: {
        style: {
          fill: datum => (datum.value < 0 ? '#f53f3f' : '#00b42a'),
          fillOpacity: datum => (Math.abs(datum.value) >= 50 ? 1 : 0.65)
        },
        state: {
          hover: {
            stroke: '#1d2129',
            lineWidth: datum => (Math.abs(datum.value) >= 50 ? 4 : 2)
          }
        }
      }
    }
  }
};
VChart.ThemeManager.registerTheme(directThemeName, directTheme);

// 方式二：注册函数，主题中引用函数名
const registeredThemeName = 'local-theme-function-registered'; // 注册函数的主题名
const registeredFillName = 'local.theme.barFill'; // 函数名
VChart.registerFunction(registeredFillName, datum => (datum.value < 0 ? '#ff7d00' : '#165dff'));
const registeredTheme: ITheme = {
  series: {
    bar: {
      bar: {
        style: {
          fill: registeredFillName
        },
        state: {
          hover: {
            stroke: '#1d2129',
            lineWidth: 3
          }
        }
      }
    }
  }
};
VChart.ThemeManager.registerTheme(registeredThemeName, registeredTheme);

VChart.ThemeManager.setCurrentTheme(directThemeName);
const spec: IBarChartSpec = {
  type: 'bar',
  data: [
    {
      id: 'data',
      values: [
        { category: '收入', value: 86 },
        { category: '退款', value: -42 },
        { category: '订阅', value: 58 },
        { category: '成本', value: -67 }
      ]
    }
  ],
  xField: 'category',
  yField: 'value',
  animation: false,
  title: {
    visible: true,
    text: '主题回调控制图元样式',
    subtext: '绿色/红色：主题直接配置函数；蓝色/橙色：主题引用 registerFunction 注册名'
  },
  bar: {
    state: {
      hover: {}
    }
  },
  label: {
    visible: true,
    position: 'outside'
  }
};
const cs = new VChart(spec, {
  dom: document.getElementById('chart') as HTMLElement,
  mode: isMobile ? 'mobile-browser' : 'desktop-browser',
  //theme: 'dark',
  onError: err => {
    console.error(err);
  }
});
console.time('renderTime');

cs.renderAsync().then(() => {
  console.timeEnd('renderTime');
});

window['vchart'] = cs;
console.log(cs);
