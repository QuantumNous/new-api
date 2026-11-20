# VChart Progressive Rendering Tutorial

In this tutorial, we will introduce how to use the progressive rendering feature in the VChart chart library. Progressive rendering can help you optimize chart performance when dealing with large amounts of data. Please make sure you have a basic understanding of the VChart chart library before learning this tutorial.

## What is Progressive Rendering

Progressive rendering is a technique for improving chart performance, which can effectively reduce stutter and rendering time when processing large amounts of data. The progressive rendering feature in the VChart chart library depends on the configuration items in the chart's elements. For example, it can be configured in a bar chart like this:

- `barChart.largeThreshold`: The threshold to enable large data rendering optimization
- `barChart.progressiveStep`: The length of the partition
- `barChart.progressiveThreshold`: The threshold to enable partitioned rendering

### Background Knowledge

During the chart drawing process, processing and rendering large amounts of data may consume more CPU and GPU resources, resulting in stutter or longer rendering response time. Using progressive rendering technology, data can be processed and rendered in partitions, balancing resource consumption and improving chart display effects.

## How to Declare Progressive Rendering

In the VChart chart library, declaring progressive rendering requires setting related configuration items in the corresponding chart elements. Here's an example of using progressive rendering.

```ts
{
  "barChart": {
      "largeThreshold": 2000,
      "progressiveStep": 500,
      "progressiveThreshold": 8000
  }
}
```

Let's explain these configuration items one by one.

### barChart.largeThreshold

`largeThreshold` is a numeric value representing the threshold to enable large data rendering optimization. When the data length exceeds this threshold, VChart will automatically enable large data optimization.

In this example, we set `largeThreshold` to 2000, which means that when the data length exceeds 2000, large data rendering optimization is enabled.

It is recommended to set the `largeThreshold` value less than `progressiveThreshold`.

### barChart.progressiveStep

`progressiveStep` is a numeric value representing the partition length. During the rendering process, data will be divided into multiple segments (partitions). Each partition contains `progressiveStep` data points.

In this example, we set `progressiveStep` to 500, meaning each partition contains 500 data points.

### barChart.progressiveThreshold

`progressiveThreshold` is a numeric value representing the threshold to enable partitioned rendering. When the single-series data length exceeds this threshold, VChart will automatically enable partitioned rendering.

In this example, we set `progressiveThreshold` to 8000, which means that when the single-series data length exceeds 8000, partitioned rendering is enabled.

## Examples

### Enable Progressive Rendering in Bar and Line Combination Chart

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

### Use Progressive Rendering in Area Chart

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

### Enable Progressive Rendering in Box Plot

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
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Conclusion

Through this tutorial, you should have learned how to use the progressive rendering feature in the VChart chart library. Correctly setting related configuration items can optimize chart performance when dealing with large amounts of data, and improve user experience. Of course, you can further explore more advanced features and techniques in the VChart official documentation. Enjoy using it!
