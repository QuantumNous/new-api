# Color Palette

In the process of data visualization, color is an extremely critical element. Choosing the right colors for a chart to highlight the characteristics of the data and match it appropriately is an art in data visualization. VChart provides users with powerful and flexible color palette features to meet the color needs of various application scenarios.

This tutorial will provide an in-depth analysis of the design and application of VChart's chart color palette and help users master the palette functions through practical examples.

## Concept of Color Palette

Before introducing the configuration of the color palette, we need to first understand the basic concept of the color palette.

VChart supports two types of color palettes:

- Data Palette: Assign colors to data items according to the number of data categories. The data palette is an ordered array containing several colors, such as `['red', 'blue', 'green']`.

- Semantic Palette: Support semantization of commonly used color values and use them anywhere in the chart spec to unify the color style. That is to assign meaningful names to colors to make them easier to maintain and modify.

We will introduce the configuration methods of these two palettes separately below.

## Palette Configuration in Theme

VChart's color palette feature is provided through theme configuration, that is, the `ITheme.colorScheme` configuration item (see the previous section). The type of this configuration item is `IThemeColorScheme`, declared as:

```ts
type IThemeColorScheme = {
  /** Required */
  default: ColorScheme;
} & Partial<Record<SeriesTypeEnum, ColorScheme>>;
```

The palette configuration accepts an object containing a default palette (`IThemeColorScheme.default`) and specific palettes for different series.

For example, if you want the color palette of the word cloud series to be different from the default, you can configure it like this:

```ts
const colorScheme: IThemeColorScheme = {
  /** Default palette */
  default: ['red', 'blue', 'green'],
  /** Word cloud series dedicated palette */
  wordCloud: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00']
};
```

These palette configurations have a `ColorScheme` type, declared as:

```ts
type ColorScheme = Array<string> | ProgressiveDataScheme<string> | IColorSchemeStruct;
```

This means that there are 3 types of palettes that can be configured, and data palettes and semantic palettes can be mixed and matched.

### Data Palette

The data palette configuration includes ordinary palettes (of type `Array<string>`) and progressive palettes (of type `ProgressiveDataScheme<string>`).

#### Ordinary Palette

The ordinary palette is the simplest data palette type, consisting of a set of colors. For example:

```javascript
const colorScheme: IThemeColorScheme = {
  /** Default palette */
  default: ['red', 'blue', 'green', '#98abc5', 'rgb(255, 128, 0)']
};
```

The ordinary palette can meet simple scenarios, such as line charts and bar charts where the data items are relatively fixed.

#### Progressive Palette

The type `ProgressiveDataScheme<string>` is a progressive palette. Progressive palettes allow for multiple sets of color schemes to exist simultaneously, and which color scheme to apply depends on the conditions given on the configuration or the user callback. The type definition of `ProgressiveDataScheme` is as follows:

```ts
/** Progressive data palette: consists of multiple palettes. When applied, it will judge the conditions attached to the palette (such as the `isAvailable` callback). If the conditions are met, the corresponding palette will be applied immediately */
type ProgressiveDataScheme<T> = Array<IProgressiveDataSchemeCase<T>>;

interface IProgressiveDataSchemeCase<T> {
  /** Optional, the maximum domain count suitable for this palette */
  maxDomainLength?: number;
  /** Optional, more flexible custom callback, returns whether to apply this palette. Will override maxDomainLength and other configurations */
  isAvailable?: boolean | ((domain: any[]) => boolean);
  /** Palette */
  scheme: T[];
}
```

Progressive palettes have richer features, allowing colors to be applied in stages based on the number of data categories. For example:

```ts
const colorScheme: IThemeColorScheme = {
  /** Default progressive palette */
  default: [
    {
      maxDomainLength: 3,
      scheme: ['#1f77b4', '#2ca02c', '#9467bd'] // Palette for 3 data items
    },
    {
      maxDomainLength: 5,
      scheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // Palette for 5 data items, inserting other color values between adjacent color values
    },
    {
      isAvailable: domain => domain.length > 5,
      scheme: ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'] // Complete palette
    }
  ]
};
```

