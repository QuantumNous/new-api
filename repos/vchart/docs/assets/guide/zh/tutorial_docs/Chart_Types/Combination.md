# 组合图

[\[配置项\]](../../../option/commonChart)

## 简介

组合图是一种数据可视化图表类型，是通过将相互依赖的数据集合并在一个图表中进行展示，以便更好地进行数据分析和比较的方法。组合图通常使用多个数据系列和多个视觉元素，如折线系列、柱状系列、面积系列、散点系列、饼系列等，以呈现各种类型的数据。在组合图中，每个数据系列通常有自己的图示和坐标轴，每个坐标轴可以使用不同的刻度范围和标签，以便更清晰地呈现不同的数据。

组合图的优势在于可以同时呈现来自多个数据集的信息，从而更全面地展示整体趋势和方向。通过将不同的数据类型、单位和度量组合在一起，可以为复杂的数据提供更深入和全面的洞察力。组合图广泛用于商业、科学、医疗等各种领域，以有效地分析和比较各种复杂数据。

![image](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f1d.png)

## 图表构成

如字面含义，组合图由不同图表系列、坐标轴、提示信息等不同组件组合而成。理论上而言，VChart 支持所有图表系列的排列组合，但在此之前需要通过部分配置确定不同系列的数据、布局等关系，从而让不同系列在合理摆放的同时都能够通过数据映射得到正确的图元属性。

- `commonChart.type: 'common'`: 图表类型，组合图的类型为`'common'`
- `commonChart.layout`: 确定组合图布局

  - `commonChart.layout.type`: 布局类型, `grid`为行列布局
  - `commonChart.layout.col`: 列数（注意: 所有图表中的独立元素都需要独占一列, 比如数据轴或其他组件 和 图表系列需要各占一列）
  - `commonChart.layout.row`: 行数（注意: 同上）
  - `commonChart.layout.col`: 指定列宽, 支持以`{ index: xx, size: xx }`的方式指定, `index`表示列所在的索引, `size`指列宽
  - `commonChart.layout.row`: 指定行高, 支持以`{ index: xx, size: xx }`的方式指定, `index`表示行所在的索引, `size`指行高
  - `commonChart.layout.elements`: 布局单元的 ID 以便数据系列与布局单位绑定. 以`{modelId: xx, row: xx, col: xx}`的方式声明, 其中`modelId`表示布局单元的 ID 名, `row`和`col`分别表示布局单元所在行和列的索引

- `commonChart.region`: 确定数据区域以便后续绑定, 使用相同数据的布局单元需要绑定相同的`regionId`, 如坐标轴和其对应的图表系列所在的布局单元. 声明方式为`id: xx`, 其中`id`表示数据区域 ID

- `commonChart.series`: 声明不同的图表系列, 在系列配置中`regionIndex`用于绑定图表系列所在的数据区域. `id`用于绑定轴所在的布局单元, 与`layout.elements`中的`modelId`一一对应。（由于数据区域与`layout.elements`中的`modelId`存在对应关系, 所以此处不需要声明`id`）

- `commonChart.axes`: 声明不同的坐标轴组件, `regionIndex`和`id`属性同上

## 使用说明

**因为组合图不限制坐标系，所以内部不能确定应该创建什么类型的坐标轴，所以在配置组合图时，必须声明 `axes` 属性，来声明使用什么类型的坐标轴。**

1. 对于直角坐标系，我们需要声明对应方向的坐标轴以及类型，举例如下：

```ts
axes: [
  { orient: 'left', type: 'linear' }, // 声明左轴为线性轴
  { orient: 'bottom', type: 'band' } // 声明下轴为离散轴
];
```

2. 对于极坐标系，我们需要声明对应方向的坐标轴以及类型，举例如下：

```ts
axes: [
  { orient: 'angle', type: 'band' }, // 声明圆弧轴为离散轴
  { orient: 'radius', type: 'linear' } // 声明半径轴为线性轴
];
```

## 组合图特性

### 双轴图（柱状图 + 折线图）

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
      id: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
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

