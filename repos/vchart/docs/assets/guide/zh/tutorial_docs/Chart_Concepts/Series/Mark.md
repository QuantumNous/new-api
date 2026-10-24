# 图元

## 基本概念

图元是图表中的基本绘制单元，图表中的所有图形都是由图元组成的。图元可以是点、线、矩形、圆形、扇形、环形、路径等等。在图表中，图元的类型通常是由系列类型决定的。图元的数量，样式是由数据决定的，比如折线图中的点，柱状图中的柱子，饼图中的扇形等等。

## 图元的样式属性

图元的属性通常有两种，一种是通用的属性，一种是特定的属性。通用的属性通常是所有图元都有的，比如位置，大小，旋转角度，透明度等等。特定的属性通常是特定类型的图元才有的，比如折线图中的点可以配置 `形状`，饼图中的扇形可以配置`内半径` | `外半径` 等等。

具体图元的可配置属性可以在对应图表的文档中查看。

## 图元的状态

图元的状态在 VChart 中，我们进行了基于图表常规交互的抽象，将图元的状态分为了以下几种：

- `default` 默认状态，图元的初始状态。
- `hover` 指针悬浮状态，图元被鼠标指针悬浮时的状态。
- `hover_reverse` 非指针悬浮状态，当有图元进入了 `hover` 状态时，其他图元的状态。
- `selected` 选中状态，图元被选中时的状态。
- `selected_reverse` 非选中状态，当有图元进入了 `selected` 状态时，其他图元的状态。
- `dimension_hover` 维度悬浮状态，鼠标指针悬浮在某一段 `x` 轴区域内时的状态。
- `dimension_hover_reverse` 非维度悬浮状态，当有图元进入了 `dimension_hover` 状态时，其他图元的状态。

