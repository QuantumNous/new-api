/**
 * 使用说明:
 * !important: 运行前请先进行 vchart 的 build
 * 然后执行 node line-chart.js 即可
 */
const fs = require('fs');

const VChart = require('../../../cjs/index');
const Canvas = require('canvas');
// const { container } = require('@visactor/vrender');
// const { nodeLoader } = require('@visactor/vrender-kits');

// // 加载node环境的loader
// nodeLoader(container);

// 正常的图表 spec 配置
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value'
};

const cs = new VChart.default(spec, {
  // 声明使用的渲染环境以及传染对应的渲染环境参数
  mode: 'node',
  modeParams: Canvas,
  animation: false
});

cs.renderSync();

const buffer = cs.getImageBuffer();
fs.writeFileSync(`./chart.png`, buffer);
