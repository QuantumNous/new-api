## Overview

```typescript
interface ILinearAxisSpec {
  // Range configuration
  min?: number; // Hard minimum value
  max?: number; // Hard maximum value
  softMin?: number | ((domain: number[]) => number); // Conditional minimum @since 1.11.0
  softMax?: number | ((domain: number[]) => number); // Conditional maximum @since 1.11.0
  range?: { min?: number; max?: number }; // @deprecated Use outer min/max

  // Nice value configuration
  nice?: boolean; // Enable nice values @default true
  niceType?: 'tickCountFirst' | 'accurateFirst'; // Nice algorithm priority
  zero?: boolean; // Include zero @default true
  expand?: { min?: number; max?: number }; // Range expansion by ratio

  // Advanced features
  tooltipFilterRange?: number | [number, number] | TooltipFilterFunction; // Tooltip filter range @since 1.4.0
  breaks?: ILinearAxisBreakSpec[]; // Axis breaks @since 1.12.4
}
```

## Tooltip Filter Function

```typescript
type TooltipFilterFunction = (params: { scale: IBaseScale }) => number | [number, number];
```

**TooltipFilterFunction 工具提示过滤函数：**
接收包含 scale 对象的参数，返回数据筛选范围值或范围数组。

## Nice Type

```typescript
type NiceType = 'tickCountFirst' | 'accurateFirst';
```

**NiceType 优化类型：**

- `'tickCountFirst'`: 刻度数量优先（默认值）
- `'accurateFirst'`: 精度优先

## Axis Breaks Configuration

```typescript
interface ILinearAxisBreakSpec {
  range?: [number, number]; // Data range to break
  gap?: number | string; // Break gap representation
  scopeType?: 'count' | 'length'; // Break calculation method @since 1.12.12
  // Additional break properties from AxisBreakProps
}
```

**ILinearAxisBreakSpec 轴截断配置：**

- `range`: 要截断的数据范围
- `gap`: 截断的视觉间隙（像素或百分比）
- `scopeType`: 截断计算方式
  - `'count'`: 按记录数进行分段
  - `'length'`: 按长度进行分段

## Expand Configuration

```typescript
interface ExpandConfig {
  min?: number; // Minimum expansion ratio
  max?: number; // Maximum expansion ratio
}
```

**ExpandConfig 扩展配置：**
轴范围按比例扩展，当配置了 min 和 max 时该配置失效。

## Scale Interface

```typescript
interface IBaseScale {
  domain(): [number, number]; // Get scale domain
  range(): [number, number]; // Get scale range
  // Additional scale methods
}
```
