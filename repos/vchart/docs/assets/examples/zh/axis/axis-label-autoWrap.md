---
category: demo
group: axis
title: 坐标轴文本自动换行
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-13
cover: /vchart/preview/axis-label-autoWrap_1.12.5.png
option: barChart#axes
---

# 坐标轴文本自动换行

直角坐标系的坐标轴标签提供了超出限制长度自动换行的能力，可以通过 `autoWrap` 属性来开启，同时通过 `label.style.lineClamp` 属性配置换行的最大行数。

目前对于着直角坐标系，y 轴默认垂直方向的展示的限制空间为图表高度或者宽度的 30%，如果你开启了轴标签的 `autoWrap`，一旦轴空间超出限制就会自动换行。

标签自动换行（`autoLimit`） 与 标签自动旋转（`autoRotate`）都是针对文本过长的优化策略，两者不能同时生效，若开启了 `autoRotate`，则优先使用自动旋转策略。

## 关键配置

在 `axes` 属性上为对应方向的轴配置：

- `label.autoWrap` 属性配置为 `true` 来开启轴组件的标签自动换行。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  xField: 'month',
  yField: 'sales',
  width: 300,
  axes: [
    {
      orient: 'left',
      label: {
        autoWrap: true,
        formatter: `++++++++++++++++++_{label}_++++++++++++++++++`
      }
    },
    {
      orient: 'bottom',
      maxHeight: '20%', // Limit maximum height to 20% of chart height
      sampling: false,
      label: {
        formatter: `{label}_{label}`,
        autoWrap: true,
        autoHide: true,
        style: {
          wordBreak: 'break-word',
          lineClamp: 2
        }
      }
    }
  ],
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
