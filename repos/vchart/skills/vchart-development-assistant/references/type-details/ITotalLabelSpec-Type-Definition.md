## ITotalLabelSpec Type Definition

### Core Interface

`ITotalLabelSpec` 定义了堆叠图表中汇总标签的配置选项，它继承了基础标签配置的核心功能，并为堆叠场景增加了专用的位置和计算控制选项。

```typescript
type ITotalLabelSpec = Pick<
  ILabelSpec,
  'visible' | 'formatMethod' | 'interactive' | 'offset' | 'style' | 'state' | 'textType' | 'overlap'
> & {
  /**
   * 堆叠汇总标签的位置，在一组堆积图元的上方或下方
   * @default 'top'
   */
  position?: 'top' | 'bottom';

  /**
   * 不管总计标签是否展示，内部都默认计算总计值
   * @default false
   */
  alwayCalculateTotal?: boolean;
};
```

### 继承属性详解

#### visible: 显示控制

- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 控制堆叠汇总标签是否显示，仅在图表支持堆叠配置（`stack: true`）时生效

#### formatMethod: 格式化函数

- **类型**: `IFormatMethod<[text: string | string[], datum?: Datum, ctx?: ILabelFormatMethodContext]>`
- **说明**: 标签内容格式化函数，支持返回富文本结构
- **用法**:
  ```typescript
  formatMethod: (text, datum, ctx) => {
    return `Total: ${text}`;
  };
  ```

#### interactive: 交互配置

- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 标签是否支持交互事件

#### offset: 偏移距离

- **类型**: `number`
- **默认值**: `5`
- **单位**: 像素
- **说明**: 标签与对应数据图元的距离

#### style: 样式配置

- **类型**: `ConvertToMarkStyleSpec<IComposedTextMarkSpec>`
- **说明**: 标签的视觉样式配置，包括字体、颜色、大小等
- **示例**:
  ```typescript
  style: {
    fontSize: 12,
    fill: '#333',
    fontWeight: 'bold'
  }
  ```

#### state: 交互状态样式

- **类型**: `LabelStateStyle<Partial<IComposedTextMarkSpec>>`
- **说明**: 不同交互状态下的样式配置
- **包含状态**:
  - `hover`: 鼠标悬浮状态
  - `hover_reverse`: 鼠标悬浮反向状态
  - `selected`: 选中状态
  - `selected_reverse`: 选中反向状态

#### textType: 文本类型

- **类型**: `'text' | 'rich'`
- **标记**: `@deprecated` (1.10.0 版本后在 formatMethod 中返回富文本结构)
- **说明**: 文本类型配置

#### overlap: 防重叠配置

- **类型**: `BaseLabelAttrs['overlap'] & { padding?: DataLabelAttrs['size']['padding']; }`
- **说明**: 标签防重叠配置，包含策略、边距等选项
- **重要**: 当图表同时显示 `totalLabel` 和 `label` 时，`totalLabel` 的布局优先级高于 `label`

### 专用属性详解

#### position: 标签位置

- **类型**: `'top' | 'bottom'`
- **默认值**: `'top'`
- **版本**: 自 1.13.7 版本支持
- **说明**: 堆叠汇总标签的显示位置
  - `'top'`: 显示在堆积图元的顶部
  - `'bottom'`: 显示在堆积图元的底部

#### alwayCalculateTotal: 总计计算控制

- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 控制是否始终计算总计值，即使标签不显示也会进行内部计算

### 支持类型解析

#### LabelStateStyle 状态样式

```typescript
type LabelStateStyle<T> = {
  /**
   * 标签hover状态样式配置
   */
  hover?: T;
  /**
   * 标签hover_reverse状态样式配置
   */
  hover_reverse?: T;
  /**
   * 标签选中状态样式配置
   */
  selected?: T;
  /**
   * 标签未选中状态样式配置
   */
  selected_reverse?: T;
};
```

#### 防重叠配置类型

```typescript
type OverlapConfig =
  | boolean
  | {
      /**
       * 重叠处理策略配置
       */
      strategy?: OverlapStrategy[];
      /**
       * 重叠时是否隐藏标签
       * @default false
       */
      hideOnHit?: boolean;
      /**
       * 是否避免与基础图元重叠
       * @default true
       */
      avoidBaseMark?: boolean;
      /**
       * 是否强制限制在容器内
       * @default false
       */
      clampForce?: boolean;
      /**
       * 防重叠区域边距
       */
      padding?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
      };
    };
```

### 使用场景

#### 基础配置

```typescript
const basicTotalLabel: ITotalLabelSpec = {
  visible: true,
  position: 'top',
  style: {
    fontSize: 12,
    fill: '#333'
  }
};
```

#### 格式化配置

```typescript
const formattedTotalLabel: ITotalLabelSpec = {
  visible: true,
  formatMethod: (text, datum) => {
    return `Total: ${text}`;
  },
  style: {
    fontSize: 14,
    fontWeight: 'bold'
  }
};
```

#### 交互式配置

```typescript
const interactiveTotalLabel: ITotalLabelSpec = {
  visible: true,
  interactive: true,
  position: 'bottom',
  state: {
    hover: {
      fill: '#1890ff',
      fontSize: 16
    },
    selected: {
      fill: '#f5222d',
      fontWeight: 'bold'
    }
  }
};
```

#### 防重叠配置

```typescript
const overlapTotalLabel: ITotalLabelSpec = {
  visible: true,
  overlap: {
    hideOnHit: true,
    clampForce: true,
    strategy: [
      {
        type: 'position',
        position: ['top', 'bottom']
      }
    ],
    padding: { top: 2, bottom: 2, left: 4, right: 4 }
  }
};
```

#### 完整配置示例

```typescript
const completeTotalLabel: ITotalLabelSpec = {
  visible: true,
  position: 'top',
  alwayCalculateTotal: true,
  interactive: true,
  offset: 8,
  formatMethod: (text, datum) => {
    const value = parseFloat(text as string);
    return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : text;
  },
  style: {
    fontSize: 12,
    fill: '#333',
    fontWeight: 'bold',
    stroke: '#fff',
    lineWidth: 1
  },
  state: {
    hover: {
      fill: '#1890ff',
      fontSize: 14
    }
  },
  overlap: {
    clampForce: true,
    avoidBaseMark: true,
    strategy: [
      {
        type: 'position',
        position: ['top', 'bottom']
      }
    ]
  }
};
```

### 在系列配置中的应用

#### 堆叠柱状图

```typescript
const barChartWithTotalLabel = {
  type: 'bar',
  stack: true,
  data: stackedData,
  xField: 'category',
  yField: 'value',
  seriesField: 'series',
  totalLabel: {
    visible: true,
    position: 'top',
    formatMethod: text => `Sum: ${text}`,
    style: {
      fontSize: 12,
      fill: '#333'
    }
  }
};
```

#### 堆叠面积图

```typescript
const areaChartWithTotalLabel = {
  type: 'area',
  stack: true,
  data: stackedData,
  xField: 'time',
  yField: 'value',
  seriesField: 'category',
  totalLabel: {
    visible: true,
    position: 'top',
    offset: 5,
    interactive: true
  }
};
```

### 与 ITotalLabelTheme 的关系

`ITotalLabelTheme` 是主题配置接口，包含 `ITotalLabelSpec` 的部分属性：

```typescript
interface ITotalLabelTheme
  extends Pick<ILabelSpec, 'visible' | 'interactive' | 'offset' | 'overlap' | 'smartInvert' | 'animation'> {
  style?: ITextMarkSpec;
}
```