Based on the above configuration, the chart will choose different data palettes in different scenarios. The performance below when the number of data items is small:

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

The performance below when the number of data items is large:

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

### Semantic Palette

The semantic palette allows you to define a mapping table for common colors so that they can be used anywhere in the chart configuration.

To add a semantic palette to the palette, you need to further extend the type. The type `IColorSchemeStruct` includes semantic palettes and data palettes and is the most functional palette definition. The type definition of `IColorSchemeStruct` is:

```ts
/** Complete palette structure */
type IColorSchemeStruct = {
  /** Data palette */
  dataScheme: Array<DataSchemeItem> | ProgressiveDataScheme<DataSchemeItem>;

  /** Semantic palette */
  palette?: {
    /** User-defined semantic color values */
    [key: string]: ColorSchemeItem;
  };
};
```

Where:

- `dataScheme` supports passing in the two types of data palettes described in the previous section, corresponding to the data palette where data items are applied as a domain.
- And `palette` is the semantic palette, which can be understood as a color dictionary composed of key-value pairs.

For example, you can expand the previous example and add a semantic palette to rewrite it as:

```ts
const colorScheme: IThemeColorScheme = {
  default: {
    // Data palette
    dataScheme: [
      {
        maxDomainLength: 3,
        scheme: ['#1f77b4', '#2ca02c', '#9467bd'] // Palette for 3 data items
      },
      {
        maxDomainLength: 5,
        scheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] // Palette for 5 data items, inserting other color values between adjacent color values
      },
      {
        isAvailable: domain => domain.length > 5,
        scheme: ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'] // Complete palette
      }
    ],
    // Semantic palette
    palette: {
      labelFontColor: '#89909D',
      primaryFontColor: '#000000',
      axisGridColor: '#EBEDF2',
      axisDomainColor: '#D9DDE4'
    }
  }
};
```

Note the semantic palette part of the configuration:

```ts
{
  ...
  // Semantic palette
  palette: {
    labelFontColor: '#89909D',
    primaryFontColor: '#000000',
    axisGridColor: '#EBEDF2',
    axisDomainColor: '#D9DDE4'
  }
}
```

Once the semantic palette is applied in the theme, the user spec can easily fetch colors using key values ​​anywhere. For example, configure the axis style in the spec:

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
        stroke: { type: 'palette', key: 'axisDomainColor' }, // semantic color value
        strokeOpacity: 1
      }
    },
    grid: {
      visible: true,
      style: {
        lineWidth: 1,
        stroke: { type: 'palette', key: 'axisGridColor' }, // semantic color value
        strokeOpacity: 1,
        lineDash: []
      }
    },
    tick: {
      visible: true,
      style: {
        lineWidth: 1,
        stroke: { type: 'palette', key: 'axisDomainColor' }, // semantic color value
        strokeOpacity: 1
      }
    },
    label: {
      visible: true,
      space: 10,
      style: {
        fill: { type: 'palette', key: 'labelFontColor' }, // semantic color value
        fontWeight: 'normal',
        fillOpacity: 1
      }
    }
  }];
}
```

Configurations that refer to semantic colors via the `IColorKey` structure appear several times in the examples above. The type definition of `IColorKey` is:

```ts
/** Color value index of semantic color value */
interface IColorKey {
  /** Color type declaration */
  type: 'palette';

  /** Color index */
  key: string;

  /** Brightness coefficient (optional, 0~1) */
  l?: number;

  /** Transparency coefficient (optional, 0~1) */
  a?: number;
}
```

With the perfect color palette function, when you need to modify the color matching of the entire chart, you only need to adjust the color palette configuration without modifying every detail. Realized the unified style and convenient maintenance.

This tutorial introduces the design and application of VChart chart color palette in detail, covering functions such as data color palette and semantic color palette. By rationally using the color palette function, users can easily customize beautiful and professional charts. In the actual application process, the color matching requirements in different scenarios are ever-changing, and users need to flexibly adjust the configuration according to actual needs. With the powerful color palette function of VChart, it will no longer be difficult to present beautiful data visualization effects.
