# 折线图

[\[配置项\]](../../../option/lineChart)

## 简介

折线图通过将一系列数据点进行连接，构造出趋势。折线图用于分析事物随时间或有序类别而变化的趋势。如果有多组数据，则用于分析多组数据随时间变化或有序类别的相互作用和影响。折线的方向表示正/负变化。折线的斜率表示变化的程度。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523215.png)

## 图表构成

折线图由点图元、线图元、坐标轴及其他组件构成。
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf03.png)

点图元、线图元为折线图的基本要素，相关的绘制配置必不可少:

- `lineChart.type`: 图表类型，折线图的类型为`'line'`
- `lineChart.data`: 图表绘制的数据源
- `lineChart.xField`: 连续时间间隔或有序类别字段，映射图元的 x 坐标
- `lineChart.yField`: 数值字段，映射图元的 y 坐标

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `lineChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/line/axes/lineChart#axes)
- `lineChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/line/axes/lineChart#tooltip)
- 更多组件配置见[VChart lineChart 配置](../../../option/lineChart)

## 快速上手

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
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `type`: 图表类型，折线图的类型为`'line'`
- `xField` 属性声明为连续时间间隔或有序类别字段
- `yField` 属性声明数值字段

## 图表特性

### 数据

#### 数据结构

- 一个`离散` 或 `时序` 字段，如: `month`  
  (`时序`字段中的数据仅支持时间戳格式，且在坐标轴中需要配置`axes.type: 'time'`）
- 一个`数值`字段，如: `temperature`

一组月份和温度的数据定义如下：

```ts
data: [
  {
    name: 'line',
    values: [
      {
        month: 'January',
        temperature: 8
      },
      {
        month: 'February',
        temperature: 9
      },
      {
        month: 'March',
        temperature: 11
      },
      {
        month: 'April',
        temperature: 14
      }
    ]
  }
];
```

#### 数据不连续场景

数据中存在空值的折线图。用户可以通过配置`lineChart.invalidType`来指定`null`，`undefined` 等非合规数据点连接方式

| lineChart.invalidType | 描述             |
| --------------------- | ---------------- |
| 'break'               | 在该数据点处断开 |
| 'link'                | 忽略该点保持连续 |
| 'zero'                | 该点默认数值为 0 |
| 'ignore'              | 不处理           |

在这里例子中，展示了奥运会金牌、银牌、铜牌数随时间的变化情况，其中在 1980 年是空数据。

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        medalType: 'Gold Medals',
        count: 40,
        year: '1952'
      },
      {
        medalType: 'Gold Medals',
        count: 32,
        year: '1956'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1960'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1964'
      },
      {
        medalType: 'Gold Medals',
        count: 45,
        year: '1968'
      },
      {
        medalType: 'Gold Medals',
        count: 33,
        year: '1972'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1976'
      },
      {
        medalType: 'Gold Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Gold Medals',
        count: 83,
        year: '1984'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1988'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Gold Medals',
        count: 44,
        year: '1996'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '2000'
      },
      {
        medalType: 'Gold Medals',
        count: 35,
        year: '2004'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Gold Medals',
        count: 46,
        year: '2012'
      },
      {
        medalType: 'Silver Medals',
        count: 19,
        year: '1952'
      },
      {
        medalType: 'Silver Medals',
        count: 25,
        year: '1956'
      },
      {
        medalType: 'Silver Medals',
        count: 21,
        year: '1960'
      },
      {
        medalType: 'Silver Medals',
        count: 26,
        year: '1964'
      },
      {
        medalType: 'Silver Medals',
        count: 28,
        year: '1968'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1972'
      },
      {
        medalType: 'Silver Medals',
        count: 35,
        year: '1976'
      },
      {
        medalType: 'Silver Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Silver Medals',
        count: 60,
        year: '1984'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1988'
      },
      {
        medalType: 'Silver Medals',
        count: 34,
        year: '1992'
      },
      {
        medalType: 'Silver Medals',
        count: 32,
        year: '1996'
      },
      {
        medalType: 'Silver Medals',
        count: 24,
        year: '2000'
      },
      {
        medalType: 'Silver Medals',
        count: 40,
        year: '2004'
      },
      {
        medalType: 'Silver Medals',
        count: 38,
        year: '2008'
      },
      {
        medalType: 'Silver Medals',
        count: 29,
        year: '2012'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1952'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1956'
      },
      {
        medalType: 'Bronze Medals',
        count: 16,
        year: '1960'
      },
      {
        medalType: 'Bronze Medals',
        count: 28,
        year: '1964'
      },
      {
        medalType: 'Bronze Medals',
        count: 34,
        year: '1968'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1972'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1976'
      },
      {
        medalType: 'Bronze Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1984'
      },
      {
        medalType: 'Bronze Medals',
        count: 27,
        year: '1988'
      },
      {
        medalType: 'Bronze Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1996'
      },
      {
        medalType: 'Bronze Medals',
        count: 33,
        year: '2000'
      },
      {
        medalType: 'Bronze Medals',
        count: 26,
        year: '2004'
      },
      {
        medalType: 'Bronze Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Bronze Medals',
        count: 29,
        year: '2012'
      }
    ]
  },
  xField: 'year',
  yField: 'count',
  seriesField: 'medalType',
  invalidType: 'break'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图元及样式

