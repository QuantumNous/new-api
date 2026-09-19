---
category: examples
group: pictogram chart
title: 象形图-键盘打字机
keywords: pictogramChart, space
order: 26-1
cover: /vchart/preview/pictogram-keyboard_1.13.0.png
option: pictogramChart
---

# 象形图-键盘打字机

## 关键配置

- 在 SVG 文件中，为图元配置 name 属性，则在图表配置中可以通过 name 配置指定图元样式；

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 1.x版本，在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
// 2.0.0版本，在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart-extension';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
if (VCHART_MODULE.registerPictogramChart) {
  // 1.x 版本执行注册代码
  VCHART_MODULE.registerPictogramChart();
} else if (VChartExtension.registerPictogramChart) {
  // 2.0.0版本执行注册代码
  VChartExtension.registerPictogramChart();
}

const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/keyboard.svg');
const keyboard = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [
      {
        name: 'W',
        value: 1
      },
      {
        name: 'A',
        value: 1
      },
      {
        name: 'S',
        value: 1
      },
      {
        name: 'D',
        value: 1
      }
    ]
  },
  region: [
    {
      roam: { blank: true }
    }
  ],
  nameField: 'name',
  valueField: 'value',
  svg: 'keyboard',
  pictogram: {
    style: {
      fill: datum => {
        return datum.data?.value ? 'rgb(190,204,232)' : 'white';
      },
      fillOpacity: 0.5
    },
    state: {
      selected: {
        fill: 'red'
      }
    }
  }
};

VChart.registerSVG('keyboard', keyboard);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 假设这是你的键盘布局二维数组
const keyboardLayout = [
  // 第一行
  ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  // 第二行
  ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  // 第三行
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  // 第四行
  ['CapsLock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  // 第五行
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  // 第六行
  ['Control', 'Win', 'Alt', 'Space', 'Alt', 'Menu', 'Ctrl']
];

// 将键盘布局转换为一维数组，方便查找
const keys = keyboardLayout.flat();

// 监听键盘按下事件
document.addEventListener('keydown', async event => {
  // 获取按下的键的名称，并确保首字母大写
  const keyName = event.key.charAt(0).toUpperCase() + event.key.slice(1);

  // 检查按下的键是否在我们的键盘布局数组中
  if (keys.includes(keyName)) {
    console.log(`你按下了 ${keyName} 键。`);

    const graphics = vchart.getStage().getElementsByName(keyName);
    if (graphics) {
      graphics.forEach(g => {
        g._originalFill = g.attribute.fill;
        g.setAttributes({ fill: 'red' });
      });
    }
  } else {
    console.log(`你按下了一个不在标准键盘布局中的键：${keyName}`);
  }
});

document.addEventListener('keyup', async event => {
  // 获取按下的键的名称，并确保首字母大写
  const keyName = event.key.charAt(0).toUpperCase() + event.key.slice(1);

  // 检查按下的键是否在我们的键盘布局数组中
  if (keys.includes(keyName)) {
    const graphics = vchart.getStage().getElementsByName(keyName);
    if (graphics) {
      graphics.forEach(g => g.setAttributes({ fill: g._originalFill ?? 'white' }));
    }
  }
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
