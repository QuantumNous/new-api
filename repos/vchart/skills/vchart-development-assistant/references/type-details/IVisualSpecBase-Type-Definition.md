## IVisualSpecBase Type Definition

### Core Interface

`IVisualSpecBase<D, T>` 定义了VChart中比例尺（Scale）映射的基础配置，作为数据值到视觉属性转换的核心接口。

```typescript
interface IVisualSpecBase<D, T> {
  /**
   * type of scale
   */
  type: ScaleType;
  /**
   * will set to scale.domain, it means input of scale
   */
  domain: D[];
  /**
   * will set to scale.range, it means output of scale
   */
  range: T[];
  /**
   * will set to scale.specified if scale support, as a key-value pair matching capability
   * @since 1.1.0
   */
  specified?: { [key: string]: unknown };
  /**
   * enable clamp in linear scale
   * If clamp is enabled, the return value of the scale is always within the scale's range.
   * @since 1.13.6
   * @default false
   */
  clamp?: boolean;
}
```

### Type Parameters

#### Generic Type `D`
输入域（Domain）的数据类型：
- 对于连续比例尺：通常为`number`类型
- 对于离散比例尺：通常为`string`或`number`类型
- 代表比例尺函数的输入参数类型

#### Generic Type `T`
输出域（Range）的数据类型：
- 可以是任何视觉属性值类型
- 常见类型：`string`（颜色）、`number`（尺寸）、图形属性等
- 代表比例尺函数的输出结果类型

### Property Details

#### type: ScaleType
比例尺的类型，决定了数据映射的方式。

```typescript
type ScaleType = QuantScaleType | DiscreteScaleType;
type QuantScaleType = 'linear';
type DiscreteScaleType = 'ordinal' | 'band' | 'point' | 'threshold';
```

**支持的比例尺类型：**
- `'linear'`: 线性连续映射，适用于数值数据的连续转换
- `'ordinal'`: 序数离散映射，通过数组索引进行对应
- `'band'`: 带状映射，常用于分类轴
- `'point'`: 点状映射，用于散点图等场景
- `'threshold'`: 阈值映射，基于阈值进行分段映射

#### domain: D[]
定义域，表示比例尺函数的输入参数范围。

**线性比例尺示例：**
```typescript
// 数值区间
domain: [0, 100]
```

**离散比例尺示例：**
```typescript
// 分类值数组
domain: ['category1', 'category2', 'category3']
```

#### range: T[]
值域，表示比例尺函数的输出结果范围。

**颜色映射示例：**
```typescript
range: ['#ff0000', '#00ff00', '#0000ff']
```

**尺寸映射示例：**
```typescript
range: [4, 24]
```

**形状映射示例：**
```typescript
range: ['circle', 'rect', 'triangle']
```

#### specified?: { [key: string]: unknown }
指定映射配置，提供键值对的直接映射能力。

```typescript
// 示例：为特定值指定固定映射
specified: {
  'special': 'red',    // 'special' 值固定映射为 'red'
  'important': 'blue'  // 'important' 值固定映射为 'blue'
}
```

**执行优先级：**
1. 首先检查`specified`中是否有直接匹配
2. 如果匹配，直接返回指定值
3. 否则按正常比例尺逻辑进行映射

**适用场景：**
- 仅在`type: 'ordinal'`时生效
- 用于特殊值的固定映射
- 覆盖默认的索引映射行为

#### clamp?: boolean
线性比例尺的钳制模式配置。

```typescript
clamp: true  // 启用钳制模式
clamp: false // 禁用钳制模式（默认）
```

**功能说明：**
- 仅对`type: 'linear'`的比例尺生效
- 启用时，输出值被限制在range范围内
- 禁用时，允许输出值超出range范围

**使用示例：**
```typescript
// clamp: false（默认）
scale = { type: 'linear', domain: [0, 100], range: [0, 50] }
scale(150) // 返回 75（超出range）

// clamp: true
scale = { type: 'linear', domain: [0, 100], range: [0, 50], clamp: true }
scale(150) // 返回 50（被钳制到range最大值）
```