折线图中使用到的主要图元有两个，分别是： point、 line 。对应图表中的标记点、线图元。可以单独针对每个 mark 配置对应样式，详细查看配置: [lineChart.line](../../../option/lineChart#line) 和 [lineChart.point](../../../option/lineChart#point)

#### 末尾虚线

在制作图表时，时常有一些个性化需求。以基金涨跌的预估走向为例，我们希望预估的涨跌幅度以虚线连接，并使用不一样的颜色作为区分。

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1号',
        y: 0.012
      },
      {
        x: '2号',
        y: -0.01
      },
      {
        x: '3号',
        y: 0.005
      },
      {
        x: '4号',
        y: 0.007
      },
      {
        x: '5号',
        y: 0.01
      },
      {
        x: '6号',
        y: 0.017
      },
      {
        x: '7号',
        y: 0.022
      },
      {
        x: '8号预测',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      lineDash: data => {
        if (data.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 标记点样式

标记点支持自定义形状和大小，我们通过配置设置标记点为稍大一些三角形，具体配置见[配置文档](../../../option/lineChart#point)

```ts
point: {
    style: {
      shape: 'triangle',
       size: 7
    }
  }
```

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
  point: {
    style: {
      shape: 'triangle',
      size: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 线性渐变

通过`lineChart.point: {visible: false}` 隐藏标记点，和 `lineChart.line.style.stroke: { gradient: 'linear' }` 配置渐变颜色，可以得到渐变折线的效果。

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: {
        y: {
          alias: 'minimum temperature'
        }
      },
      values: [
        {
          x: 'Monday',
          y: 18,
          c: 0
        },
        {
          x: 'Tuesday',
          y: 16,
          c: 0
        },
        {
          x: 'Wednesday',
          y: 17,
          c: 0
        },
        {
          x: 'Thursday',
          y: 18,
          c: 0
        },
        {
          x: 'Friday',
          y: 19,
          c: 0
        },
        {
          x: 'Saturday',
          y: 20,
          c: 0
        },
        {
          x: 'Sunday',
          y: 17,
          latest: true,
          c: 0
        },
        {
          x: 'Monday',
          y: 28,
          c: 1
        },
        {
          x: 'Tuesday',
          y: 26,
          c: 1
        },
        {
          x: 'Wednesday',
          y: 27,
          c: 1
        },
        {
          x: 'Thursday',
          y: 28,
          c: 1
        },
        {
          x: 'Friday',
          y: 29,
          c: 1
        },
        {
          x: 'Saturday',
          y: 30,
          c: 1
        },
        {
          x: 'Sunday',
          y: 27,
          latest: true,
          c: 1
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  line: {
    style: {
      curveType: 'basis',
      lineWidth: 2,
      stroke: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: data => {
              if (data.c === 0) {
                return '#009800';
              }
              return '#000098';
            },
            opacity: 0
          },
          {
            offset: 0.5,
            color: data => {
              if (data.c === 0) {
                return '#1d983a';
              }
              return '#1d3a98';
            },
            opacity: 0.5
          },
          {
            offset: 1,
            color: data => {
              if (data.c === 0) {
                return '#4d98ca';
              }
              return '#4dca98';
            },
            opacity: 1
          }
        ]
      }
    }
  },
  point: {
    visible: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 渐变色-颜色划分

通过控制渐变色的`offset`值实现，可以用于表示上下分层的警戒线颜色

```javascript livedemo
const spec = {
  data: {
    id: 'data1',
    values: [
      {
        x: '2:00',
        y: 82
      },
      {
        x: '4:00',
        y: 50
      },
      {
        x: '6:00',
        y: 64
      },
      {
        x: '8:00',
        y: 30
      },
      {
        x: '10:00',
        y: 40
      },
      {
        x: '12:00',
        y: 40
      },
      {
        x: '14:00',
        y: 56
      },
      {
        x: '16:00',
        y: 40
      },
      {
        x: '18:00',
        y: 64
      },
      {
        x: '20:00',
        y: 74
      },
      {
        x: '22:00',
        y: 98
      }
    ]
  },
  type: 'line',
  xField: 'x',
  yField: 'y',
  point: {
    style: {
      fill: data => {
        if (data.y > 60) {
          return 'green';
        }
        return 'red';
      }
    }
  },
  line: {
    style: {
      stroke: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'red'
          },
          {
            offset: 1,
            color: 'red'
          }
        ]
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 平滑折线

在 `lineChart.line.style` 属性中配置 `curveType: 'monotone'` 属性

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  line: {
    style: {
      curveType: 'monotone'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 阶梯折线

在 `line.style` 属性中配置 `curveType: 'step'|'stepAfter'|'stepBefore'` 属性

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'stepAfter'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