图元在不同状态下可以单独配置样式，比如在 `hover` 状态下，可以配置图元的颜色为红色，而在 `default` 状态下，可以配置图元的颜色为蓝色。而且多个状态可以同时生效，比如在 `hover` 状态下，可以配置图元的颜色为红色，而在 `selected` 状态下，可以配置图元的大小，这样选中元素在悬浮时，颜色为红色，大小为 10。  示例如下：

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class No.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: 'date',
  yField: 'score',
  point: {
    style: {
      fill: 'blue'
    },
    state: {
      hover: {
        style: {
          fill: 'red'
        }
      },
      selected: {
        style: {
          size: 10
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 图元的自定义状态

除了内置的交互状态外，VChart 还支持自定义状态。自定义状态的配置方式与内置状态的配置方式一致，只是在配置时需要指定状态的名称。比如下面的例子，配置了一个 `custom` 状态，当图元进入 `custom` 状态时，图元的颜色为红色。

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class No.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: 'date',
  yField: 'score',
  point: {
    state: {
      custom: {
        filter: datum => {
          return datum.score >= 30;
        },
        style: {
          fill: 'red'
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 图元的样式配置

在上面的例子中我们看到了最常见的配置方式，可以再对应的样式中直接配置样式值。除了这种方式之外 VChart 还支持另外两种配置方式，

### scale 配置

通过 `scale` 来配置样式。这种方式的好处是通过 `scale` 来配置图元的样式，可以将图元的样式与数据建立关联，比如通过数据的大小来配置图元的大小，通过数据的颜色来配置图元的颜色等等。

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'data1',
      values: [
        { x: 'Q1', y: 0, type: 'typeA' },
        { x: 'Q1', y: 50, type: 'typeB' },
        { x: 'Q2', y: 100, type: 'typeA' },
        { x: 'Q2', y: 200, type: 'typeB' }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: 'Q1', y: 80, group: 'typeC' },
        { x: 'Q1', y: -50, group: 'typeD' },
        { x: 'Q2', y: 150, group: 'typeC' },
        { x: 'Q2', y: 180, group: 'typeD' }
      ]
    }
  ],
  series: [
    {
      type: 'scatter',
      xField: 'x',
      yField: 'y',
      dataId: 'data1',
      seriesField: 'type',
      point: {
        style: {
          size: {
            field: 'y',
            scale: 'sizeScale'
          },
          shape: {
            field: 'type',
            scale: 'shapeScale'
          }
        }
      }
    },
    {
      type: 'line',
      xField: 'x',
      yField: 'y',
      dataId: 'data2',
      seriesField: 'group',
      point: {
        style: {
          size: {
            field: 'y',
            scale: 'sizeScale'
          },
          shape: {
            field: 'group',
            scale: 'shapeScale'
          }
        }
      }
    }
  ],
  scales: [
    {
      id: 'shapeScale',
      type: 'ordinal',
      domain: [
        {
          dataId: 'data1',
          fields: ['type']
        },
        {
          dataId: 'data2',
          fields: ['group']
        }
      ],
      range: ['circle', 'rect', 'triangle', 'diamond']
    },
    {
      id: 'sizeScale',
      type: 'linear',
      domain: [
        {
          dataId: 'data1',
          fields: ['y']
        },
        {
          dataId: 'data2',
          fields: ['y']
        }
      ],
      range: [10, 20]
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom' }]
};
// 最终 scale 的 domain 如下：
// shapeScale.domain() === ['typeA','typeB','typeC','typeD'];
// sizeScale.domain() === [-50,200];

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

scale 的具体用法，可以参照文档 [scale](../../../../option/barChart#scales)。

### 函数配置

通过函数配置样式，可以有最大的灵活度，对图元的样式进行任意的自定义。比如下面的例子，通过函数配置图元的颜色，当数据的 `y` 值大于等于 30 时，图元的颜色为红色，否则为蓝色。

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class No.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: 'date',
  yField: 'score',
  point: {
    style: {
      fill: datum => {
        if (datum.score >= 30) {
          return 'red';
        }
        return 'blue';
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 渐变色配置

图表的图形元素都可以配置渐变色，[柱图](../../../../demo/gradient/bar)、[线图](../../../../demo/gradient/line)、[面积图](../../../../demo/gradient/bar)、[气泡图](../../../../demo/gradient/bar) 等都可以使用。

### 渐变色的基本概念与配置接口

VChart 的渐变色配置格式对齐 CanvasRenderingContext2D 的渐变色 API，不同的渐变类型有不同的渐变效果，总的来说我们提供的渐变色能力是基于某种特定的二维空间规则，对图形进行连续颜色填充。

- [线性渐变](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient)
- [径向渐变](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createRadialGradient)
- [圆锥渐变](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createConicGradient)

如果想了解渐变色的绘制机制，请阅读上方对应渐变色的文档，其中有详细的效果说明。

VChart 的渐变配置：

```ts
interface IGradientStop {
  offset: number;
  color: string;
}
export type IGradientColor = ILinearGradient | IRadialGradient | IConicalGradient;
export interface ILinearGradient {
  gradient: 'linear';
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  stops: IGradientStop[];
}
export interface IRadialGradient {
  gradient: 'radial';
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  r0?: number;
  r1?: number;
  stops: IGradientStop[];
}
export interface IConicalGradient {
  gradient: 'conical';
  startAngle?: number;
  endAngle?: number;
  x?: number;
  y?: number;
  stops: IGradientStop[];
}
export interface IColorStop {
  offset: number;
  color: string;
}
```

### 渐变色坐标位置与图元的关系

每一种渐变色的配置中都有多个与位置相关的属性。以最常用的线性渐变为例：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/color-gradient.png" alt="线性渐变示意">
</div>

配置中有 2 组坐标：`[x0,y0], [x1,y1]` 分别表示线性渐变的起点和终点，渐变色会沿着起点到终点的路线进行。在 VChart 中，也支持了这 2 组坐标的配置，但是与原生 API 有`一些区别`。原生 API 中，这 2 组坐标是像素位置，在 VChart 中，为了方便用户配置，我们提供的是以元素包围盒为基准的比例配置。

用几张图来说明不同图表元素的渐变色位置

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/line-gradient.png" alt="线的渐变坐标">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/rect-gradient.png" alt="柱子的渐变坐标">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/point-gradient.png" alt="点的渐变坐标">
</div>

所以线的渐变色上配置 `x0: 0, y0: 0.5, x1: 1, y1: 0.5` 时，表示渐变方向从左向右。

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### 渐变色 stop 的意义

在 VChart 中，渐变色配置中的 stop 与上方的原生绘图 API 没有任何区别。stop 时渐变色的关键节点，颜色会在关键节点间按照渐变类型进行差值。

我们可以想象完整的渐变是一个 `[0,1]` 的数轴，stop 是这个数轴上的点，我们给对应的点配置上一个固定颜色后，数轴上其他的点，会根据它前后的 2 个 stop 进行颜色差值。

下方示意图中设置了 4 个 stop，整个柱子的颜色按照差值规则进行填充:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/linear-gradient.png" alt="线的渐变坐标">
</div>

基于 stop 我们可以制作出特定的[渐变色图表](../../../../demo/gradient/enhancement-gradient-line)

这个特殊的渐变色图期望线在 60 分以上的部分是绿色，60 分以下的部分是红色。我们可以想办法制作出特定的一组 stop 来实现

```ts
// 我们先用分数来划分这些stop节点
0 => 'red'
60 => 'red'
60 => 'green'
100 => 'green'
```

是的，可以同一个数值位置设置 2 个 stop 节点，这样**小于 60 分**的位置，它的差值始终是 `red`, **大于 60 分**的位置，它的差值始终是 `green`。

现在有一个问题是如何计算 60 分的 stop ，它在图形中的实际比例坐标。这里提供一个计算方式。

ps: 需要提前获取数据中的最大值与最小值

```ts
const max; // 数据中的最大值，可以遍历数据获得
const min; // 数据中的最小值，可以遍历数据获得
const mid = 60; // 想要作为划分点的数据值
const percent = (max - mid) / (max - min);
```

完整配置可以在[图表示例](../../../../demo/gradient/enhancement-gradient-line)中查看
