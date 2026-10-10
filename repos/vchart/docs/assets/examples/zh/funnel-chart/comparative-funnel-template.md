---
category: examples
group: funnel chart
title: 对比漏斗图模板
keywords: funnelChart,composition,trend,template,customMark
cover: /vchart/preview/comparative-funnel-template-1.10.1.png
option: funnelChart
---

# 常用漏斗图模板

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  padding: 10,
  height: 320,
  data: [
    {
      id: 'funnel1',
      values: [
        {
          type: 'A',
          value: 39990,
          name: 'Step1',
          ratio: 0.888
        },
        {
          type: 'A',
          value: 31224,
          name: 'Step2',
          ratio: 0.628
        },
        {
          type: 'A',
          value: 23589,
          name: 'Step3'
        }
      ]
    },
    {
      name: 'funnel2',
      values: [
        {
          type: 'B',
          value: 42810,
          name: 'Step1',
          ratio: 0.888
        },
        {
          type: 'B',
          value: 36327,
          name: 'Step2',
          ratio: 0.628
        },
        {
          type: 'B',
          value: 30454,
          name: 'Step3'
        }
      ]
    }
  ],
  layout: {
    type: 'grid',
    col: 3,
    row: 2,
    colWidth: [
      {
        index: 1,
        size: 120
      }
    ],
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 0,
        colSpan: 3
      },
      {
        modelId: 'left',
        col: 0,
        row: 1
      },
      {
        modelId: 'right',
        col: 2,
        row: 1
      }
    ]
  },
  region: [
    {
      id: 'left'
    },
    {
      id: 'right',
      padding: {
        left: 1
      }
    }
  ],
  seriesField: 'type',
  color: {
    domain: ['A', 'B'],
    range: ['rgb(16,171,254)', 'rgb(255,221,47)']
  },
  series: [
    {
      type: 'funnel',
      dataIndex: 0,
      isTransform: true,
      gap: 2,
      maxSize: '60%',
      shape: 'rect',
      funnelAlign: 'right',
      categoryField: 'name',
      valueField: 'value',
      heightRatio: 1.5,
      funnel: {
        style: {
          fill: { field: 'type', scale: 'color' },
          cornerRadius: 4,
          lineWidth: 0
        }
      },
      transform: {
        style: {
          fill: { field: 'type', scale: 'color' },
          fillOpacity: 0.1
        }
      },
      outerLabel: {
        visible: true,
        line: { visible: false },
        formatMethod: (label, datum) => datum.value,
        style: {
          fontSize: 24,
          fontWeight: 'bold',
          fill: 'black',
          limit: Infinity
        }
      },
      extensionMark: [
        {
          type: 'text',
          dataIndex: 0,
          style: {
            text: data => data.name,
            fontSize: 24,
            fill: 'grey',
            textAlign: 'center',
            x: (data, ctx) => {
              const { vchart } = ctx;
              return vchart.getCurrentSize().width / 2 - 10;
            },
            y: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.y + bl.y) / 2;
            }
          }
        },
        {
          type: 'symbol',
          dataIndex: 0,
          style: {
            fontSize: 18,
            visible: data => !!data.ratio,
            symbolType: 'M 0 -2.5 L 5 -2.5 L 5 1.5 L 0 2.5 L -5 1.5 L -5 -2.5 Z',
            x: (datum, ctx) => {
              const { getPoints } = ctx;
              console.log(datum);
              const [tl, tr, br, bl] = getPoints(datum);
              return (tl.x + tr.x) / 2;
            },
            y: (datum, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(datum);
              return (tl.y + bl.y) / 2 + (bl.y - tl.y) * (0.5 + 1.5 / 2);
            },
            size: 100,
            scaleX: 1.5,
            scaleY: 0.9,
            lineWidth: 1,
            fill: 'white'
          }
        },
        {
          type: 'text',
          dataIndex: 0,
          style: {
            visible: data => !!data.ratio,
            text: data => `${data.ratio * 100}%`,
            fontSize: 18,
            textBaseline: 'middle',
            fill: 'grey',
            x: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.x + tr.x) / 2;
            },
            y: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.y + bl.y) / 2 + (bl.y - tl.y) * (0.5 + 1.5 / 2);
            }
          }
        }
      ]
    },
    {
      type: 'funnel',
      regionIndex: 1,
      dataIndex: 1,
      heightRatio: 1.5,
      shape: 'rect',
      isTransform: true,
      maxSize: '60%',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      funnel: {
        style: {
          fill: { field: 'type', scale: 'color' },
          cornerRadius: 4,
          lineWidth: 0
        }
      },
      transform: {
        style: {
          fill: { field: 'type', scale: 'color' },
          fillOpacity: 0.1
        }
      },
      outerLabel: {
        visible: true,
        line: { visible: false },
        formatMethod: (label, datum) => datum.value,
        style: {
          fontSize: 24,
          fontWeight: 'bold',
          fill: 'black',
          limit: Infinity
        }
      },
      extensionMark: [
        {
          type: 'symbol',
          dataIndex: 1,
          style: {
            visible: data => !!data.ratio,
            symbolType: 'M 0 -2.5 L 5 -2.5 L 5 1.5 L 0 2.5 L -5 1.5 L -5 -2.5 Z',
            x: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.x + tr.x) / 2;
            },
            y: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.y + bl.y) / 2 + (bl.y - tl.y) * (0.5 + 1.5 / 2);
            },
            size: 100,
            scaleX: 1.5,
            scaleY: 0.9,
            lineWidth: 1,
            fill: 'white'
          }
        },
        {
          type: 'text',
          dataIndex: 1,
          style: {
            visible: data => !!data.ratio,
            text: data => `${data.ratio * 100}%`,
            fontSize: 18,
            textBaseline: 'middle',
            fill: 'grey',
            x: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.x + tr.x) / 2;
            },
            y: (data, ctx) => {
              const { getPoints } = ctx;
              const [tl, tr, br, bl] = getPoints(data);
              return (tl.y + bl.y) / 2 + (bl.y - tl.y) * (0.5 + 1.5 / 2);
            }
          }
        }
      ]
    }
  ],

  legends: {
    id: 'legend',
    interactive: false,
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## 相关教程

[漏斗图](link)
