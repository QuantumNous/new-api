# 数据类型与数据定义

绝大部分情况下，图表的作用就是将数据转换为图形化的形式，使得数据分析变得更加容易和高效。作为图表的重要组成部分，VChart 支持多种格式的数据，下面开始逐一介绍

## 支持的数据类型

### 展平的数据对象

在 VChart 中，多数情况下我们会期望使用`展平`的数据对象。`展平`的数据对象与`非展平`的数据对象区别见下方这个例子

```js
// 非展平数据对象
[
    {date: "Monday", class No.1: 20, class No.2: 30},
    {date: "Tuesday", class No.1: 25, class No.2: 28},
]
// 展平数据对象
[
    { date: "Monday", class: "class No.1", score: 20 },
    { date: "Monday", class: "class No.2", score: 30 },

    { date: "Tuesday", class: "class No.1", score: 25 },
    { date: "Tuesday", class: "class No.2", score: 28 },
]
```

可以看到非展平数据中的 "class No.1"、"class No.2" 两个数据中的 key 被展开。上方的一条数据被展开为 2 条数据。在可视化中这是一种常用的数据处理方式 `fold`。

展平数据最重要的意义在于，可以使数据与图形产生一对一的对应关系。以上面的数据举例，我们用它做一个分组柱图。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class No.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score',
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

可以看到图表中出现了四个柱子，每一个柱子与数据中的一个条目对应。

在可视化中，很多时候我们会期望将数据的特征表现在图形上，使用每一个数据对应一个图形可以很好的帮助我们编码数据与图形的对应关系。

还是这份数据，使用散点图来展示它

- 使用形状来表示它的班级
- 使用大小来表示它的分数
- 使用颜色来表示它的日期
- 超过 30 分的数据，标记为红色

```javascript livedemo
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'scatterData',
      values: [
        { date: 'Monday', class: 'class No.1', score: 20 },
        { date: 'Monday', class: 'class No.2', score: 30 },

        { date: 'Tuesday', class: 'class No.1', score: 25 },
        { date: 'Tuesday', class: 'class', score: 28 }
      ]
    }
  ],
  shape: {
    type: 'ordinal',
    domain: ['class No.1', 'class No.2'],
    range: ['circle', 'rect']
  },
  shapeField: 'class',
  size: {
    type: 'linear',
    domain: [20, 30],
    range: [10, 50]
  },
  sizeField: 'score',
  seriesField: 'date',
  point: {
    state: {
      superScore: {
        filter: datum => datum.score >= 30,
        style: {
          fill: 'red'
        }
      }
    }
  },
  xField: 'date',
  yField: 'score',
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### 数据展平

我们提供了一个数据展平工具 `transform` `fold`，可以帮助用户将非展平数据展平。在 VChart 中，我们提供了多种内置的数据处理工具，并且支持用户传入更多自定义数据处理工具。具体方法请参考 [DataSet](./Dataset_and_Data_Processing)。

`fold` 使用示例如下：

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { date: 'Monday', 'class No.1': 20, 'class No.2': 30 },
        { date: 'Tuesday', 'class No.1': 25, 'class No.2': 28 }
      ],
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'class', // 转化后，原始数据的 key 放入这个配置对应的字段中作为值
            value: 'score', // 转化后，原始数据的 value 放入这个配置对应的字段中作为值
            fields: ['class No.1', 'class No.2'] // 需要转化的维度
          }
        }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score',
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### csv 数据对象

除了数据对象，我们也支持用户传入 csv 文本内容作为数据源。只需要配置解析方式为 `csv`

使用方式如下：

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: `date,class No.1,class No.2
Monday,20,30
Tuesday,25,28`,
      parser: {
        type: 'csv'
      },
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'class',
            value: 'score',
            fields: ['class No.1', 'class No.2']
          }
        }
      ]
    }
  ],
  seriesField: 'class',
  xField: ['date', 'class'],
  yField: 'score'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 树形结构的数据对象

在旭日图，矩形树图这样的图表中，需要使用树形结构数据。

目前只支持标准的树形数据对象，示例如下：

```javascript livedemo
const data = [
  {
    name: 'Grandpa',
    children: [
      {
        name: 'Uncle Leo',
        value: 15,
        children: [
          {
            name: 'Cousin Jack',
            value: 2
          },
          {
            name: 'Cousin Mary',
            value: 5,
            children: [
              {
                name: 'Jackson',
                value: 2
              }
            ]
          },
          {
            name: 'Cousin Ben',
            value: 4
          }
        ]
      },
      {
        name: 'Father',
        value: 10,
        children: [
          {
            name: 'Me',
            value: 5
          },
          {
            name: 'Brother Peter',
            value: 1
          }
        ]
      }
    ]
  },
  {
    name: 'Nancy',
    children: [
      {
        name: 'Uncle Nike',
        children: [
          {
            name: 'Cousin Betty',
            value: 1
          },
          {
            name: 'Cousin Jenny',
            value: 2
          }
        ]
      }
    ]
  }
];

