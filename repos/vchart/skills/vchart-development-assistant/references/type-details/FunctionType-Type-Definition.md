## FunctionType Type Definition

### Core Interface

`FunctionType<T>` 定义了VChart中用于动态计算样式属性的函数类型，支持基于数据和上下文的动态样式计算。

```typescript
type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
```

### Type Parameters

#### Generic Type `T`
- 函数返回值的类型
- 可以是任何有效的样式属性值类型
- 常见类型包括：`string`、`number`、`boolean`、`IGradient`等

### Function Parameters

#### datum: Datum
当前数据项，包含图形渲染所需的原始数据。

```typescript
type Datum = {
  [key: string]: any;
};
```

**使用说明：**
- 包含当前图形元素对应的数据记录
- 可以访问数据的任意字段进行样式计算
- 是样式函数中最常用的参数

#### context: IModelMarkAttributeContext
Mark元素的上下文信息，提供全局状态和计算能力。

```typescript
interface IModelMarkAttributeContext {
  [key: string]: unknown;
}

interface ISeriesMarkAttributeContext extends IModelMarkAttributeContext {
  /** 全局比例尺访问函数 */
  globalScale: (scaleKey: string, value: string | number) => unknown;
  /** 系列颜色获取函数 */
  seriesColor: (seriesValue?: string | number) => string;
  /** 获取当前Region */
  getRegion: () => IRegion;
}
```

**主要功能：**
- `globalScale`: 访问全局比例尺进行数值映射
- `seriesColor`: 获取系列对应的颜色值
- `getRegion`: 获取当前图表区域信息

#### source?: DataView
可选的数据视图对象，来自`@visactor/vdataset`包。

```typescript
// 来自 @visactor/vdataset
interface DataView {
  // 数据视图的具体实现
  // 提供数据操作和统计功能
}
```

**使用场景：**
- 访问完整的数据集进行统计计算
- 进行数据过滤和聚合操作
- 获取数据的元信息

### 关联类型

#### ValueType
静态值类型，与`FunctionType`形成对比。

```typescript
type ValueType<T> = T;
```

#### VisualType
组合类型，支持静态值、函数和可视化映射。

```typescript
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
```

#### ConvertToMarkStyleSpec
样式转换工具类型，将静态样式转换为支持动态计算的样式。

```typescript
type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
  [key in keyof T]: VisualType<T[key]>;
};
```

### 使用场景

#### 动态颜色计算
```typescript
const fill: FunctionType<string> = (datum, context) => {
  if (datum.value > 100) {
    return context.seriesColor('high');
  }
  return context.seriesColor('normal');
};
```

#### 基于数据的尺寸计算
```typescript
const size: FunctionType<number> = (datum, context) => {
  const scale = context.globalScale('size', datum.count);
  return scale as number;
};
```

#### 条件样式应用
```typescript
const opacity: FunctionType<number> = (datum) => {
  return datum.status === 'active' ? 1 : 0.5;
};
```

#### 数据统计计算
```typescript
const lineWidth: FunctionType<number> = (datum, context, source) => {
  if (source) {
    const dataLength = source.latestData.length;
    return dataLength > 1000 ? 1 : 2;
  }
  return 1;
};
```

### 在VChart中的应用

#### Mark样式配置
`FunctionType`广泛用于Mark元素的样式配置中：

```typescript
interface IMarkSpec<T extends ICommonSpec = ICommonSpec> {
  style?: ConvertToMarkStyleSpec<T>;
  // 其他属性...
}
```

#### 渐变属性计算
在渐变配置中支持动态计算：

```typescript
type GradientPropValue<T> = ValueType<T> | FunctionType<T>;
```

#### 样式映射系统
与VChart的视觉映射系统深度集成：

```typescript
type MarkInputStyle<T> = StyleConvert<T> | VisualType<T>;
type StyleConvert<T> = ValueType<T> | FunctionType<T> | VisualScaleType;
```

### 性能考虑

#### 函数执行频率
- 每个数据项渲染时都会调用函数
- 在大数据集场景下需要注意性能优化
- 避免在函数中进行复杂的计算操作

#### 上下文缓存
- `context`对象在同一个渲染周期内保持稳定
- 可以利用上下文进行计算结果缓存
- 避免重复的比例尺计算

#### 数据访问优化
- 优先使用`datum`参数获取数据
- 仅在必要时访问`source`参数
- 合理利用数据视图的统计功能
