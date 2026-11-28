# 直方图

[\[配置项\]](../../../option/histogramChart)

## 简介

直方图，又称质量分布图，用于表示数据的分布情况，是一种常见的统计图表。 一般用横轴表示数据区间，纵轴表示分布情况，柱子越高，则落在该区间的数量越大。

## 图表构成

直方图由矩形图元、坐标轴及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a05.png)

矩形图元为直方图的基本要素，相关的绘制配置必不可少:

- `histogramChart.type`: 图表类型，直方图的类型为`'histogram'`
- `histogramChart.data`: 图表绘制的数据源
- `histogramChart.xField`: 数值字段，映射图元的 x 坐标 / 宽度
- `histogramChart.x1Field`: 数值字段，映射图元的 x1 坐标
- `histogramChart.yField`: 数值字段，映射图元的 y 坐标 / 高度
- `histogramChart.y1Field`: 数值字段，映射图元的 y1 坐标

  与其他图表类似，直方图支持配置`direction` 属性，当`direction: 'horizontal'`时，`xField`映 射为矩形图元的宽度，`yField`和`y1Field`分别映射矩形图元的上下边界坐标，即 y 和 y1 坐标；当 `direction: 'vertical'`时，`yField`映射为矩形图元的高度，`xField`和`x1Field`分别映射矩形图元的 左右边界坐标，即 x 和 x1 坐标。

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `histogramChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，注意直方图不支持离散轴，因为直方图用于统计数据区间内的频率分布，主轴必须以数值区间的形式传入，离散轴不支持该功能。详情配置见[VChart 坐标轴组件配置](../../../option/histogramChart#axes)
- `histogramChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/histogramChart#tooltip)
- 更多组件配置见[VChart histogramChart 配置](../../../option/histogramChart)

