---
category: examples
group: progress
title: 带多种标签的条形进度图
keywords: linearProgress,comparison,rectangle
order: 16-8
cover: /vchart/preview/linear-progress-with-multi-labels_1.5.0.png
option: linearProgressChart
---

# 带多种标签的条形进度图

通过 `extensionMark` 可以为条形进度条添加必要的文本标注。
例如标题标注，目标值标注，进度条内标注，进度条外标注。进度条内标注可根据进度条长度做超长文本省略。

## 关键配置

- `extensionMark.text` 实现文本标注
- `extensionMark.text.style.maxLineWidth` 实现超长文本省略

## 代码演示

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'data',
      values: [
        {
          current: 16068954.132933617,
          name: 'Name',
          percent: '80.34%',
          progress: 0.5356318044311206,
          detail: 'Cur 16,068,954.13 / Goal 20,000,000.00 / Max 30,000,000.00',
          goalProgress: 0.6666666666666666
        }
      ]
    }
  ],
  yField: 'name',
  xField: 'progress',
  cornerRadius: 15,
  bandWidth: 15,
  progress: {
    style: {
      fill: '#f9868c'
    }
  },
  track: {
    style: {
      fill: 'rgba(249, 134, 140, 0.1)'
    }
  },
  axes: [
    {
      visible: true,
      orient: 'right',
      type: 'band',
      domainLine: {
        visible: false
      },
      tick: {
        visible: false
      },
      label: {
        style: {
          visible: true,
          fontSize: 30,
          fill: '#161616',
          fontWeight: 400
        }
      },
      maxWidth: '60%'
    }
  ],
  extensionMark: [
    {
      type: 'text',
      dataId: 'data',
      visible: true,
      style: {
        text: 'Title',
        textAlign: 'start',
        textBaseline: 'bottom',
        fontSize: 16,
        fill: '#666666',
        fontWeight: 500,
        dy: 0,
        x: (_datum, ctx) => {
          return ctx.valueToX([0]);
        },
        y: (datum, ctx) => {
          return ctx.valueToY([datum.name]) - 19;
        }
      }
    },
    {
      type: 'text',
      dataId: 'data',
      visible: true,
      style: {
        text: datum => datum.detail,
        fontWeight: 500,
        fontSize: 16,
        fill: '#666666',
        textAlign: 'start',
        textBaseline: 'top',
        x: (_datum, ctx) => {
          return ctx.valueToX([0]);
        },
        y: (datum, ctx) => {
          return ctx.valueToY([datum.name]) + 15;
        },
        maxLineWidth: (_datum, ctx) => {
          const length = ctx.valueToX([1]) - ctx.valueToX([0]);
          return length;
        }
      }
    },
    {
      type: 'text',
      dataId: 'data',
      visible: true,
      style: {
        text: 'Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~Long Text~~~',
        fontSize: 12,
        fontWeight: 500,
        fill: 'white',
        textAlign: 'center',
        textBaseline: 'middle',
        maxLineWidth: (datum, ctx) => {
          // 进度条有圆角, 需要给文字预留空间.
          const roundPadding = 4;
          return ctx.valueToX([datum.progress]) - roundPadding;
        },
        x: (datum, ctx) => {
          return ctx.valueToX([datum.progress]) / 2;
        },
        y: (datum, ctx) => {
          return ctx.valueToY([datum.name]);
        },
        x1: (datum, ctx) => {
          return ctx.valueToX([datum.progress]);
        },
        y1: (datum, ctx) => {
          return ctx.valueToY([datum.name]);
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[条形进度图](link)
