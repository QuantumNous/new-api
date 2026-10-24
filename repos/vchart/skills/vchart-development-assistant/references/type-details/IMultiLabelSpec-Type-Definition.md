## Overview

`IMultiLabelSpec` is a generic type for multi-label configurations in VChart, supporting both single and array configurations:

```typescript
export type IMultiLabelSpec<T extends Omit<ILabelSpec, 'position'>> = T | T[];
```

This type extends `ILabelSpec` (excluding the 'position' property) and provides flexible label configuration options for series data visualization.

## Base Structure

`IMultiLabelSpec` is built upon `ILabelSpec` which combines label configuration and animation specifications:

```typescript
interface ILabelSpec extends ILabelAnimationSpec {
  // Core Display Configuration
  zIndex?: number; // Label layer level
  visible?: boolean; // Visibility @default false
  interactive?: boolean; // Interaction support @default false

  // Text Configuration
  textType?: 'text' | 'rich'; // Text type @deprecated @since 1.7.0
  formatMethod?: IFormatMethod; // Format function @since 1.10.0
  formatter?: string | string[]; // String template @since 1.7.0

  // Layout Configuration
  offset?: number; // Distance from data element
  position?: string; // Label position
  labelLayout?: 'series' | 'region'; // Layout scope

  // Style Configuration
  style?: ConvertToMarkStyleSpec<IComposedTextMarkSpec>;
  state?: LabelStateStyle<Partial<IComposedTextMarkSpec>>;

  // Advanced Features
  overlap?: BaseLabelAttrs['overlap'] & OverlapExtension;
  smartInvert?: BaseLabelAttrs['smartInvert'];
  support3d?: boolean; // 3D support
  syncState?: boolean; // Sync with data element state @since 1.9.0
  showRelatedMarkTooltip?: boolean; // Show related mark tooltip @since 1.13.5

  // Data Processing
  stackDataFilterType?: 'min' | 'max'; // Stack data filter @since 1.12.0
  dataFilter?: BaseLabelAttrs['dataFilter']; // Custom data filter @since 1.3.0

  // Custom Layout Functions
  customLayoutFunc?: BaseLabelAttrs['customLayoutFunc']; // @since 1.3.0
  customOverlapFunc?: BaseLabelAttrs['customOverlapFunc']; // @since 1.3.0
  onAfterOverlapping?: BaseLabelAttrs['onAfterOverlapping']; // @since 1.13.5
}
```

## LabelStateStyle

```typescript
type LabelStateStyle<T> = {
  /** Hover state style */
  hover?: T;

  /** Non-hover state style */
  hover_reverse?: T;

  /** Selected state style */
  selected?: T;

  /** Non-selected state style */
  selected_reverse?: T;
};
```

## Animation Configuration

### Label Animation Specifications

```typescript
type ILabelAnimationSpec = Pick<
  BaseLabelAttrs,
  | 'animation' // General animation config
  | 'animationEnter' // Enter animation
  | 'animationUpdate' // Update animation
  | 'animationExit' // Exit animation
>;
```

## Related Type Definitions

### Format Method Context

```typescript
interface ILabelFormatMethodContext {
  series?: ISeries;
}
```

### Label Information

```typescript
interface ILabelInfo {
  baseMark: IMark;
  labelMark: ILabelMark;
  series: ISeries;
  labelSpec: TransformedLabelSpec;
}

interface ILabelComponentContext {
  region: IRegion;
  labelInfo: ILabelInfo[];
}
```

### Total Label Specification

```typescript
type ITotalLabelSpec = Pick<
  ILabelSpec,
  'visible' | 'formatMethod' | 'interactive' | 'offset' | 'style' | 'state' | 'textType' | 'overlap'
> & {
  /** Position relative to stacked elements @default 'top' */
  position?: 'top' | 'bottom';

  /** Always calculate total value @default false */
  alwayCalculateTotal?: boolean;
};
```

### Transformed Label Specification

```typescript
type TransformedLabelSpec = ILabelSpec & {
  getStyleHandler: (series: ISeries) => (mark?: ILabelMark, spec?: any) => void;
};
```

## Dependency Type Definitions

### Mark Style Types

```typescript
interface IComposedTextMarkSpec extends ITextMarkSpec {
  // Extended text mark specification with composition support
}

interface ITextMarkSpec {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: string;
  stroke?: string;
  textAlign?: string;
  textBaseline?: string;
  // ... additional text style properties
}
```

### Format Method Types

```typescript
type IFormatMethod = (
  text: string | string[],
  datum?: Datum,
  ctx?: ILabelFormatMethodContext
) => string | { type: 'rich'; text: IRichTextCharacter[] } | { type: 'text'; text: string };
```

### VRender Components Types

```typescript
// From @visactor/vrender-components
interface BaseLabelAttrs {
  overlap?: OverlapConfig;
  smartInvert?: SmartInvertConfig;
  dataFilter?: DataFilterFunction;
  customLayoutFunc?: CustomLayoutFunction;
  customOverlapFunc?: CustomOverlapFunction;
  onAfterOverlapping?: AfterOverlappingCallback;
  animation?: AnimationConfig;
  animationEnter?: AnimationConfig;
  animationUpdate?: AnimationConfig;
  animationExit?: AnimationConfig;
}

interface DataLabelAttrs {
  size?: {
    padding?: PaddingConfig;
  };
}
```