const spec = {
  type: 'sunburst',
  offsetX: 0,
  offsetY: 20,
  categoryField: 'name',
  valueField: 'value',
  outerRadius: 0.75,
  innerRadius: 0,
  gap: 0,
  labelLayout: {
    align: 'start',
    rotate: 'radial',
    offset: 60
  },
  drill: true,
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  tooltip: {
    mark: {
      title: {
        value: val => {
          return val?.datum?.map(data => data.name).join(' / ');
        }
      }
    }
  },
  data: [
    {
      id: 'data',
      values: data
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 其他结构

有些图表可能会使用独特的数据结构，具体情况在对应图表的文档中会有说明。

## 数据配置

从上方的例子中可以看到，图表的数据配置在 spec 的最外层，使用数组结构，支持传入多条数据，默认情况下会使用第一条数据。

```js
const spec = {
  data: [
    {
      // 数据id
      id: string;
      // 数据内容
      values: string | Array<Object> | Object;
      // 解析方式
      parser?: {
        type: 'csv' | 'dsv'
      },
      transforms?: Transform[];
      // 当前数据引用其他数据
      //引用的数据索引
      fromDataIndex?: number;
      //引用的数据 id
      fromDataId?: string | number;
    }
  ]
}
```

### 数据对象的基本内容

数据对象的关键内容有 2 项

- `id` 数据的唯一 id 在其他模块中可以通过这个 id 索引到这份数据。
- `values` 数据的内容。支持的数据类型在下方有详细介绍。

### transforms

transform 是对数据内容的处理，将数据进行变换等操作，改变数据的结构或者内容，使原始数据可以被图表使用，或者是提取数据原始数据中的某些内容生成新数据。下方示例中有详细的使用介绍。

### 使用数据生成新数据

通过如下配置项，可以从一份原始数据再生成出一份新数据

- `fromDataIndex` 当前数据的原始数据在 data 数组中的索引。
- `fromDataId` 当前数据的原始数据的 id 。配置了 `fromDataId` 后 `fromDataIndex` 将失效

> 注意：配置了 `fromDataId` 或者 `fromDataIndex` 后，`values` 配置将失效。当前的数据的 `values` 将来自它依赖数据的数据内容。

### 使用示例

下方的例子中我们将做如下处理

1. 会先将原始数据展平，
2. 产生一份新数据
3. 并且在新数据中，筛选掉等于 `null` 或者 `undefined` 的数据

```js
const spec = {
  data: [
    {
      id: "dataSource",
      values: [
        { date: "Monday", class No.1: 20, class No.2: 30 },
        { date: "Tuesday", class No.1: 25, class No.2: 28 },
        { date: "周三", class No.1: null, class No.2: undefined },
      ],
      transforms: [
        {
          type: "fold",
          options: {
            key: "class", // 转化后，原始数据的 key 放入这个配置对应的字段中作为值
            value: "score", // 转化后，原始数据的 value 放入这个配置对应的字段中作为值
            fields: ["class No.1", "class No.2"], // 需要转化的维度
          },
        },
      ],
    },
    {
      id: "dataNoEmpty",
      fromDataId: "dataSource",
      transforms: [
        {
          type: "filter",
          option: {
            callBack: (datum) =>
              // 此时的 datum 是 barData 经过变化后的数据条数
              datum.score !== null && datum.score !== undefined,
          },
        },
      ],
    },
  ],
};
// 上方配置后，最终2个数据的实际内容为
// dataSource
[
    { date: "Monday", class: "class No.1", score: 20 },
    { date: "Monday", class: "class No.2", score: 30 },
    { date: "Tuesday", class: "class No.1", score: 25 },
    { date: "Tuesday", class: "class No.2", score: 28 },
    { date: "周三", class: "class No.1", score: null },
    { date: "周三", class: "class No.2", score: undefined },
]
// dataNoEmpty
[
    { date: "Monday", class: "class No.1", score: 20 },
    { date: "Monday", class: "class No.2", score: 30 },
    { date: "Tuesday", class: "class No.1", score: 25 },
    { date: "Tuesday", class: "class No.2", score: 28 },
]
// 在图表的系列中可以根据需要使用数据
```
