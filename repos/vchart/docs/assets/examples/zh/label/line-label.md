---
category: examples
group: label
title: 折线图标签
keywords: label
order: 35-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/label/line-label.png
option: lineChart#label
---

# 折线图标签

在图表中，标签是对当前图形所展示数据的信息标注，可以用于解释说明图形的一些数据含义，例如数值、名称等；

## 关键配置

在图元上配置纹理相关的属性即可：

- `label`: 标签配置。
  - `visible`: 显示标签。
  - `style`: 标签样式配置。

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8,
        lowest: true
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
        value: 17,
        highest: true
      },
      {
        time: '14:00',
        value: 17,
        highest: true
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
  yField: 'value',
  label: {
    visible: true,
    style: {
      visible: datum => !!(datum.highest || datum.lowest),
      fontWeight: 'bold',
      text: datum => `${datum.value}°C`,
      fill: datum => {
        if (datum.highest) {
          return 'red';
        }
        if (datum.lowest) {
          return 'rgb(51, 147, 246)';
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[散点图](link)
