## IPolarAxisSpec 配置规范

```typescript
export type IPolarAxisSpec = IPolarLinearAxisSpec | IPolarBandAxisSpec;

export type IPolarLinearAxisSpec = IPolarAxisCommonSpec & ILinearAxisSpec;
export type IPolarBandAxisSpec = IPolarAxisCommonSpec & IBandAxisSpec;
```

## 极坐标轴通用配置 (IPolarAxisCommonSpec)

继承自 ICommonAxisSpec 的极坐标系特有配置：

```typescript
export type IPolarAxisCommonSpec = Omit<ICommonAxisSpec, 'center'> & {
  /**
   * 布局半径，相当于计算内径、外径的基准值
   * 默认值为: region宽度、高度最小值的一半
   * @since 1.11.2
   */
  layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);

  /**
   * 当配置了 innerRadius 时，可以通过设置 inside: true，将坐标轴展示在内圆
   * @default false
   */
  inside?: boolean;

  /**
   * 轴位置，枚举类型，支持：'radius' 和 'angle'
   * - 'radius' 代表半径轴
   * - 'angle' 代表角度轴
   */
  orient: IPolarOrientType;

  /** 网格线配置 */
  grid?: IPolarGrid;

  /** 轴的外半径，数值范围 0-1 */
  radius?: number;

  /** 子网格线配置 */
  subGrid?: IPolarGrid;

  /** 轴线配置 */
  domainLine?: IDomainLine;

  /** 轴标签配置 */
  label?: IPolarAxisLabel;

  /** 轴标题配置 */
  title?: ITitle;

  /** 内半径（比例值，取值范围 0~1） */
  innerRadius?: number;

  /** 外半径（比例值，取值范围 0~1） */
  outerRadius?: number;

  /**
   * 中心点
   * @since 1.11.2 x,y 支持百分比的值，如'50%'
   */
  center?: { x: number | string; y: number | string };

  /** 起始角度 */
  startAngle?: number;

  /** 终止角度 */
  endAngle?: number;
};
```

## 极坐标轴标签配置 (IPolarAxisLabel)

自 1.12.6 版本起，角度轴支持自动省略、自动隐藏、自动换行等功能：

```typescript
export type IPolarAxisLabel = ILabel &
  Pick<
    AxisLabelOverlap,
    'autoHide' | 'autoHideMethod' | 'autoHideSeparation' | 'autoLimit' | 'limitEllipsis' | 'layoutFunc' | 'autoWrap'
  >;
```

## 通用轴配置 (ICommonAxisSpec)

定义轴的基础配置属性：

```typescript
export interface ICommonAxisSpec extends Omit<IComponentSpec, 'orient' | 'center'>, IAnimationSpec<string, string> {
  /** 轴类型 */
  type?: AxisType;

  /**
   * 是否显示坐标轴
   * @default true
   */
  visible?: boolean;

  /**
   * 是否开启反向坐标轴
   * @default false
   */
  inverse?: boolean;

  /** 轴刻度线配置 */
  tick?: ITick;

  /** 子刻度线配置 */
  subTick?: ISubTick;

  /**
   * 是否开启动画，默认关闭
   * @default false
   */
  animation?: boolean;

  /**
   * 是否开启 select 选中交互，默认关闭
   * @default false
   */
  select?: boolean;

  /**
   * 是否开启 hover 悬浮交互，默认关闭
   * @default false
   */
  hover?: boolean;

  /**
   * 是否开启轴数据采样，默认开启
   * @default true
   * @since 1.1.0
   */
  sampling?: boolean;

  /**
   * 是否强制初始化 tick 数据，仅在 visible 为 false 时生效
   * @default false
   */
  forceInitTick?: boolean;
}
```

## 线性轴配置 (ILinearAxisSpec)

连续数值轴的特定配置：

```typescript
export interface ILinearAxisSpec {
  /** 最小值，优先级高于 zero，nice */
  min?: number;
  /** 最大值，优先级高于 zero，nice */
  max?: number;

  /** 最小值，当且仅当该值小于数据最小值时，才能生效 */
  softMin?: number;
  /** 最大值，当且仅当该值大于数据最大值时，才能生效 */
  softMax?: number;

  /** 是否从 0 开始 */
  zero?: boolean;
  /** 是否开启 nice */
  nice?: boolean;

  /** 刻度数量 */
  tickCount?: number;
  /** 刻度配置 */
  tick?: ITick;

  /** 范围扩展配置 */
  expand?: {
    min?: number;
    max?: number;
  };

  /**
   * 连续轴上的 dimension tooltip 数据筛选范围
   * @since 1.4.0
   */
  tooltipFilterRange?: number | [number, number] | ((params: { scale: IBaseScale }) => number | [number, number]);

  /**
   * 轴截断配置，只对笛卡尔坐标系的 linear 轴生效
   * @since 1.12.4
   */
  breaks?: ILinearAxisBreakSpec[];
}
```

## 离散轴配置 (IBandAxisSpec)

分类轴的特定配置：

```typescript
export interface IBandAxisSpec {
  /**
   * 是否去除 band 轴两端的留白
   * @default false
   * @since 1.7.0
   */
  trimPadding?: boolean;

  /**
   * 同时设置轴的 paddingInner 和 paddingOuter
   * 支持数组类型，用于多层 scale 的 bandPadding 配置
   */
  bandPadding?: number | number[];

  /**
   * band 轴的内边距
   * @default 0.1
   */
  paddingInner?: number | number[];

  /**
   * band 轴的外边距
   * @default 0.3
   */
  paddingOuter?: number | number[];

  /**
   * 配置离散轴的数值范围
   * @since 1.1.0
   */
  domain?: StringOrNumber[];

  /**
   * 指定数据点在 band 轴上的位置偏移量
   * @default 0.5
   */
  bandPosition?: number;
}
```

