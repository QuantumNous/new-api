# 进度图

## 简介

进度图是一种用于表达任务或活动的进度和状态的可视化图表。它通常以直观易懂的方式展示一个任务在完成过程中的百分比。为了满足不同场景下的可视化需求，VChart 向用户提供条形进度图和环形进度图两种图表形式。

## 条形进度图

[\[配置项\]](../../../option/linearProgressChart)

条形进度图是一种长条形的进度图，通常包括一个背景框和一个内部填充块，用来表示任务的进度和状态。在操作过程中，填充块会随着任务的完成而逐渐增加，直到到达百分之百的进度，以此来向用户展示任务的进度和完成情况。

### 图表构成

条形进度图由表示进度的矩形图元、表示背景的矩形图元、提示信息及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0b.png)

- `linearProgressChart.type`: 图表类型，条形进度图的类型为`'linearProgress'`
- `linearProgressChart.data`: 图表绘制的数据源
- `linearProgressChart.xField`: 分类字段，映射不同进度条，即进度条的数量由类别数量决定
- `linearProgressChart.yField`: 数值字段，映射表示进度的矩形图元长度。在 VChart 中进度条表示的进度不超过 100%，所以该字段下的数据应该在`[0, 1]`范围内

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `linearProgressChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/linearProgressChart#tooltip)
- 更多组件配置见[VChart linearProgressChart 配置](../../../option/linearProgressChart)

### 快速上手

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',

  cornerRadius: 20,
  bandWidth: 30
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

### 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与矩形长度字段

### 条形进度图特性

#### 数据

- 一个`离散` 字段，如: `type` ，表示数据类别，也可以理解为进度图所展示的是何种项目的进度
- 一个`数值`字段，如: `value` ，表示图元长度，也可以理解为要展示的进度值

由于一个进度图通常只展示一个项目的进度，所以数据通常只有一条。

```ts
data: [
  {
    id: 'linearProgress',
    values: [
      {
        type: '目标A',
        value: 0.6
      }
    ]
  }
];
```

#### 边距配置

通过`linearProgressChart.progress.leftPadding`、`linearProgressChart.progress.rightPadding`、`linearProgressChart.progress.topPadding`、`linearProgressChart.progress.bottomPadding`可以分别配置条形进度图的边距。

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.7
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  progress: {
    topPadding: 10,
    bottomPadding: 10
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 进度条宽度/高度配置

通过`linearProgressChart.bandWidth`可以配置进度条宽度/高度。

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.7
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  bandWidth: 50
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 线性渐变填充

通过 `linearProgressChart.progress.style.fill: { gradient: 'linear' }` 配置渐变颜色，可以得到渐变柱的效果。

```javascript livedemo
const gradientColor = {
  gradient: 'linear',
  x0: 0.5,
  y0: 0.4,
  x1: 1,
  y1: 0.5,
  stops: [
    {
      offset: 0,
      color: '#4FC6B4'
    },
    {
      offset: 1,
      color: '#31679E'
    }
  ]
};

const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',

  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    { orient: 'left', label: { visible: true }, type: 'band' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ],

  progress: {
    style: {
      fill: gradientColor
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 阈值模式填充

在进度图中人们往往希望使用不同的颜色代表进度状态，传达可视化的语义化表达。比如红色代表进度滞后，绿色代表进度顺利。
在 VChart 中可以通过图元属性映射的方式做到这一点，当然在任意图表图元上您都可以自定义属性映射。
定义方式如下:

```ts
progress: {
  style: {
    fill: {
      type: 'threshold', // 映射类型
      field: 'percent', // 映射字段
      domain: [0.6, 0.8], // 数据范围
      range: ['#D04D5B', '#ED9747', '#579E78'] // 映射结果范围
    }
  }
}
```

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.7
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  cornerRadius: 20,
  bandWidth: 30,

  progress: {
    style: {
      fill: {
        type: 'threshold',
        field: 'percent',
        domain: [0.6, 0.8],
        range: ['#D04D5B', '#ED9747', '#579E78']
      }
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

## 环形进度图

[\[配置项\]](../../../option/circularProgressChart)

环形进度图是一种圆形的进度图，通常包括一个背景圆环和一个内部填充弧形块，用来表示任务的进度和状态。在操作过程中，填充弧形块会随着任务的完成而逐渐增加，直到到达百分之百的进度，以此来向用户展示任务的进度和完成情况。

相较于条形进度图，环形进度图在相同尺寸下能够展示更多的信息，而且更加美观。它广泛应用于诸多领域，如健身、学习笔记、设计等。

### 图表构成

环形进度图由表示进度的弧形图元、表示背景的弧形图元、提示信息及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a07.png)

- `circularProgressChart.type`: 图表类型，环形进度图的类型为`'circularProgress'`
- `circularProgressChart.data`: 图表绘制的数据源
- `circularProgressChart.categoryField`: 分类字段，映射不同进度条，即进度条的数量由类别数量决定
- `circularProgressChart.valueField`: 数值字段，映射表示进度的弧形图元弧度范围

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `circularProgressChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/circularProgressChart#tooltip)
- 更多组件配置见[VChart circularProgressChart 配置](../../../option/circularProgressChart)

### 快速上手

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.8
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: 0.6,
  innerRadius: 0.5,
  cornerRadius: 20
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与弧形角度字段
- `innerRadius`、`outerRadius` 属性用于指定进度图的内外半径
- `cornerRadius`属性用于指定环形图元的边缘圆角

### 环形进度图特性

#### 数据

- 一个`离散` 字段，如: `type` ，表示数据类别，也可以理解为进度图所展示的是何种项目的进度
- 一个`数值`字段，如: `value` ，表示图元长度，也可以理解为要展示的进度值

对于环形进度图而言，如果有多条数据，会自动适配分组效果，所以支持多条数据。

```ts
data: [
  {
    id: 'circularProgress',
    values: [
      {
        type: '目标A',
        value: 0.6
      },
      {
        type: '目标B',
        value: 0.8
      }
    ]
  }
];
```

#### 分组环形进度图

当数据类别不止一个时，环形进度图会呈现分组的效果，即多个圆环嵌套，此时为了区分不同类别，可以通过`circularProgress.seriesField`指定分类字段，该字段将映射为图元颜色。

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  seriesField: 'type',
  radius: 0.8,
  innerRadius: 0.5,
  roundCap: true,
  cornerRadius: 20,
  progress: {
    style: {
      innerPadding: 5,
      outerPadding: 5
    }
  },
  axes: [
    {
      visible: false,
      type: 'linear',
      orient: 'angle'
    },
    {
      visible: false,
      type: 'band',
      orient: 'radius'
    }
  ],
  indicator: {
    visible: true,
    trigger: 'hover',
    title: {
      visible: true,
      field: 'type',
      autoLimit: true,
      style: {
        fontSize: 20,
        fill: 'black'
      }
    },
    content: [
      {
        visible: true,
        field: 'text',
        style: {
          fontSize: 16,
          fill: 'gray'
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'right',
    title: {
      visible: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 边距配置

通过`circularProgressChart.progress.innerPadding`、`circularProgressChart.progress.outerPadding`可以分别配置环形进度图的边内距和外边距。

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.8
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: 0.6,
  innerRadius: 0.5,
  cornerRadius: 20,
  innerPadding: 2,
  outerPadding: 5
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 圆角配置

可以通过`circularProgressChart.cornerRadius` 和 `circularProgressChart.roundCap`分别指定圆角半径和圆角部分是否突出。