#### 关键配置

- `type: 'common'` 声明为组合图类型
- `axes` 的 `seriesIndex` 属性配置为轴需要关联的 `series` 序号
- `axes` 的 `seriesId` 属性配置为轴需要关联的 `series` 的 `id` 的数组

### 线饼组合图（饼图 + 线图）

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 2,
    row: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
        row: 0
      },
      {
        modelId: 'pie-region',
        col: 0,
        colSpan: 2,
        row: 1
      },
      {
        modelId: 'axis-left',
        col: 0,
        row: 2
      },
      {
        modelId: 'line-region',
        col: 1,
        row: 2
      },
      {
        modelId: 'axis-bottom',
        col: 1,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'pie-region',
      height: '40%'
    },
    {
      id: 'line-region'
    }
  ],
  legends: {
    padding: {
      top: 10
    },
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'line-region']
  },
  series: [
    {
      regionId: 'pie-region',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 10 },
          { type: 'b', value: 20 }
        ]
      },
      seriesField: 'type'
    },
    {
      regionId: 'line-region',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line',
        values: [
          { x: '1', y: 10, type: 'a' },
          { x: '1', y: 20, type: 'b' },
          { x: '2', y: 30, type: 'a' },
          { x: '2', y: 40, type: 'b' }
        ]
      },
      seriesField: 'type'
    }
  ],
  axes: [
    {
      id: 'axis-left',
      regionId: 'line-region',
      orient: 'left'
    },

    {
      id: 'axis-bottom',
      regionId: 'line-region',
      orient: 'bottom'
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
vchart.on('dimensionHover', {}, params => {
  console.log(params);
});
// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 关键配置

- `type: 'common'` 声明为组合图类型
- `layout` 属性中配置多个 `region` 的布局

### 极坐标系下的组合图（雷达图 + 玫瑰图）

```javascript livedemo
const spec = {
  type: 'common',
  outerRadius: 0.9,
  series: [
    {
      type: 'rose',
      data: {
        values: [
          { key: 'North', value: 31 },
          { key: 'Northeast', value: 32 },
          { key: 'East', value: 21 },
          { key: 'Southeast', value: 15 },
          { key: 'South', value: 50 },
          { key: 'Southwest', value: 44 },
          { key: 'West', value: 32 },
          { key: 'Northwest', value: 32 },
          { key: 'North', value: 31 },
          { key: 'Northeast', value: 32 }
        ]
      },
      categoryField: 'key',
      valueField: 'value',
      stack: false,
      rose: {
        style: {
          lineWidth: 1,
          stroke: '#fff',
          fill: '#FF6666'
        }
      }
    },
    {
      type: 'radar',
      data: {
        values: [
          { key: 'North', value: 31, category: 'Destroyer' },
          { key: 'Northeast', value: 32, category: 'Destroyer' },
          { key: 'East', value: 21, category: 'Destroyer' },
          { key: 'Southeast', value: 15, category: 'Destroyer' },
          { key: 'South', value: 50, category: 'Destroyer' },
          { key: 'Southwest', value: 44, category: 'Destroyer' },
          { key: 'West', value: 32, category: 'Destroyer' },
          { key: 'Northwest', value: 32, category: 'Destroyer' },
          { key: 'North', value: 31, category: 'Destroyer' },
          { key: 'Northeast', value: 32, category: 'Destroyer' },
          { key: 'Southeast', value: 40, category: 'aircraft carrier' },
          { key: 'South', value: 25, category: 'aircraft carrier' },
          { key: 'Southwest', value: 22, category: 'aircraft carrier' },
          { key: 'West', value: 18, category: 'aircraft carrier' },
          { key: 'Northwest', value: 7, category: 'aircraft carrier' },
          { key: 'North', value: 24, category: 'aircraft carrier' },
          { key: 'Northeast', value: 43, category: 'aircraft carrier' },
          { key: 'East', value: 42, category: 'aircraft carrier' }
        ]
      },
      categoryField: 'key',
      valueField: 'value',
      seriesField: 'category',
      area: {
        style: {
          visible: datum => {
            return datum.category === 'Destroyer' ? false : true;
          },
          fillOpacity: 0.5
        }
      },
      line: {
        style: {
          lineWidth: 2
        }
      }
    }
  ],
  axes: [
    {
      orient: 'angle',
      grid: {
        alignWithLabel: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'radius',
      domainLine: {
        visible: false
      }
    }
  ],
  legends: {
    visible: true,
    interactive: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 关键配置

- `type: 'common'` 声明为组合图
- `series` 中配置对应的系列
- `axes` 声明角度轴和半径轴，注意，坐标轴信息必须声明，否则无法绘制

### 缓动函数可视化

```javascript livedemo
const easingFuncs = {
  linear: function (k) {
    return k;
  },
  quadIn: function (k) {
    return k * k;
  },
  quadOut: function (k) {
    return k * (2 - k);
  },
  quadInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k;
    }
    return -0.5 * (--k * (k - 2) - 1);
  },
  cubicIn: function (k) {
    return k * k * k;
  },
  cubicOut: function (k) {
    return --k * k * k + 1;
  },
  cubicInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k + 2);
  },
  quartIn: function (k) {
    return k * k * k * k;
  },
  quartOut: function (k) {
    return 1 - --k * k * k * k;
  },
  quartInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k * k;
    }
    return -0.5 * ((k -= 2) * k * k * k - 2);
  },
  quintIn: function (k) {
    return k * k * k * k * k;
  },
  quintOut: function (k) {
    return --k * k * k * k * k + 1;
  },
  quintInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k * k * k + 2);
  },
  circIn: function (k) {
    return 1 - Math.sqrt(1 - k * k);
  },
  circOut: function (k) {
    return Math.sqrt(1 - --k * k);
  },
  circInOut: function (k) {
    if ((k *= 2) < 1) {
      return -0.5 * (Math.sqrt(1 - k * k) - 1);
    }
    return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
  },
  elasticIn: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p));
  },
  elasticOut: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    return a * Math.pow(2, -10 * k) * Math.sin(((k - s) * (2 * Math.PI)) / p) + 1;
  },
  elasticInOut: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    if ((k *= 2) < 1) {
      return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p));
    }
    return a * Math.pow(2, -10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p) * 0.5 + 1;
  },
  backIn: function (k) {
    const s = 1.70158;
    return k * k * ((s + 1) * k - s);
  },
  backOut: function (k) {
    const s = 1.70158;
    return --k * k * ((s + 1) * k + s) + 1;
  },
  backInOut: function (k) {
    const s = 1.70158 * 1.525;
    if ((k *= 2) < 1) {
      return 0.5 * (k * k * ((s + 1) * k - s));
    }
    return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
  },
  bounceIn: function (k) {
    return 1 - easingFuncs.bounceOut(1 - k);
  },
  bounceOut: function (k) {
    if (k < 1 / 2.75) {
      return 7.5625 * k * k;
    } else if (k < 2 / 2.75) {
      return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
    } else if (k < 2.5 / 2.75) {
      return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
    }
    return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
  },
  bounceInOut: function (k) {
    if (k < 0.5) {
      return easingFuncs.bounceIn(k * 2) * 0.5;
    }
    return easingFuncs.bounceOut(k * 2 - 1) * 0.5 + 0.5;
  }
};

