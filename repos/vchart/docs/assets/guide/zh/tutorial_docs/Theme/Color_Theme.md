# 色板

在对数据进行可视化的过程中，颜色是极为关键的元素。如何为图表选择合适的色彩，以突显数据的特征并搭配得体，是数据可视化中的一门艺术。VChart 为用户提供了强大且灵活的色板功能，能满足各种应用场景下的色彩需求。

本教程将深入剖析 VChart 图表色板的设计和应用，通过实例落地，帮助用户熟练使用色板功能。

## 色板的概念

在介绍色板配置之前，我们需要先了解色板的基本概念。

VChart 支持的色板分为两大类：

- 数据色板：根据数据类别的个数，为数据项分别赋予颜色。数据色板是一个包含了若干颜色的有序数组，例如 `['red', 'blue', 'green']`。

- 语义色板：支持将常用色值语义化并在图表 spec 中随处使用，以统一色彩风格。也就是为颜色赋予有意义的名称，从而方便维护和修改。

下面将分别介绍两种色板的配置方法。

## 主题上的色板配置

VChart 的色板功能通过主题配置提供，即`ITheme.colorScheme`配置项（详见上一小节）。该配置项的类型为`IThemeColorScheme`，声明为：

```ts
type IThemeColorScheme = {
  /** 必选 */
  default: ColorScheme;
} & Partial<Record<SeriesTypeEnum, ColorScheme>>;
```

色板配置接受一个对象，包含默认色板（`IThemeColorScheme.default`）和针对不同系列的特定色板。

例如，如果希望词云系列的色板与默认色板不同，可以这样配置：

```ts
const colorScheme: IThemeColorScheme = {
  /** 默认色板 */
  default: ['red', 'blue', 'green'],
  /** 词云系列专用色板 */
  wordCloud: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00']
};
```

这些色板的配置类型为`ColorScheme`，声明为：

```ts
type ColorScheme = Array<string> | ProgressiveDataScheme<string> | IColorSchemeStruct;
```

意味着有 3 种类型可以配到色板里，并可以选配数据色板和语义色板。

### 数据色板

数据色板配置包括普通色板（`Array<string>`类型）和渐进式色板（`ProgressiveDataScheme<string>`类型）。

#### 普通色板

普通色板是最简单的数据色板类型，由一组颜色组成。例如：

```javascript
const colorScheme: IThemeColorScheme = {
  /** 默认色板 */
  default: ['red', 'blue', 'green', '#98abc5', 'rgb(255, 128, 0)']
};
```

普通色板可以满足简单的场景，如数据项较固定的折线图、柱状图等。

#### 渐进式色板

类型`ProgressiveDataScheme<string>`为渐进式色板。渐进式色板允许同时存在多套色板方案，具体应用哪个色板需要靠检查配置上给出的条件或者执行用户回调来判断。`ProgressiveDataScheme`的类型定义如下：

```ts
/** 渐进式数据色板：由多个色板组成，应用时会依次判断色板上附带的条件（如 `isAvailable` 回调），如果满足条件则立即应用对应色板 */
type ProgressiveDataScheme<T> = Array<IProgressiveDataSchemeCase<T>>;

interface IProgressiveDataSchemeCase<T> {
  /** 可选，适合此色板的最大 domain 数量 */
  maxDomainLength?: number;
  /** 可选，更加灵活的自定义回调，返回是否应用此色板。将覆盖 maxDomainLength 等配置 */
  isAvailable?: boolean | ((domain: any[]) => boolean);
  /** 色板 */
  scheme: T[];
}
```

渐进式色板功能更为丰富，允许根据数据类别的个数，来分档应用颜色。例如：

```ts
const colorScheme: IThemeColorScheme = {
  /** 默认渐进式色板 */
  default: [
    {
      maxDomainLength: 3,
      scheme: ['#1f77b4', '#2ca02c', '#9467bd'] // 适用于 3 个数据项的色板
    },
    {
      maxDomainLength: 5,
      scheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // 适用于 5 个数据项的色板，在相邻色值之间插入了其他色值
    },
    {
      isAvailable: domain => domain.length > 5,
      scheme: ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'] // 完整色板
    }
  ]
};
```

