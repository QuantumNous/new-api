---
category: demo
group: tooltip
title: 自定义 tooltip 内容行
keywords: tooltip
order: 26-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/tooltip/custom-mark-tooltip.png
option: funnelChart#tooltip
---

# 自定义 mark tooltip

默认 tooltip 支持根据 mark 的类型不同配置不同的 tooltip 内容。

## 代码演示

```javascript livedemo
const spec = {
  type: 'funnel',
  maxSize: '50%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  funnelOrient: 'top',
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#005FC5', '#2778E2', '#4E91FF', '#70ABFF', '#8FC7FF', '#AEE2FF']
  },
  padding: 0,
  funnel: {
    style: {
      borderRadius: 4,
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        cursor: 'default',
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  transform: {
    interactive: true,
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  tooltip: {
    mark: {
      title: { visible: false },
      content: (data, params) => {
        if (params.mark.name === 'funnel') {
          return [
            {
              hasShape: true,
              key: datum => `Resume Screening（${datum['name']}）`,
              isKeyAdaptive: true
            },
            {
              hasShape: false,
              key: 'Value:',
              value: datum => datum['value']
            },
            {
              hasShape: false,
              key: 'Transform Ratio:',
              value: datum => Math.round(datum['__VCHART_FUNNEL_TRANSFORM_RATIO'] * 10000) / 100 + '%'
            }
          ];
        } else {
          return {
            hasShape: false,
            key: 'Transform Ratio:',
            value: datum => Math.round(datum['__VCHART_FUNNEL_REACH_RATIO'] * 10000) / 100 + '%'
          };
        }
      }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: null
    }
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: false,
    line: {
      style: {
        lineDash: [2, 2]
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'black'
    }
  },
  data: [
    {
      name: 'funnel',
      values: [
        {
          name: 'China',
          value: 130
        },
        {
          name: 'Zhejiang',
          value: 115
        },
        {
          name: 'Hangzhou',
          value: 80
        },
        {
          name: 'Yuhang',
          value: 40
        }
      ]
    }
  ],
  legends: [
    {
      visible: true,
      type: 'discrete',
      orient: 'bottom',
      position: 'middle',
      padding: {
        top: 10
      },
      item: {
        padding: [0, 0, 0, 0],
        shape: {
          space: 4
        },
        label: {
          space: 16,
          style: {
            fill: '#646A73'
          }
        }
      }
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