const POINTS = 30;
const row = 5;
const col = 5;
const region = [];
const layoutElements = [];
const series = [];
const axes = [];
const rowHeight = [];

Object.keys(easingFuncs).forEach((easingFuncName, index) => {
  const data = [];
  for (let i = 0; i < POINTS; i++) {
    data.push({
      x: i / POINTS,
      y: easingFuncs[easingFuncName](i / POINTS)
    });
  }

  region.push({
    id: easingFuncName
  });

  const seriesRow = Math.floor(index / col) + Math.floor(index / col);
  const seriesCol = index - Math.floor(index / col) * col;

  // 系列行
  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol + 1,
    modelId: easingFuncName
  });

  series.push({
    id: `${easingFuncName}Series`,
    type: 'line',
    xField: 'x',
    yField: 'y',
    data: { id: easingFuncName, values: data },
    point: { style: { visible: false } },
    line: { style: { lineWidth: 2 } },
    regionId: easingFuncName,
    animationAppear: {
      easing: easingFuncName
    },
    extensionMark: [
      {
        type: 'text',
        style: {
          text: easingFuncName,
          x: 0,
          y: 0,
          fill: 'black',
          fontSize: 12,
          textAlign: 'left',
          textBaseline: 'top'
        }
      }
    ]
  });

  axes.push({
    id: `${easingFuncName}Left`,
    orient: 'left',
    visible: false,
    max: 1.5,
    regionId: easingFuncName,
    seriesId: [`${easingFuncName}Series`]
  });

  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol,
    modelId: `${easingFuncName}Left`
  });

  axes.push({
    id: `${easingFuncName}Bottom`,
    orient: 'bottom',
    visible: false,
    regionId: easingFuncName,
    seriesId: [`${easingFuncName}Series`]
  });

  layoutElements.push({
    row: seriesRow + 1,
    col: seriesCol + seriesCol + 1,
    modelId: `${easingFuncName}Bottom`
  });

  if (seriesCol === 0) {
    rowHeight.push({
      index: seriesRow + 1,
      size: 10
    });
  }
});