## 快速上手

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      values: [
        {
          x0: -400,
          x1: -380,
          frequency: 0
        },
        {
          x0: -380,
          x1: -360,
          frequency: 4
        },
        {
          x0: -360,
          x1: -340,
          frequency: 7
        },
        {
          x0: -340,
          x1: -320,
          frequency: 7
        },
        {
          x0: -320,
          x1: -300,
          frequency: 18
        },
        {
          x0: -300,
          x1: -280,
          frequency: 30
        },
        {
          x0: -280,
          x1: -260,
          frequency: 33
        },
        {
          x0: -260,
          x1: -240,
          frequency: 80
        },
        {
          x0: -240,
          x1: -220,
          frequency: 98
        },
        {
          x0: -220,
          x1: -200,
          frequency: 124
        },
        {
          x0: -200,
          x1: -180,
          frequency: 161
        },
        {
          x0: -180,
          x1: -160,
          frequency: 176
        },
        {
          x0: -160,
          x1: -140,
          frequency: 227
        },
        {
          x0: -140,
          x1: -120,
          frequency: 276
        },
        {
          x0: -120,
          x1: -100,
          frequency: 321
        },
        {
          x0: -100,
          x1: -80,
          frequency: 452
        },
        {
          x0: -80,
          x1: -60,
          frequency: 441
        },
        {
          x0: -60,
          x1: -40,
          frequency: 505
        },
        {
          x0: -40,
          x1: -20,
          frequency: 521
        },
        {
          x0: -20,
          x1: 0,
          frequency: 733
        },
        {
          x0: 0,
          x1: 20,
          frequency: 892
        },
        {
          x0: 20,
          x1: 40,
          frequency: 362
        },
        {
          x0: 40,
          x1: 60,
          frequency: 267
        },
        {
          x0: 60,
          x1: 80,
          frequency: 223
        },
        {
          x0: 80,
          x1: 100,
          frequency: 157
        },
        {
          x0: 100,
          x1: 120,
          frequency: 170
        },
        {
          x0: 120,
          x1: 140,
          frequency: 124
        },
        {
          x0: 140,
          x1: 160,
          frequency: 112
        },
        {
          x0: 160,
          x1: 180,
          frequency: 73
        },
        {
          x0: 180,
          x1: 200,
          frequency: 80
        },
        {
          x0: 200,
          x1: 220,
          frequency: 49
        },
        {
          x0: 220,
          x1: 240,
          frequency: 33
        },
        {
          x0: 240,
          x1: 260,
          frequency: 30
        },
        {
          x0: 260,
          x1: 280,
          frequency: 21
        },
        {
          x0: 280,
          x1: 300,
          frequency: 9
        },
        {
          x0: 300,
          x1: 320,
          frequency: 13
        },
        {
          x0: 320,
          x1: 340,
          frequency: 11
        },
        {
          x0: 340,
          x1: 360,
          frequency: 5
        },
        {
          x0: 360,
          x1: 380,
          frequency: 4
        },
        {
          x0: 380,
          x1: 400,
          frequency: 4
        },
        {
          x0: 400,
          x1: 420,
          frequency: 2
        },
        {
          x0: 420,
          x1: 440,
          frequency: 8
        },
        {
          x0: 440,
          x1: 460,
          frequency: 2
        },
        {
          x0: 460,
          x1: 480,
          frequency: 3
        },
        {
          x0: 480,
          x1: 500,
          frequency: 10
        },
        {
          x0: 500,
          x1: 520,
          frequency: 7
        },
        {
          x0: 520,
          x1: 540,
          frequency: 14
        },
        {
          x0: 540,
          x1: 560,
          frequency: 6
        },
        {
          x0: 560,
          x1: 580,
          frequency: 1
        },
        {
          x0: 580,
          x1: 600,
          frequency: 3
        },
        {
          x0: 600,
          x1: 620,
          frequency: 0
        },
        {
          x0: 620,
          x1: 640,
          frequency: 6
        },
        {
          x0: 640,
          x1: 660,
          frequency: 5
        },
        {
          x0: 660,
          x1: 680,
          frequency: 3
        },
        {
          x0: 680,
          x1: 700,
          frequency: 2
        },
        {
          x0: 700,
          x1: 720,
          frequency: 0
        }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Arrival Time Histogram',
    textStyle: {
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    },
    subtextStyle: {
      character: [
        {
          text: 'This histogram details the distribution of the number of seconds the arrival of tram line 1 of Amsterdam on 2 October 2017 deviated from the planning on each stop in each trip.\nThe data was filtered to remove 4 extreme measurements from ~7000 datapoints that caused significant skewing.',
          fontFamily: 'Times New Roman',
          fontSize: 14,
          fill: '#333'
        },
        {
          text: '\ndata source: https://observablehq.com/@nickrttn/departure-time-histogram',
          fontSize: 10,
          fill: '#333',
          fillOpacity: 0.5
        }
      ]
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `xField` 属性声明为频率统计左区间字段
- `x2Field` 属性声明为频率统计右区间字段
- `yField` 属性声明为频率数值字段

## 直方图特性

与柱状图有所不同，直方图展现某个分段内的数据，所以通常维度轴需要两个字段分别表示区间起点和区间终点，又因为区间为数值区间，所以维度轴为连续轴。指标轴用一个数值字段表示柱子高度。

### 数据

- 两个`数值` 字段，如: `x` `x1`
- 一个`数值`字段，如: `value`

数据定义如下：

```ts
data: [
  {
    name: 'histogram',
    values: [
      {
        x: 0,
        x1: 10,
        value: 1
      },
      {
        x: 10,
        x1: 20,
        value: 5
      },
      {
        x: 20,
        x1: 30,
        value: 2
      }
    ]
  }
];
```

### 直方折线组合图

直方图和折线图通常一起使用，以便在可视化数据分布特征时提供更清晰、准确的显示效果。相比于单个直方图，搭配折线图的直方图除了能在图中直观展示数据的分布情况外，还可以更好地强调数据趋势性和偏差量的变化。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        {
          x0: -400,
          x1: -380,
          frequency: 0
        },
        {
          x0: -380,
          x1: -360,
          frequency: 4
        },
        {
          x0: -360,
          x1: -340,
          frequency: 7
        },
        {
          x0: -340,
          x1: -320,
          frequency: 7
        },
        {
          x0: -320,
          x1: -300,
          frequency: 18
        },
        {
          x0: -300,
          x1: -280,
          frequency: 30
        },
        {
          x0: -280,
          x1: -260,
          frequency: 33
        },
        {
          x0: -260,
          x1: -240,
          frequency: 80
        },
        {
          x0: -240,
          x1: -220,
          frequency: 98
        },
        {
          x0: -220,
          x1: -200,
          frequency: 124
        },
        {
          x0: -200,
          x1: -180,
          frequency: 161
        },
        {
          x0: -180,
          x1: -160,
          frequency: 176
        },
        {
          x0: -160,
          x1: -140,
          frequency: 227
        },
        {
          x0: -140,
          x1: -120,
          frequency: 276
        },
        {
          x0: -120,
          x1: -100,
          frequency: 321
        },
        {
          x0: -100,
          x1: -80,
          frequency: 452
        },
        {
          x0: -80,
          x1: -60,
          frequency: 441
        },
        {
          x0: -60,
          x1: -40,
          frequency: 505
        },
        {
          x0: -40,
          x1: -20,
          frequency: 521
        },
        {
          x0: -20,
          x1: 0,
          frequency: 733
        },
        {
          x0: 0,
          x1: 20,
          frequency: 892
        },
        {
          x0: 20,
          x1: 40,
          frequency: 362
        },
        {
          x0: 40,
          x1: 60,
          frequency: 267
        },
        {
          x0: 60,
          x1: 80,
          frequency: 223
        },
        {
          x0: 80,
          x1: 100,
          frequency: 157
        },
        {
          x0: 100,
          x1: 120,
          frequency: 170
        },
        {
          x0: 120,
          x1: 140,
          frequency: 124
        },
        {
          x0: 140,
          x1: 160,
          frequency: 112
        },
        {
          x0: 160,
          x1: 180,
          frequency: 73
        },
        {
          x0: 180,
          x1: 200,
          frequency: 80
        },
        {
          x0: 200,
          x1: 220,
          frequency: 49
        },
        {
          x0: 220,
          x1: 240,
          frequency: 33
        },
        {
          x0: 240,
          x1: 260,
          frequency: 30
        },
        {
          x0: 260,
          x1: 280,
          frequency: 21
        },
        {
          x0: 280,
          x1: 300,
          frequency: 9
        },
        {
          x0: 300,
          x1: 320,
          frequency: 13
        },
        {
          x0: 320,
          x1: 340,
          frequency: 11
        },
        {
          x0: 340,
          x1: 360,
          frequency: 5
        },
        {
          x0: 360,
          x1: 380,
          frequency: 4
        },
        {
          x0: 380,
          x1: 400,
          frequency: 4
        },
        {
          x0: 400,
          x1: 420,
          frequency: 2
        },
        {
          x0: 420,
          x1: 440,
          frequency: 8
        },
        {
          x0: 440,
          x1: 460,
          frequency: 2
        },
        {
          x0: 460,
          x1: 480,
          frequency: 3
        },
        {
          x0: 480,
          x1: 500,
          frequency: 10
        },
        {
          x0: 500,
          x1: 520,
          frequency: 7
        },
        {
          x0: 520,
          x1: 540,
          frequency: 14
        },
        {
          x0: 540,
          x1: 560,
          frequency: 6
        },
        {
          x0: 560,
          x1: 580,
          frequency: 1
        },
        {
          x0: 580,
          x1: 600,
          frequency: 3
        },
        {
          x0: 600,
          x1: 620,
          frequency: 0
        },
        {
          x0: 620,
          x1: 640,
          frequency: 6
        },
        {
          x0: 640,
          x1: 660,
          frequency: 5
        },
        {
          x0: 660,
          x1: 680,
          frequency: 3
        },
        {
          x0: 680,
          x1: 700,
          frequency: 2
        },
        {
          x0: 700,
          x1: 720,
          frequency: 0
        }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      dataIndex: 0,
      xField: 'x0',
      x2Field: 'x1',
      yField: 'frequency'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 0,
      seriesField: 'type',
      xField: 'x0',
      yField: 'frequency',
      stack: false,
      point: {
        visible: false
      },
      line: {
        style: {
          strokeWidth: 2
        }
      }
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 不同频率分布直方图

由于决定柱子左右边界位置的是不同的数据字段，也就意味着数据的数值间隔决定了柱子的宽度（`direction: 'horizontal'`时决定柱子的高度）。
而数据间隔不同，就可以绘制出不同频率分布的直方图。

```javascript livedemo
const spec = {
  type: 'histogram',
  xField: 'from',
  x2Field: 'to',
  yField: 'profit',
  seriesField: 'type',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Profit',
    padding: {
      bottom: 20
    },
    textStyle: {
      align: 'center',
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'profit'
      },
      content: [
        {
          key: datum => datum['from'] + '～' + datum['to'],
          value: datum => datum['profit']
        }
      ]
    }
  },
  data: [
    {
      name: 'data1',
      values: [
        {
          from: 0,
          to: 10,
          profit: 2,
          type: 'A'
        },
        {
          from: 10,
          to: 16,
          profit: 3,
          type: 'B'
        },
        {
          from: 16,
          to: 18,
          profit: 15,
          type: 'C'
        },
        {
          from: 18,
          to: 26,
          profit: 12,
          type: 'D'
        },
        {
          from: 26,
          to: 32,
          profit: 22,
          type: 'E'
        },
        {
          from: 32,
          to: 56,
          profit: 7,
          type: 'F'
        },
        {
          from: 56,
          to: 62,
          profit: 17,
          type: 'G'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 使用 `bin` transform 生成直方图数据

自 `2.0.7` 版本开始，直方图支持了`bin` transform，当数据为明细数据的时候，可以通过该变换，获得标准的直方图数据

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            bins: 10,
            field: 'value'
          }
        }
      ],
      values: [
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'count',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Arrival Time Histogram'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'count'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['count']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

其中 bin transform 支持如下配置：

```ts
interface IBinOptions {
  /**
   * 需要分箱的数值字段
   */
  field: string;
  /**
   * 分箱数量（默认 10）
   */
  bins?: number;
  /**
   * 显式指定的分箱边界数组
   */
  thresholds?: number[];
  /**
   * 固定的分箱宽度（区间步长），如设置则覆盖 bins
   */
  step?: number;
  /**
   * 指定分箱的最小值和最大值 [min, max]，否则自动根据数据计算
   */
  extent?: [number, number];
  /**
   * 是否在每个分箱中保留原始数据项
   */
  includeValues?: boolean;
  /**
   * 输出数据的字段名映射
   */
  outputNames?: { x0?: string; x1?: string; count?: string; values?: string };
}
```

## 图表布局

### 堆叠直方图

在 VChart 中，如果需要展示堆叠直方图，需要配置`histogramChart.stack: true`，并且为了区分同一维度下堆叠在一起的柱子，需要指定`histogramChart.seriedField`字段，该字段默认映射区域颜色。

```javascript livedemo
const spec = {
  color: ['#1ac7c2', '#ccf59a'],
  data: [
    {
      name: 'data1',
      values: [
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9735380,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10552146,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10563233,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 10237419,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9731315,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9659493,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10205879,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11475182,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11320252,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 9925006,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8507934,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6459082,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5123399,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4453623,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 3792145,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 2912655,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 1902638,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 970357,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 336303,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9310714,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10069564,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10022524,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 9692669,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9324244,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9518507,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10119296,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11635647,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11488578,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 10261253,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8911133,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6921268,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5668961,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4804784,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 5184855,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 4355644,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 3221898,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 1981156,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 1064581,
          sex: 'Male'
        }
      ]
    }
  ],
  type: 'histogram',
  xField: 'age0',
  x2Field: 'age1',
  yField: 'people',
  seriesField: 'sex',
  legends: {},
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'A trellis bar chart showing the US population distribution of age groups and gender in 2000.',
    textStyle: {
      height: 50,
      lineWidth: 2,
      fill: '#333',
      fontSize: 18,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: datum => datum['sex']
      },
      content: [
        {
          key: datum => datum['age0'] + '～' + datum['age1'],
          value: datum => datum['people']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
