---
category: demo
group: title
title: 自定义样式标题
keywords: title
order: 24-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/title/style-title.png
option: lineChart#title
---

# 自定义样式标题

标题样式支持自定义

## 关键配置

- `textStyle` 属性声明主标题样式。可用于配置文本填充、文本瞄边、文本下划线、文本字体、文本大小等各种文本配置。
- `subtextStyle` 属性声明副标题样式。可用于配置文本填充、文本瞄边、文本下划线、文本字体、文本大小等各种文本配置。
- `align` 属性声明文字水平对齐方式, 支持 `'left' | 'center' | 'right'` 三种对齐方式
- `verticalAlign` 属性声明文字垂直对齐方式, 支持 `'top' | 'middle' | 'bottom'` 三种对齐方式

## 代码演示

```javascript livedemo
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
  yField: 'value',
  title: {
    visible: true,
    text: 'line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.',
    align: 'left',
    verticalAlign: 'top',
    textStyle: {
      stroke: '#333',
      lineWidth: 3,
      fill: '#468DFF',
      fontSize: 24
    },
    subtextStyle: {
      visible: true,
      fontStyle: 'italic',
      underline: 1
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
