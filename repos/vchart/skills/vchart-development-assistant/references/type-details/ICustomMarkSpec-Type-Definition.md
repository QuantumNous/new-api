## ICustomMarkSpec 配置规范

ICustomMarkSpec 定义了 VChart 中自定义图元的完整配置接口，支持创建各种类型的自定义标记元素，包括基础图形、组合图形和扩展图形等。

## 核心接口结构

```typescript
export interface ICustomMarkSpec<T extends EnableMarkType>
  extends IModelSpec,
    IMarkSpec<IBuildinMarkSpec[T]>,
    IAnimationSpec<string, string> {
  type: T;
  name?: string;
  dataIndex?: number;
  dataKey?: string | ((datum: any) => string);
  dataId?: StringOrNumber;
  componentType?: string;
  animation?: boolean;
  parent?: string;
}
```

## 基础配置属性

### 标记类型和标识
```typescript
interface ICustomMarkSpecBase {
  /** 标记类型，支持所有内置图元类型 */
  type: EnableMarkType;
  
  /**
   * mark对应的名称，主要用于事件过滤
   * @since 1.12.5
   */
  name?: string;
  
  /**
   * 指定 parent Id
   * @since 1.13.0
   */
  parent?: string;
}
```

### 数据绑定配置
```typescript
interface ICustomMarkDataBinding {
  /**
   * 关联的数据索引
   * @default 与系列使用同一份数据
   */
  dataIndex?: number;
  
  /**
   * dataKey用于绑定数据与Mark的关系
   * 如果数据和系列数据一致，可以不配置，默认会读取系列中的配置
   * @support since 1.9.5
   */
  dataKey?: string | ((datum: any) => string);
  
  /** 关联的数据id */
  dataId?: StringOrNumber;
  
  /**
   * specify the component type
   * @support since 1.9.0
   */
  componentType?: string;
}
```

### 动画配置
```typescript
interface ICustomMarkAnimation {
  /**
   * enable animation of custom-mark or not
   * @since 1.11.0
   */
  animation?: boolean;
}
```

## 继承接口说明

### IModelSpec 基础模型配置
```typescript
export type IModelSpec = ILayoutItemSpec & { 
  id?: StringOrNumber;
};

interface ILayoutItemSpec {
  /** 用户自定义id */
  id?: StringOrNumber;
  /** 布局相关配置 */
  [key: string]: any;
}
```

### IMarkSpec 图元配置
```typescript
export type IMarkSpec<T extends ICommonSpec = ICommonSpec> = {
  /** 用户id */
  id?: StringOrNumber;
  /** 是否响应交互 */
  interactive?: boolean;
  /** 与其他mark元素的层级 */
  zIndex?: number;
  /** mark 层 是否显示配置 */
  visible?: boolean;
  /** 默认样式设置 */
  style?: ConvertToMarkStyleSpec<T>;
  /** 不同状态下的样式配置 */
  state?: IMarkStateFullSpec<T>;
  /** 状态排序方法 */
  stateSort?: (stateA: string, stateB: string) => number;
  /** 是否是3d视角的mark */
  support3d?: boolean;
  /** customized shape of mark */
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
} & IMarkProgressiveConfig;
```

### IAnimationSpec 动画配置
```typescript
export interface IAnimationSpec<MarkName extends string, Preset extends string> {
  /** 图表入场动画 */
  animationAppear?: boolean | IStateAnimateSpec<Preset> | IMarkAnimateSpec<MarkName>;
  /** 数据更新 - 新增数据动画 */
  animationEnter?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /** 数据更新 - 数据更新动画 */
  animationUpdate?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /** 数据更新 - 数据删除动画 */
  animationExit?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<MarkName>;
  /** 图表退场动画 */
  animationDisappear?: boolean | IStateAnimateSpec<Preset> | IMarkAnimateSpec<MarkName>;
}
```

## 支持类型定义

### 可用标记类型
```typescript
export type EnableMarkType = keyof IBuildinMarkSpec;

export type IBuildinMarkSpec = {
  group: IGroupMarkSpec;
  symbol: ISymbolMarkSpec;
  rule: IRuleMarkSpec;
  line: ILineMarkSpec;
  text: ITextMarkSpec;
  rect: IRectMarkSpec;
  image: IImageMarkSpec;
  path: IPathMarkSpec;
  area: IAreaMarkSpec;
  arc: IArcMarkSpec;
  polygon: IPolygonMarkSpec;
  boxPlot: IBoxPlotMarkSpec;
  linkPath: ILinkPathMarkSpec;
  ripple: IRippleMarkSpec;
};
```

