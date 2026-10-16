# VChart 渐进式渲染教程

在本教程中，我们介绍如何在 VChart 图表库中使用渐进式渲染功能。渐进式渲染可以帮助您在处理大量数据时优化图表性能。在学习本教程之前，请确保您已对 VChart 图表库有基本了解。

## 什么是渐进式渲染

渐进式渲染是一种用于提高图表性能的技术，在处理大量数据时，可以有效减少卡顿和渲染时间。VChart 图表库中的渐进式渲染功能依赖于图表图元中的配置项。比如在柱状图中可以这样配置：

- `barChart.bar.largeThreshold`: 开启大数据渲染优化的阀值
- `barChart.bar.progressiveStep`: 分片长度
- `barChart.bar.progressiveThreshold`: 开启分片渲染的阀值

### 背景知识

在图表绘制过程中，大量数据的处理和渲染可能会占用较多的 CPU 和 GPU 资源，导致图表卡顿或渲染响应时间变长。使用渐进式渲染技术，可以把数据分片处理和渲染，从而平衡资源占用，提高图表展示效果。

## 如何声明渐进式渲染

在 VChart 图表库中，声明渐进式渲染需要在图表对应的图元中设置相关配置项。以下为一个使用渐进式渲染的范例。

```ts
{
  "barChart": {
    "bar": {
      "largeThreshold": 2000,
      "progressiveStep": 500,
      "progressiveThreshold": 8000
    }
  }
}
```

我们来依次说明这些配置项的含义。

### barChart.bar

`barChart.bar` 是一个对象，用于配置区域图元的样式。

### barChart.bar.largeThreshold

`largeThreshold` 是一个数值，表示开启大数据渲染优化的阀值。当数据长度超过该阀值时，VChart 会自动启用大数据优化。

在本示例中，我们设置 `largeThreshold` 为 2000，表示当数据长度超过 2000 时，启用大数据渲染优化。

建议设置 `largeThreshold` 的值小于 `progressiveThreshold`。

### barChart.bar.progressiveStep

`progressiveStep` 是一个数值，表示分片长度。在渲染过程中，数据会被分为多个片段（分片）。每一个分片包含 `progressiveStep` 个数据点。

在本示例中，我们设置 `progressiveStep` 为 500，表示每个分片包含 500 个数据点。

### barChart.bar.progressiveThreshold

`progressiveThreshold` 是一个数值，表示开启分片渲染的阀值。当单系列数据长度超过该阀值时，VChart 会自动启用分片渲染。

在本示例中，我们设置 `progressiveThreshold` 为 8000，表示当单系列数据长度超过 8000 时，启用分片渲染。

## 案例

### 在柱线组合图中开启渐进式渲染

