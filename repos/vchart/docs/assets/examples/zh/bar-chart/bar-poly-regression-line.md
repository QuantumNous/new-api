---
category: examples
group: bar chart
title: 基础条形图
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/bar-regression-line.png
option: barChart
---

# 简单柱图+回归线

## 关键配置

通过在 `appendBarRegressionLineConfig` 方法中传入不同的配置项，可以为柱图添加多条不同阶数和样式的回归线。

- `degree`：多项式回归的阶数，如 2 表示二次多项式，3 表示三次多项式。
- `color`：回归线的颜色。
- `line.style`：回归线的样式配置，如 `lineWidth` 表示线宽。
- `confidenceInterval.visible`：是否显示置信区间，布尔值。
- `confidenceInterval.style`：置信区间的样式配置，如 `fillOpacity` 表示透明度。
- `label.text`：回归线的标签文本。

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { appendBarRegressionLineConfig, registerRegressionLine } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { appendBarRegressionLineConfig, registerRegressionLine } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  xField: 'name',
  yField: 'value'
};

registerRegressionLine();
appendBarRegressionLineConfig(spec, [
  {
    degree: 2,
    color: 'red',
    line: {
      style: {
        lineWidth: 2
      }
    },
    confidenceInterval: {
      visible: false
    },
    label: {
      text: '2次多项式拟合'
    }
  },
  {
    degree: 3,
    color: 'green',
    line: {
      style: {
        lineWidth: 2
      }
    },
    confidenceInterval: {
      style: {
        fillOpacity: 0.2
      }
    },
    label: {
      text: '3次多项式拟合'
    }
  }
]);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
