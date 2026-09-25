---
category: examples
group: pie
title: 饼图富文本自动省略
keywords: pieChart,comparison,composition,proportion,circle,richtext
order: 6-5
cover: /vchart/preview/pie-richtext-autoEllipsis_1.12.1.png
option: pieChart
---

# 饼图富文本自动省略

## 关键配置

- `label.formatMethod`: 通过返回 `type:'rich'` 类型的方法进行富文本配置；
- 饼图富文本会默认计算一个合适的宽度，当文字较长时，会自动换行。
  - `label.style.disableAutoWrapLine`: 该配置会禁用富文本自动换行的逻辑，当文字过长时，会被自动省略。

## 代码演示

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'This is a long Auto-Ellipsis Category Text for Category1', value: 24 },
        { type: 'Category2', value: 20 },
        { type: 'Category3', value: 18 },
        { type: 'Category4', value: 18 },
        { type: 'Category5', value: 16 },
        {
          type: 'This is a long Auto-Ellipsis Category Text for Category6. This is a long Auto-Ellipsis Category Text for Category6',
          value: 14
        }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  legends: {
    visible: true
  },
  label: {
    visible: true,
    formatMethod: (label, data) => {
      return {
        type: 'rich',
        text: [
          {
            text: `${data.value}%\n`,
            fill: 'rgba(0, 0, 0, 0.92)',
            fontSize: 16,
            fontWeight: 500,
            stroke: false
          },
          {
            text: data.type,
            fill: 'rgba(0, 0, 0, 0.55)',
            fontSize: 12,
            fontWeight: 400,
            stroke: false
          }
        ]
      };
    },
    style: {
      disableAutoWrapLine: true
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