```javascript livedemo
const data0 = [];
const data1 = [];
for (let i = 0; i < 5000; i++) {
  data0.push({
    time: i,
    value: Math.floor(Math.random() * 200)
  });
  data1.push({
    time: i,
    value: Math.floor(Math.random() * 200) + 300
  });
}
const spec = {
  type: 'common',
  data: [
    {
      id: 'data0',
      values: data0
    },
    {
      id: 'data1',
      values: data1
    }
  ],
  color: ['#6690F2'],
  series: [
    {
      data: {
        id: 'data0'
      },
      select: {
        enable: true,
        mode: 'multiple'
      },
      type: 'bar',
      xField: 'time',
      yField: 'value',
      /** 是否开启大数据渲染模式，开启后会降低渲染的精度 */
      large: false,
      /** 开启大数据渲染优化的阀值，对应的是data的长度;推荐 largeThreshold < progressiveThreshold  */
      largeThreshold: 500,
      /** 分片长度 */
      progressiveStep: 100,
      /** 开启分片渲染的阀值，对应的是单系列data的长度 */
      progressiveThreshold: 1000,
      bar: {
        state: {
          hover: {
            fill: 'red',
            zIndex: 4
          },
          hover_reverse: {
            fillOpacity: 0.5
          }
          // selected: {
          //   fill: "black",
          //   zIndex: 5,
          // },
          // selected_reverse: {
          //   fillOpacity: 0.2,
          //   fill: "gray",
          // },
          // dimension_hover: {
          //   fill: "blue",
          //   zIndex: 3,
          // },
          // dimension_hover_reverse: {
          //   fill: "yellow"
          // }
        }
      }
    },
    {
      data: {
        id: 'data1'
      },
      select: {
        enable: true,
        mode: 'multiple'
      },
      type: 'line',
      xField: 'time',
      yField: 'value',

      /** 是否开启大数据渲染模式，开启后会降低渲染的精度 */
      large: false,
      /** 开启大数据渲染优化的阀值，对应的是data的长度;推荐 largeThreshold < progressiveThreshold  */
      largeThreshold: 500,
      /** 分片长度 */
      progressiveStep: 100,
      /** 开启分片渲染的阀值，对应的是单系列data的长度 */
      progressiveThreshold: 1000,

      point: {
        state: {
          hover: {
            fill: 'red',
            zIndex: 4
          },
          hover_reverse: {
            fillOpacity: 0.5
          }
          // selected: {
          //   fill: "black",
          //   zIndex: 5,
          // },
          // selected_reverse: {
          //   fillOpacity: 0.2
          // },
          // dimension_hover: {
          //   fill: "blue",
          //   zIndex: 3,
          // },
          // dimension_hover_reverse: {
          //   fill: "yellow"
          // }
        }
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      type: 'band'
    },
    {
      orient: 'left',
      type: 'linear'
    }
  ],
  tooltip: {
    visible: false
    //renderMode: 'canvas'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 在面积图中使用渐进式渲染

```javascript livedemo
const data = [];
const type = ['A', 'B'];
type.forEach(t => {
  for (let i = 0; i < 10000; i++) {
    data.push({
      x: i,
      type: t,
      y: Math.floor(Math.random() * 300) + 600
    });
  }
});
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  series: [
    {
      type: 'area',
      dataIndex: 0,
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      hover: true,
      select: true,
      /** 是否开启大数据渲染模式，开启后会降低渲染的精度 */
      large: false,
      /** 开启大数据渲染优化的阀值，对应的是data的长度;推荐 largeThreshold < progressiveThreshold  */
      largeThreshold: 500,
      /** 分片长度 */
      progressiveStep: 100,
      /** 开启分片渲染的阀值，对应的是单系列data的长度 */
      progressiveThreshold: 1000,
      point: {
        style: {
          fillOpacity: 1,
          stroke: '#000',
          strokeWidth: 4
        },
        state: {
          hover: {
            fillOpacity: 0.5,
            stroke: 'blue',
            strokeWidth: 2
          },
          selected: {
            fill: 'red'
          }
        }
      },
      area: {
        style: {
          fillOpacity: 0.3,
          stroke: '#000',
          strokeWidth: 4
        }
      }
    }
  ],
  axes: [
    { orient: 'bottom', label: { visible: true }, type: 'band' },
    { orient: 'left', range: { min: 0 }, type: 'linear' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 在箱型图中开启渐进式渲染

```javascript livedemo
function getData(size) {
  return new Array(size).fill(0).map((entry, index) => {
    return {
      x: `group${index + 1}`,
      y1: 1600,
      y2: 1200,
      y3: 800,
      y4: 700,
      y5: 500,
      outliers: [2000, 2200]
    };
  });
}
const data = [
  {
    name: 'boxPlot',
    fields: {
      y1: {
        alias: 'max value'
      },
      y5: {
        alias: 'min value'
      }
    },
    values: getData(12)
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  yField: 'x',
  height: 800,

  minField: 'y5',
  q1Field: 'y4',
  medianField: 'y3',
  q3Field: 'y2',
  maxField: 'y1',
  outliersField: 'outliers',
  direction: 'horizontal',
  outliersStyle: {
    fill: '#FE6244',
    size: 10
  },
  crosshair: {
    trigger: ['click', 'hover'],
    yField: {
      line: {
        visible: true,
        type: 'rect',
        width: '150%'
      },
      label: {
        visible: false
      }
    }
  },

  series: [
    {
      type: 'boxPlot',
      large: false,
      /** 分片长度 */
      progressiveStep: 2,
      /** 开启分片渲染的阀值，对应的是单系列data的长度 */
      progressiveThreshold: 10,

      boxPlot: {
        style: {
          shaftFillOpacity: 0.5,
          strokeWidth: 2,
          // boxWidth: 80,
          // shaftWidth: 50,
          strokeColor: '#62CDFF',
          boxFillColor: '#9E4784',
          shaftShape: 'bar'
        },
        state: {
          selected: {
            stroke: 'yellow',
            strokeWidth: 10
          },
          hover: {
            stroke: 'blue',
            strokeWidth: 10
          }
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## 总结

通过本教程，您应该已经了解了如何在 VChart 图表库中使用渐进式渲染功能。正确设置相关配置项，可以在处理大量数据时优化图表性能，提高用户体验。当然，更多高级功能和技巧，您可以在 VChart 官方文档中深入学习。祝您使用愉快！