### 标记类型枚举
```typescript
export const enum MarkTypeEnum {
  group = 'group',
  symbol = 'symbol',
  rule = 'rule',
  line = 'line',
  text = 'text',
  rect = 'rect',
  image = 'image',
  path = 'path',
  area = 'area',
  arc = 'arc',
  polygon = 'polygon',
  boxPlot = 'boxPlot',
  linkPath = 'linkPath',
  ripple = 'ripple'
}
```

### 状态配置类型
```typescript
export interface IMarkStateFullSpec<T> extends Record<string, IMarkStateSpec<T> | IMarkStateStyleSpec<T>> {
  /** 正常状态下图元的样式设置 */
  normal?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /** hover状态下图元的样式设置 */
  hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /** 没有被hover的状态下图元的样式设置 */
  hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /** 选中状态下图元的样式设置 */
  selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /** 没有被选中的状态下图元的样式设置 */
  selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
}
```

### 大数据渲染配置
```typescript
export type IMarkProgressiveConfig = {
  /** 是否开启大数据渲染模式 */
  large?: boolean;
  /** 开启大数据渲染优化的阀值 */
  largeThreshold?: number;
  /** 分片长度 */
  progressiveStep?: number;
  /** 开启分片渲染的阀值 */
  progressiveThreshold?: number;
};
```

## 扩展接口类型

### 组合标记配置
```typescript
export interface ICustomMarkGroupSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
  children?: ICustomMarkSpec<EnableMarkType>[];
}
```

### 扩展标记配置
```typescript
export interface IExtensionMarkSpec<T extends Exclude<EnableMarkType, 'group'>> extends ICustomMarkSpec<T> {
  dataIndex?: number;
  dataKey?: string | ((datum: any) => string);
  dataId?: StringOrNumber;
  componentType?: string;
}

export interface IExtensionGroupMarkSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
  children?: ICustomMarkSpec<EnableMarkType>[];
}
```

## 完整类型定义

```typescript
export interface ICustomMarkSpec<T extends EnableMarkType> {
  // 基础配置
  id?: StringOrNumber;
  type: T;
  name?: string;
  parent?: string;
  
  // 数据绑定
  dataIndex?: number;
  dataKey?: string | ((datum: any) => string);
  dataId?: StringOrNumber;
  componentType?: string;
  
  // 图元配置
  interactive?: boolean;
  zIndex?: number;
  visible?: boolean;
  style?: ConvertToMarkStyleSpec<IBuildinMarkSpec[T]>;
  state?: IMarkStateFullSpec<IBuildinMarkSpec[T]>;
  stateSort?: (stateA: string, stateB: string) => number;
  support3d?: boolean;
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
  
  // 性能配置
  large?: boolean;
  largeThreshold?: number;
  progressiveStep?: number;
  progressiveThreshold?: number;
  
  // 动画配置
  animation?: boolean;
  animationAppear?: boolean | IStateAnimateSpec<string> | IMarkAnimateSpec<string>;
  animationEnter?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<string>;
  animationUpdate?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<string>;
  animationExit?: boolean | ICommonStateAnimateSpec | IMarkAnimateSpec<string>;
  animationDisappear?: boolean | IStateAnimateSpec<string> | IMarkAnimateSpec<string>;
}
```

## 使用示例

### 基础自定义图元
```typescript
const customMarkSpec: ICustomMarkSpec<'rect'> = {
  type: 'rect',
  name: 'customRect',
  dataIndex: 0,
  style: {
    x: 100,
    y: 100,
    width: 50,
    height: 30,
    fill: '#ff0000'
  },
  state: {
    hover: {
      style: {
        fill: '#00ff00'
      }
    }
  }
};
```

### 数据绑定自定义图元
```typescript
const dataBindMarkSpec: ICustomMarkSpec<'symbol'> = {
  type: 'symbol',
  name: 'dataSymbol',
  dataKey: 'category',
  componentType: 'series',
  style: {
    symbolType: 'circle',
    size: (datum: any) => datum.value * 5,
    fill: (datum: any) => datum.color
  },
  animation: true,
  animationAppear: {
    duration: 1000,
    easing: 'bounceOut'
  }
};
```

### 组合标记配置
```typescript
const groupMarkSpec: ICustomMarkGroupSpec = {
  type: 'group',
  name: 'customGroup',
  children: [
    {
      type: 'rect',
      name: 'background',
      style: {
        fill: '#f0f0f0',
        stroke: '#333333'
      }
    },
    {
      type: 'text',
      name: 'label',
      style: {
        text: 'Custom Group',
        fontSize: 14
      }
    }
  ]
};
```

### 大数据优化配置
```typescript
const largeDataMarkSpec: ICustomMarkSpec<'symbol'> = {
  type: 'symbol',
  name: 'largeDataPoints',
  large: true,
  largeThreshold: 2000,
  progressiveThreshold: 5000,
  progressiveStep: 1000,
  style: {
    symbolType: 'circle',
    size: 3,
    fill: '#0066cc'
  }
};
```