const spec = {
  type: 'common',
  padding: {
    left: 30,
    right: 30
  },
  region,
  color: ['#6690F2', '#70D6A3', '#B4E6E2', '#63B5FC', '#FF8F62', '#FFDC83', '#BCC5FD', '#A29BFE'],
  layout: {
    type: 'grid',
    col: col * 2,
    row: row * 2,
    elements: layoutElements,
    rowHeight
  },
  axes,
  tooltip: false,
  series
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 关键配置

- `type: 'common'` 声明为组合图类型
- `layout` 属性中配置多个 `region` 的布局
- `animationAppear` 出场动画配置
  - `animationAppear.easing` 出场动画缓动函数配置

### 多 region 饼图（饼图 + 饼图）

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 1,
    row: 5,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 4
      },
      {
        modelId: 'DAU',
        col: 0,
        row: 0
      },
      {
        modelId: 'new added',
        col: 0,
        row: 1
      },
      {
        modelId: 'MAU',
        col: 0,
        row: 2
      },
      {
        modelId: 'DAU/MAU',
        col: 0,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'DAU'
    },
    {
      id: 'new added'
    },
    {
      id: 'MAU'
    },
    {
      id: 'DAU/MAU'
    }
  ],
  legends: {
    padding: {
      top: 10
    },
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionId: ['DAU', 'new added', 'MAU', 'DAU/MAU'],
    item: {
      visible: true,
      background: {
        style: {
          fill: 'transparent'
        }
      }
    }
  },
  series: [
    {
      id: 'DAUseries0',
      regionId: 'DAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU',
        values: [
          {
            type: 'front page',
            value: 120
          },
          {
            type: 'bi g',
            value: 100
          },
          {
            type: 'dashboard',
            value: 200
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'new added series0',
      regionId: 'new added',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'new added',
        values: [
          {
            type: 'front page',
            value: 80
          },
          {
            type: 'big screen',
            value: 200
          },
          {
            type: 'dashboard',
            value: 400
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'MAUseries0',
      regionId: 'MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'MAU',
        values: [
          {
            type: 'front page',
            value: 123
          },
          {
            type: 'big screen',
            value: 245
          },
          {
            type: 'dashboard',
            value: 367
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'DAU/MAUseries0',
      regionId: 'DAU/MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU/MAU',
        values: [
          {
            type: 'front page',
            value: 10
          },
          {
            type: 'big screen',
            value: 18
          },
          {
            type: 'dashboard',
            value: 8
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
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

#### 关键配置

- `type: 'common'` 声明为组合图类型
- `layout` 属性中配置多个 `region` 的布局
