# 复杂动画的配置与编排

为了更好的支持叙事可视化场景，VChart 也支持了配置化的复杂图元动画和编排能力。通过之前的教程学习，我们大致了解了在 VChart 中定义的动画类型和基本配置。本节将进一步介绍 VChart 图元动画能力。

在一个图表系列中，可能会有多个图形元素（例如，折线图中存在点图元和线图元）。VChart 支持针对不同图元配置不同的动画效果。

根据需要，如果图元动画配置为 `false` 则可以关闭对应图元的动画。

```json
"animationAppear": {
  "point": false
}
```

## 图元动画配置

首先，我们来看一个简单的示例。这里，我们将创建一个折柱组合图，并为其配置一个动画：柱子依次生长，完成后所有点同时出现，接着折线将点依次连接。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          oneByOne: true,
          duration: 500,
          totalTime: 3500
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          delay: 3500,
          duration: 500
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 4000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

上面的例子，就是在利用我们上一章（[动画类型](./Animation_Types)）中介绍的`duration`/`delay`/`easing`/`oneByOne`配置来实现简单的动画效果。

图元的动画配置支持多种属性，用于对图元动画行为进行细节控制。以下是图元动画配置支持的属性：

- `type`： 动画类型，使用内置的动画类型如 "fadeIn"、"fadeOut" 等。
- `channel`： 视觉通道动画配置，参考[视觉通道动画配置](#视觉通道动画配置)节内容。
- `delay`： 动画执行的延迟时间，默认为 0。
- `duration`： 动画执行时长，默认为 1000ms（1 秒）。
- `oneByOne`： 动画依次执行的延迟时长，如果配置为 true 则会在上一个元素动画执行结束后执行下一个元素的动画，默认为 false。
- `startTime`： 动画执行的初始时间，这一初始时间不会在循环动画中被重复应用，默认为 0。
- `totalTime`： 动画执行的最大时间，如果动画执行到达设定时间将会被终止。
- `loop`： 动画循环次数，如果配置为 true 则会无限循环。
- `options`： 特定动画类型执行时设定的额外参数。
  - `excludeChannels`： 不参与当前动画的视觉通道；
- `controlOptions`： 动画执行逻辑的控制参数：
  - `stopWhenStateChange`： 当动画状态变更时是否立即终止自身动画。
  - `imApply`： 是否立即应用动画初始的视觉通道。

在之前的例子中，柱子默认生长动画，点图元默认缩放动画，折线默认采用了 clip 动画，那如果我们期望一些其它的动画效果，比如所有图元淡入的效果，该怎么配置呢？接下来我们将介绍一下，在 VChart 中内置的一些动画效果。

### 内置动画类型

在 VChart 中，内置了一些通用的动画类型。这些动画类型可以直接在配置中使用，实现常见的图元动画效果。通用的内置动画类型包括：

- `fadeIn`/`fadeOut`： 渐入渐出动画。
- `scaleIn`/`scaleOut`： 缩放动画。
- `moveIn`/`moveOut`： 移入移出动画。
- `rotateIn`/`rotateOut`： 旋转动画。
- `update`： 更新动画，通常用于图元更新动画（`animationUpdate`）。

#### 渐入渐出动画

渐入动画是一种常见的出场动画：图元的透明度从 0 逐渐变化为 1；渐出动画则刚好相反，常用与图表的退场动画。
在之前示例的基础上，我们为所有图元新增一个动画类型的配置`type: 'fadeIn'`，同时稍微调整了下动画延迟（`delay`），从下面的效果可以看到，图表的入场动画已经变为了我们配置的渐入动画。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'fadeIn', // 渐入动画
          oneByOne: true,
          duration: 500,
          totalTime: 3500
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'fadeIn', // 渐入动画
          duration: 500,
          delay: 3500
        },
        // 线图元动画配置
        line: {
          type: 'fadeIn', // 渐入动画
          duration: 1500,
          delay: 4000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### 缩放动画

缩放动画是一种常见的出场动画：图元的`scaleX`/`scaleY`从 0 逐渐变化为 1；`scaleOut`动画则刚好相反，常用与图表的退场动画。
VChart 提供了内置动画类型 `scaleIn`/`scaleOut` 的额外配置参数 `options` ：

```ts
export interface IScaleAnimationOptions {
  direction?: 'x' | 'y' | 'xy';
}
```

其中，direction 属性用于指定缩放的方向，可选值有：

- 'x'：x 方向进行缩放。
- 'y'：y 方向进行缩放。
- 'xy'：同时在 x 和 y 方向进行缩放（默认）。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'scaleIn',
          options: { direction: 'y' },
          duration: 1000
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      point: {
        style: {
          size: 20
        }
      },
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'scaleIn',
          delay: 1000,
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### 移入移出动画

移入移出动画是指图表中基本图形元素在某一方向上进行平移的动画效果。VChart 提供了 IMoveAnimationOptions 接口来配置移入移出动画。
VChart 提供了内置动画类型 `moveIn`/`moveOut` 的额外配置参数 `options` ：

```ts
export interface IMoveAnimationOptions {
  direction?: 'x' | 'y' | 'xy';
  orient?: 'positive' | 'negative';
  offset?: number;
  point?: { x?: number; y?: number };
}
```

其中：

- `direction`：移动方向，可选值同缩放动画。
- `orient`：移动的方向，可选值有：
  - `'positive'`：正方向（默认）
  - `'negative'`：负方向
- `point`：移动的起始点坐标。
- `offset`：移动的距离（像素值），默认为当前区域的`(0,0)`坐标。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'moveIn',
          options: { direction: 'x' },
          duration: 1000
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'moveIn',
          options: { direction: 'y' },
          easing: 'bounceOut',
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### 旋转动画

旋转动画是针对配置了`angle`属性的图元提供的一种图元动画。多用于极坐标系下的图元，例如仪表盘指针变化动画。
VChart 提供了内置动画类型 `rotateIn`/`rotateOut` 的额外配置参数 `options` ：

```ts
export interface IRotateAnimationOptions {
  orient?: 'clockwise' | 'anticlockwise';
  angle?: number;
}
```

其中：

- `orient`：旋转方向，可选值有：
  - 'clockwise'：顺时针（默认）
  - 'anticlockwise'：逆时针
- `angle`：旋转的角度，单位为弧度。

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      point: {
        style: {
          shape: 'star',
          angle: 180,
          size: 20
        }
      },
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'rotateIn',
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

此外，根据不同图元的特性，VChart 还提供了一些专属图元动画类型。

#### 矩形图元内置动画

矩形图元通常用于柱状图、直方图中，矩形图元支持以下额外的动画类型：

- `growHeightIn`/`growHeightOut`： 高度生长动画
- `growWidthIn`/`growWidthOut`： 宽度生长动画
- `growCenterIn`/`growCenterOut`： 中心生长动画

#### arc 图元内置动画

arc 图元通常用于饼图、玫瑰图、环形进度图中， 图元支持以下额外的动画类型：

- `growRadiusIn`/`growRadiusOut`： 半径生长动画
- `growAngleIn`/`growAngleOut`： 角度生长动画

#### 线图元内置动画

线图元通常用于折线图、面积图中， 图元支持以下额外的动画类型：

- `growPointsIn`/`growPointsOut`： 点生长动画
- `growPointsXIn`/`growPointsXOut`： X 方向点生长动画
- `growPointsYIn`/`growPointsYOut`： Y 方向点生长动画
- `clipIn`/`clipOut`： 裁剪动画

### 视觉通道动画配置

如果需要指定图元在动画执行前后具体变化效果，例如，设置图元的颜色透明度（fillOpacity）在动画过程中从 1 变化 0.3。视觉通道动画配置示例如下：

```json
{
  "animationAppear"：{
    "bar"：{
        "channel": {
          "fillOpacity": { "from": 0.3, "to": 0.3 }
      }
    }
  }
}
```

`channel` 配置和 `type`二选其一，不能同时配置，当配置了内置动画类型（`type`）时，`channel` 配置将不会生效。

### 动画执行控制

## 动画编排

VChart 提供基于 json spec 的动画编排配置，以尽可能丰富的满足动画需求。

### 时间线（Timeline）

时间线（Timeline）表示在特定一段时间内图元的动画表现，一条时间线上包含了一组串行执行的动画分片（TimeSlice）。时间线描述了一段时间内图元的动画表现。不同 timeline 之间动画可以并行。时间线也可以被设置 `loop: true` 以循环执行所配置的动画效果。

![时间线示意图](./timeline.png)

- 时间线的组成
- `timeslice`：动画的分片，描述了具体的某一段插值动画配置，包含相关的动画效果、动画执行时间等具体动画配置。在一个 timeline 上所有的 timeslice 头衔尾的串联在一起；
- `startTime`：动画的开始执行时间，描述了当前 timeline 触发执行之后开始执行动画的时间；
- `totalTime`：动画的总时长；
- `loop`：一个 timeline 可以被设置为循环，其中包含的所有 timeslice 所描述的动画过程将会被重复的执行；
- `oneByOne`：动画依次执行的延迟；如果配置为 true 则会在上一个元素动画执行结束后执行下一个元素的动画，默认为 false；
- `partitioner`：动画分区器，对相应图元中的内容进行筛选，并将动画配置应用到这些筛选的图形元素上；
- `sort`：对同一时间线上的元素进行排序。

### 时间片（Timeslice）

在一条时间线中，每个时间片是串行执行的，时间片中的构成元素包含：

- `effect`：动画的具体执行效果，描述了具体的图元视觉通道属性插值计算逻辑。effect 可以是封装好的特定动画效果，或者由开发者配置起始状态以及结尾状态的动画配置，描述了动画的属性插值的计算逻辑。每个 timeSlice 可以配置多个`effect`；
- `duration`：动画分片的执行时长；
- `delay`：动画分片的执行前的等待时间；

### 动画效果（Effect）

动画效果（Effect）中的构成元素包含：

- `channel`：变更的视觉通道属性，描述了插值计算开始以及结尾状态时的视觉通道属性；
- `easing`：差值计算的缓动策略；

下面的示例通过设置循环的时间线动画，实现了一个手风琴的效果：

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: [
        { x: '1', y: 22 },
        { x: '2', y: 43 },
        { x: '3', y: 33 },
        { x: '4', y: 22 },
        { x: '5', y: 10 },
        { x: '6', y: 30 },
        { x: '7', y: 46 },
        { x: '8', y: 21 },
        { x: '9', y: 33 },
        { x: '10', y: 43 },
        { x: '11', y: 42 },
        { x: '12', y: 30 },
        { x: '13', y: 9 },
        { x: '14', y: 46 }
      ]
    }
  ],
  xField: ['x'],
  yField: 'y',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  animationNormal: {
    bar: [
      {
        loop: true,
        startTime: 100,
        oneByOne: 100,
        timeSlices: [
          {
            delay: 1000,
            effects: {
              channel: {
                fillOpacity: { to: 0.5 }
              },
              easing: 'linear'
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 }
              },
              easing: 'linear'
            },
            duration: 500
          }
        ]
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 自定义动画

在动画效果（Effect）中的如果简单的 `channel` 配置无法满足你的需要，可以通过`custom`和`customParameters`来配置自定义动画效果：

- `custom`：自定义动画；
- `customParameters`：自定义动画参数；
  详细使用可以参考[自定义动画](../extend/custom_animation)章节。