基于上述配置，在不同场景下，图表会选择不同的数据色板。以下在数据项个数较小时的表现：

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' }
];
const colorScheme = {
  /** 默认渐进式色板 */
  default: [
    {
      maxDomainLength: 3,
      scheme: ['#1f77b4', '#2ca02c', '#9467bd'] // 适用于 3 个数据项的色板
    },
    {
      maxDomainLength: 5,
      scheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // 适用于 5 个数据项的色板，在相邻色值之间插入了其他色值
    },
    {
      isAvailable: domain => domain.length > 5,
      scheme: ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'] // 完整色板
    }
  ]
};
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  theme: { colorScheme },
  outerRadius: 0.8,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  legends: {
    visible: true,
    orient: 'bottom',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

以下在数据项个数较大时的表现：

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const colorScheme = {
  /** 默认渐进式色板 */
  default: [
    {
      maxDomainLength: 3,
      scheme: ['#1f77b4', '#2ca02c', '#9467bd'] // 适用于 3 个数据项的色板
    },
    {
      maxDomainLength: 5,
      scheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // 适用于 5 个数据项的色板，在相邻色值之间插入了其他色值
    },
    {
      isAvailable: domain => domain.length > 5,
      scheme: ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'] // 完整色板
    }
  ]
};
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  theme: { colorScheme },
  outerRadius: 0.8,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  legends: {
    visible: true,
    orient: 'bottom',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 语义色板

语义色板允许为常用的颜色定义映射表，以便在图表配置中随处使用。

为色板中添加语义色板需要继续扩展类型。类型`IColorSchemeStruct`包含了语义色板和数据色板，是功能最多的色板定义。`IColorSchemeStruct`的类型定义为：

```ts
/** 色板总结构 */
type IColorSchemeStruct = {
  /** 数据色板 */
  dataScheme: Array<DataSchemeItem> | ProgressiveDataScheme<DataSchemeItem>;

  /** 语义色板 */
  palette?: {
    /** 用户自定义语义化色值 */
    [key: string]: ColorSchemeItem;
  };
};
```

其中：

- `dataScheme` 支持传入上节所述两种数据色板类型，对应着数据项作为 domain 应用的数据色板。
- 而`palette`为语义色板，可以理解为颜色字典，由 key-value 对组成。

例如，将上一个示例进行扩展，加上语义色板就可以改写为：

```ts
const colorScheme: IThemeColorScheme = {
  default: {
    // 数据色板
    dataScheme: [
      {
        maxDomainLength: 3,
        scheme: ['#1f77b4', '#2ca02c', '#9467bd'] // 适用于 3 个数据项的色板
      },
      {
        maxDomainLength: 5,
        scheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // 适用于 5 个数据项的色板，在相邻色值之间插入了其他色值
      },
      {
        isAvailable: domain => domain.length > 5,
        scheme: ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'] // 完整色板
      }
    ],
    // 语义色板
    palette: {
      labelFontColor: '#89909D',
      primaryFontColor: '#000000',
      axisGridColor: '#EBEDF2',
      axisDomainColor: '#D9DDE4'
    }
  }
};
```

注意语义色板部分的配置：

```ts
{
  ...
  // 语义色板
  palette: {
    labelFontColor: '#89909D',
    primaryFontColor: '#000000',
    axisGridColor: '#EBEDF2',
    axisDomainColor: '#D9DDE4'
  }
}
```

在主题中应用了语义色板，在用户 spec 各处就可以做到通过 key 值来取色。例如，在 spec 中配置轴样式：

```ts
const chartSpec = {
  ...chart spec
  axis: [{
    orient: 'bottom',
    type: 'band',
    domainLine: {
      visible: true,
      style: {
        lineWidth: 1,
        stroke: { type: 'palette', key: 'axisDomainColor' }, // 语义色值
        strokeOpacity: 1
      }
    },
    grid: {
      visible: true,
      style: {
        lineWidth: 1,
        stroke: { type: 'palette', key: 'axisGridColor' }, // 语义色值
        strokeOpacity: 1,
        lineDash: []
      }
    },
    tick: {
      visible: true,
      style: {
        lineWidth: 1,
        stroke: { type: 'palette', key: 'axisDomainColor' }, // 语义色值
        strokeOpacity: 1
      }
    },
    label: {
      visible: true,
      space: 10,
      style: {
        fill: { type: 'palette', key: 'labelFontColor' }, // 语义色值
        fontWeight: 'normal',
        fillOpacity: 1
      }
    }
  }];
}
```

上面的示例中多次出现了通过`IColorKey`结构引用语义颜色的配置。`IColorKey`的类型定义为：

```ts
/** 语义化色值的色值索引 */
interface IColorKey {
  /** 颜色type声明 */
  type: 'palette';

  /** 颜色索引 */
  key: string;

  /** 明度系数（可选，0~1） */
  l?: number;

  /** 透明度系数（可选，0~1） */
  a?: number;
}
```

有了完善的色板功能，当需要修改整个图表的配色时，只需调整色板配置即可，无需修改每个细节。实现了风格统一、方便维护。

本教程详细介绍了 VChart 图表色板的设计和应用，涵盖了数据色板、语义色板等功能。通过合理运用色板功能，用户可以轻松定制出漂亮、专业的图表。在实际应用过程中，不同场景下的色彩搭配需求千变万化，用户需根据实际需求灵活调整配置。借助 VChart 强大的色板功能，呈现优美的数据可视化效果将不再是难事。