### Inheritance Hierarchy

#### IVisualSpecStyle
用于Mark样式映射配置，添加了数据字段绑定能力。

```typescript
interface IVisualSpecStyle<D, T> extends IVisualSpecBase<D, T> {
  /**
   * 指定映射对应的数据字段
   */
  field?: string;
}
```

#### IVisualSpecScale
用于全局比例尺配置，支持多种域定义方式。

```typescript
interface IVisualSpecScale<D, T> extends Omit<IVisualSpecBase<D, T>, 'domain'> {
  /**
   * scale 的id
   */
  id: string;
  /**
   * 定义域范围
   */
  domain: IVisualSpecBase<D, T>['domain'] | IDataDomainSpec[];
}
```

### Usage Scenarios

#### 线性比例尺配置
用于连续数值的视觉映射：

```typescript
const sizeScale: IVisualSpecBase<number, number> = {
  type: 'linear',
  domain: [0, 1000],
  range: [4, 24],
  clamp: true
};
```

#### 离散比例尺配置
用于分类数据的视觉映射：

```typescript
const colorScale: IVisualSpecBase<string, string> = {
  type: 'ordinal',
  domain: ['A', 'B', 'C'],
  range: ['red', 'blue', 'green'],
  specified: {
    'special': 'orange'
  }
};
```

#### 复合属性映射
用于复杂视觉属性的映射：

```typescript
const dashScale: IVisualSpecBase<string, number[]> = {
  type: 'ordinal',
  domain: ['solid', 'dashed'],
  range: [[1, 0], [4, 4]]
};
```

### Integration with VChart

#### 全局比例尺系统
`IVisualSpecBase`是VChart全局比例尺系统的核心：

```typescript
interface IGlobalScale {
  getScale: (user_id: string) => IBaseScale | null;
  getScaleSpec: (user_id: string) => IVisualSpecScale<unknown, unknown> | null;
  registerModelScale: (spec: IVisualSpecScale<unknown, unknown>) => void;
}
```

#### 样式映射系统
在Mark样式配置中的应用：

```typescript
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
  [key in keyof T]: VisualType<T[key]>;
};
```

#### 数据驱动映射
与数据字段的绑定关系：

```typescript
type IDataDomainSpec = {
  dataId: string;
  fields: string[];
};
```

### Scale Creation and Management

#### Scale实例化
基于`IVisualSpecBase`创建实际的比例尺对象：

```typescript
function createScaleWithSpec(
  spec: IVisual<any>,
  context: { globalScale: IGlobalScale; seriesId: number }
): IBaseScale | null;
```

#### 属性更新机制
支持动态更新比例尺配置：

```typescript
function initScaleWithSpec(scale: IBaseScale, spec: IVisualSpecBase<any, any>): void;
```

### Best Practices

#### 类型安全
使用泛型确保域和值域类型的一致性：

```typescript
// 推荐：明确类型
const scale: IVisualSpecBase<number, string> = {
  type: 'linear',
  domain: [0, 100],
  range: ['#ff0000', '#0000ff']
};
```

#### 性能优化
合理配置specified映射，避免复杂计算：

```typescript
// 对于频繁访问的特殊值，使用specified直接映射
const scale: IVisualSpecBase<string, string> = {
  type: 'ordinal',
  domain: ['normal', 'special', 'urgent'],
  range: ['gray', 'orange', 'red'],
  specified: {
    'vip': 'gold'  // VIP用户的特殊颜色
  }
};
```

#### 域范围设计
根据数据特征合理设计domain和range：

```typescript
// 连续数据：使用合理的数值区间
const sizeScale: IVisualSpecBase<number, number> = {
  type: 'linear',
  domain: [0, 100],  // 基于实际数据范围
  range: [2, 20],    // 基于视觉效果需求
  clamp: true        // 防止异常值影响显示
};
```
