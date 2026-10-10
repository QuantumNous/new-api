/**
 * extensionMark syncState 插件功能验证页面
 *
 * 验证场景：
 * 1. Hover bar → extensionMark（圆点 + 文字）同步进入 highlight，其余 blur
 * 2. Click bar → extensionMark 同步 selected 状态
 * 3. 数据更新后重新绑定是否正常
 * 4. API 触发 setHovered 路径
 */
import { default as VChart } from '@visactor/vchart';
import { registerExtensionMarkSyncStatePlugin } from '../../../../../src';

// 注册插件
registerExtensionMarkSyncStatePlugin();

const CONTAINER_ID = 'chart';

const run = () => {
  const data = [
    { category: 'A', value: 80, group: 'February' },
    { category: 'B', value: 120, group: 'February' },
    { category: 'C', value: 60, group: 'February' },
    { category: 'D', value: 150, group: 'February' },
    { category: 'A', value: 90, group: 'March' },
    { category: 'B', value: 100, group: 'March' },
    { category: 'C', value: 110, group: 'March' },
    { category: 'D', value: 70, group: 'March' }
  ];

  const spec: any = {
    type: 'bar',
    data: [{ id: 'barData', values: data }],
    xField: 'category',
    yField: 'value',
    seriesField: 'group',

    bar: {
      state: {
        highlight: {
          stroke: '#000',
          lineWidth: 2
        },
        blur: {
          fillOpacity: 0.2
        },
        selected: {
          stroke: 'red',
          lineWidth: 3
        }
      }
    },

    // ===== extensionMark：在每个 bar 顶部画一个圆点，syncState = true =====
    extensionMark: [
      {
        type: 'symbol',
        dataId: 'barData',
        name: 'topDot',
        syncState: true,
        style: {
          fill: (datum: any) => (datum.group === 'February' ? '#1664FF' : '#1AC6FF'),
          symbolType: 'circle',
          size: 12,
          x: (datum: any, ctx: any) => {
            return (
              ctx.valueToX([datum.category]) +
              ctx.xBandwidth() / 4 +
              (datum.group === 'March' ? ctx.xBandwidth() / 2 : 0)
            );
          },
          y: (datum: any, ctx: any) => {
            return ctx.valueToY([datum.value]) - 15;
          }
        },
        state: {
          highlight: {
            fill: 'orange',
            size: 20,
            stroke: '#000',
            lineWidth: 2
          },
          blur: {
            fillOpacity: 0.15,
            size: 8
          },
          selected: {
            fill: 'red',
            size: 22,
            outerBorder: {
              distance: 3,
              lineWidth: 2,
              stroke: 'red'
            }
          }
        }
      },
      {
        type: 'text',
        dataId: 'barData',
        name: 'topLabel',
        syncState: true,
        style: {
          text: (datum: any) => `${datum.value}`,
          fontSize: 11,
          fill: '#333',
          textAlign: 'center',
          textBaseline: 'bottom',
          x: (datum: any, ctx: any) => {
            return (
              ctx.valueToX([datum.category]) +
              ctx.xBandwidth() / 4 +
              (datum.group === 'March' ? ctx.xBandwidth() / 2 : 0)
            );
          },
          y: (datum: any, ctx: any) => {
            return ctx.valueToY([datum.value]) - 26;
          }
        },
        state: {
          highlight: {
            fill: 'orange',
            fontSize: 16,
            fontWeight: 'bold'
          },
          blur: {
            fillOpacity: 0.1
          },
          selected: {
            fill: 'red',
            fontSize: 14,
            fontWeight: 'bold'
          }
        }
      }
    ],

    // 交互配置
    interaction: {
      hover: {
        enable: true
      },
      select: {
        enable: true
      }
    },

    legends: {
      visible: true,
      orient: 'top',
      interactive: true
    },

    tooltip: {
      visible: true
    },

    title: {
      visible: true,
      text: 'extensionMark syncState 插件验证',
      subtext: 'Hover / Click bar → 观察圆点和数字是否同步状态'
    }
  };

  const vchart = new VChart(spec, { dom: CONTAINER_ID });
  vchart.renderSync();

  // ===== 调试辅助：暴露到 window 方便 DevTools 检查 =====
  (window as any).__vchart__ = vchart;

  // ===== 数据更新按钮：验证数据更新后 syncState 重新绑定 =====
  const btn = document.createElement('button');
  btn.textContent = '更新数据（验证重新绑定）';
  btn.style.cssText = 'margin: 4px 8px; padding: 4px 12px; cursor: pointer;';
  btn.onclick = () => {
    const newData = data.map(d => ({
      ...d,
      value: Math.round(d.value * (0.6 + Math.random() * 0.8))
    }));
    vchart.updateData('barData', newData);
  };
  document.getElementById('controlPanel')?.appendChild(btn);

  // ===== setHovered API 按钮：验证 API 触发路径 =====
  const btnApi = document.createElement('button');
  btnApi.textContent = 'API: setHovered(A-February)';
  btnApi.style.cssText = 'margin: 4px 8px; padding: 4px 12px; cursor: pointer;';
  btnApi.onclick = () => {
    vchart.setHovered({
      category: 'A',
      group: 'February'
    });
  };
  document.getElementById('controlPanel')?.appendChild(btnApi);

  // ===== clearHovered API 按钮 =====
  const btnClear = document.createElement('button');
  btnClear.textContent = 'API: clearHovered';
  btnClear.style.cssText = 'margin: 4px 8px; padding: 4px 12px; cursor: pointer;';
  btnClear.onclick = () => {
    vchart.setHovered(null);
  };
  document.getElementById('controlPanel')?.appendChild(btnClear);

  console.log('%c[syncState 插件验证] VChart 实例已挂载到 window.__vchart__', 'color: green; font-weight: bold;');
  console.log(
    '%c[syncState 插件验证] 可通过以下方式检查图元 key：\n' +
      '  const s = __vchart__.getChart().getAllSeries()[0];\n' +
      '  s.getMarks().forEach(m =>' +
      ' console.log(m.name, m.getGraphics().map(g => ({key: g.context?.key, states: g.currentStates}))))',
    'color: blue;'
  );
};

run();