## 支持类型定义

### 极坐标方向类型

```typescript
export type IPolarOrientType = 'radius' | 'angle';
```

### 极坐标网格配置

```typescript
export type IPolarGrid = IGrid & {
  /**
   * smooth 为 true 时，为圆形 grid，为 false 则为多边形 grid
   * @default false
   */
  smooth?: boolean;
};
```

### 刻度线配置

```typescript
export interface ITick extends IAxisItem<IRuleMarkSpec> {
  /** 刻度个数 */
  tickCount?: number;
  /** 刻度长度 */
  tickSize?: number;
  /** 刻度步长 */
  tickStep?: number;
  /** 刻度值数组 */
  tickValues?: any[];
  /**
   * 刻度线朝向，默认朝外
   * @default false
   */
  inside?: boolean;
  /**
   * tick 是否与 label 对齐
   * @default true
   */
  alignWithLabel?: boolean;
  /** 刻度线样式设置，支持回调 */
  style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
  /** 刻度线不同交互状态下的样式配置 */
  state?: AxisItemStateStyle<IRuleMarkSpec>;
}
```

### 标签配置

```typescript
export interface ILabel extends IAxisItem<ITextMarkSpec> {
  /** 文本类型 */
  type?: 'text' | 'rich';
  /** 轴标签内容格式化函数 */
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>;
  /** 格式化模板 */
  formatter?: string | string[];
  /** 标签同 tick 之间的间距 */
  space?: number;
  /**
   * 标签朝向，默认朝外
   * @default false
   */
  inside?: boolean;
  /** 标签之间的最小间距（像素） */
  minGap?: number;
  /** 文本样式设置 */
  style?: ITextMarkSpec | StyleCallback<ITextMarkSpec | undefined>;
  /** label 不同交互状态下的样式配置 */
  state?: AxisItemStateStyle<ITextMarkSpec>;
}
```

## 完整类型定义

```typescript
export type IPolarAxisSpec = {
  // 基础配置
  type?: AxisType;
  visible?: boolean;
  inverse?: boolean;
  animation?: boolean;
  select?: boolean;
  hover?: boolean;
  sampling?: boolean;
  forceInitTick?: boolean;

  // 极坐标特有配置
  layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);
  inside?: boolean;
  orient: 'radius' | 'angle';
  innerRadius?: number;
  outerRadius?: number;
  radius?: number;
  center?: { x: number | string; y: number | string };
  startAngle?: number;
  endAngle?: number;

  // 视觉元素配置
  grid?: IPolarGrid;
  subGrid?: IPolarGrid;
  domainLine?: IDomainLine;
  label?: IPolarAxisLabel;
  title?: ITitle;
  tick?: ITick;
  subTick?: ISubTick;
} & // 线性轴特有配置
(| {
      min?: number;
      max?: number;
      softMin?: number;
      softMax?: number;
      zero?: boolean;
      nice?: boolean;
      tickCount?: number;
      expand?: { min?: number; max?: number };
      tooltipFilterRange?: number | [number, number] | Function;
      breaks?: ILinearAxisBreakSpec[];
    }
  // 离散轴特有配置
  | {
      trimPadding?: boolean;
      bandPadding?: number | number[];
      paddingInner?: number | number[];
      paddingOuter?: number | number[];
      domain?: StringOrNumber[];
      bandPosition?: number;
    }
);
```

## 使用示例

### 半径轴（连续）配置

```typescript
const radiusAxis: IPolarAxisSpec = {
  orient: 'radius',
  type: 'linear',
  min: 0,
  max: 100,
  innerRadius: 0.2,
  outerRadius: 0.8,
  grid: {
    visible: true,
    smooth: true
  },
  label: {
    visible: true,
    space: 4
  }
};
```

### 角度轴（离散）配置

```typescript
const angleAxis: IPolarAxisSpec = {
  orient: 'angle',
  type: 'band',
  domain: ['A', 'B', 'C', 'D'],
  paddingInner: 0.1,
  paddingOuter: 0.2,
  startAngle: -90,
  endAngle: 270,
  grid: {
    visible: true,
    smooth: false
  },
  label: {
    autoHide: true,
    autoHideMethod: 'greedy'
  }
};
```

### 自定义中心和半径

```typescript
const customPolarAxis: IPolarAxisSpec = {
  orient: 'radius',
  type: 'linear',
  center: { x: '50%', y: '50%' },
  layoutRadius: (layoutRect, center) => {
    return Math.min(layoutRect.width, layoutRect.height) * 0.4;
  },
  innerRadius: 0.3,
  outerRadius: 0.9,
  inside: true
};
```

### 角度轴标签优化

```typescript
const optimizedAngleAxis: IPolarAxisSpec = {
  orient: 'angle',
  type: 'band',
  sampling: true,
  label: {
    autoHide: true,
    autoHideMethod: 'greedy',
    autoHideSeparation: 4,
    autoLimit: true,
    limitEllipsis: '...',
    autoWrap: true,
    minGap: 8
  }
};
```

### 带截断的半径轴

```typescript
const brokenRadiusAxis: IPolarAxisSpec = {
  orient: 'radius',
  type: 'linear',
  breaks: [
    {
      range: [50, 100],
      gap: '5%',
      scopeType: 'length'
    }
  ],
  tick: {
    tickCount: 10
  }
};
```
