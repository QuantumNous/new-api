## Interface Overview

```typescript
interface IFunnelLabelSpec extends Omit<ILabelSpec, 'position' | 'offset'> {
  limit?: 'shapeSize' | number;
}
```

`IFunnelLabelSpec` 定义了漏斗图标签的完整规范。它继承自 `ILabelSpec` 的大部分属性，但排除了 `position` 和 `offset` 属性（由漏斗图组件内部控制），并添加了漏斗图特定的限制配置。

## Complete Flattened Type Definition

```typescript
interface IFunnelLabelSpec {
  // === Funnel-specific Properties ===
  limit?: 'shapeSize' | number;

  // === Basic Display Properties ===
  zIndex?: number;
  visible?: boolean;
  interactive?: boolean;

  // === Text Content & Formatting ===
  textType?: 'text' | 'rich';
  formatMethod?: (
    text: string | string[],
    datum?: Record<string, any>,
    ctx?: { series?: any }
  ) =>
    | string
    | {
        type: 'rich';
        text: Array<{
          text: string;
          fill?: string;
          fontSize?: number;
          fontFamily?: string;
          fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
          fontStyle?: 'normal' | 'italic' | 'oblique';
          textDecoration?: 'none' | 'underline' | 'line-through';
          script?: 'normal' | 'sub' | 'super';
        }>;
      }
    | { type: 'text'; text: string | number | string[] | number[] };
  formatter?: string | string[];

  // === Visual Styling ===
  style?: {
    [K in keyof (ITextMarkSpec | IRichTextMarkSpec)]: K extends keyof ITextMarkSpec
      ? ITextMarkSpec[K] extends infer T
        ?
            | T
            | ((datum: Record<string, any>, context: any, source?: any) => T)
            | {
                type:
                  | 'linear'
                  | 'log'
                  | 'pow'
                  | 'sqrt'
                  | 'symlog'
                  | 'time'
                  | 'utc'
                  | 'ordinal'
                  | 'point'
                  | 'band'
                  | 'threshold'
                  | 'quantile'
                  | 'quantize'
                  | 'identity';
                domain: any[];
                range: T[];
                specified?: { [key: string]: unknown };
                clamp?: boolean;
                field: string;
              }
            | {
                scale: string;
                field?: string;
                changeDomain?: 'none' | 'replace' | 'expand';
              }
        : never
      : never;
  };

  state?: {
    hover?: Partial<{
      // Text properties
      text?: string | number | string[] | number[];
      dx?: number;
      dy?: number;
      fontSize?: number | { type: 'token'; key: string; default?: number };
      textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
      textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
      fontFamily?: string;
      fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
      fontStyle?: 'normal' | 'italic' | 'oblique';
      maxLineWidth?: number;
      ellipsis?: string;
      suffixPosition?: 'start' | 'end' | 'middle';
      underline?: boolean;
      underlineDash?: number[];
      underlineOffset?: number;
      lineThrough?: boolean;
      lineHeight?: number | string | { type: 'token'; key: string; default?: any };
      direction?: 'horizontal' | 'vertical';
      wordBreak?: 'break-word' | 'break-all' | 'keep-all';
      heightLimit?: number;
      lineClamp?: number;

      // Fill properties
      fill?:
        | string
        | {
            gradient: 'linear';
            x0?: number;
            y0?: number;
            x1?: number;
            y1?: number;
            stops: Array<{
              offset: number;
              color?: string;
              opacity?: number;
            }>;
          }
        | {
            gradient: 'radial';
            r0?: number;
            x0?: number;
            y0?: number;
            x1?: number;
            y1?: number;
            r1?: number;
            stops: Array<{
              offset: number;
              color?: string;
              opacity?: number;
            }>;
          }
        | {
            gradient: 'conical';
            x?: number;
            y?: number;
            startAngle?: number;
            endAngle?: number;
            stops: Array<{
              offset: number;
              color?: string;
              opacity?: number;
            }>;
          }
        | false
        | { type: 'color'; key: string; default?: string };
      fillOpacity?: number;
      background?: any | HTMLImageElement | HTMLCanvasElement | null;

      // Common properties
      visible?: boolean;
      x?: number;
      y?: number;
      z?: number;
      stroke?: string | object | false | (number | boolean)[] | { type: 'color'; key: string; default?: string } | null;
      strokeOpacity?: number;
      opacity?: number;
      lineWidth?: number;
      lineDash?: number[];
      lineDashOffset?: number;
      cursor?:
        | 'auto'
        | 'default'
        | 'none'
        | 'context-menu'
        | 'help'
        | 'pointer'
        | 'progress'
        | 'wait'
        | 'cell'
        | 'crosshair'
        | 'text'
        | 'vertical-text'
        | 'alias'
        | 'copy'
        | 'move'
        | 'no-drop'
        | 'not-allowed'
        | 'grab'
        | 'grabbing'
        | 'e-resize'
        | 'n-resize'
        | 'ne-resize'
        | 'nw-resize'
        | 's-resize'
        | 'se-resize'
        | 'sw-resize'
        | 'w-resize'
        | 'ew-resize'
        | 'ns-resize'
        | 'nesw-resize'
        | 'nwse-resize'
        | 'col-resize'
        | 'row-resize'
        | 'all-scroll'
        | 'zoom-in'
        | 'zoom-out';
      zIndex?: number;
      angle?: number;
      anchor?: [number, number];
      scaleX?: number;
      scaleY?: number;
      scaleCenter?: [number | string, number | string];
      alpha?: number;
      beta?: number;
      anchor3d?: [number, number];
      pickMode?: 'accurate' | 'imprecise' | 'custom';
      boundsMode?: 'accurate' | 'imprecise';
    }>;
    hover_reverse?: Partial<{
      // 同 hover 的完整类型定义
      text?: string | number | string[] | number[];
      dx?: number;
      dy?: number;
      fontSize?: number | { type: 'token'; key: string; default?: number };
      textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
      textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
      fontFamily?: string;
      fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
      fontStyle?: 'normal' | 'italic' | 'oblique';
      fill?: string | object | false | { type: 'color'; key: string; default?: string };
      fillOpacity?: number;
      visible?: boolean;
      opacity?: number;
      stroke?: string | object | false;
      strokeOpacity?: number;
      lineWidth?: number;
      cursor?: string;
      zIndex?: number;
      // ... 其他所有样式属性
    }>;
    selected?: Partial<{
      // 同 hover 的完整类型定义
      text?: string | number | string[] | number[];
      dx?: number;
      dy?: number;
      fontSize?: number | { type: 'token'; key: string; default?: number };
      textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
      textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
      fontFamily?: string;
      fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
      fontStyle?: 'normal' | 'italic' | 'oblique';
      fill?: string | object | false | { type: 'color'; key: string; default?: string };
      fillOpacity?: number;
      visible?: boolean;
      opacity?: number;
      stroke?: string | object | false;
      strokeOpacity?: number;
      lineWidth?: number;
      cursor?: string;
      zIndex?: number;
      // ... 其他所有样式属性
    }>;
    selected_reverse?: Partial<{
      // 同 hover 的完整类型定义
      text?: string | number | string[] | number[];
      dx?: number;
      dy?: number;
      fontSize?: number | { type: 'token'; key: string; default?: number };
      textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
      textBaseline?: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
      fontFamily?: string;
      fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
      fontStyle?: 'normal' | 'italic' | 'oblique';
      fill?: string | object | false | { type: 'color'; key: string; default?: string };
      fillOpacity?: number;
      visible?: boolean;
      opacity?: number;
      stroke?: string | object | false;
      strokeOpacity?: number;
      lineWidth?: number;
      cursor?: string;
      zIndex?: number;
      // ... 其他所有样式属性
    }>;
  };

  // === Layout & Collision Detection ===
  overlap?: {
    hideOnHit?: boolean;
    avoidBaseMark?: boolean;
    strategy?: Array<{
      type: 'position' | 'bound';
      position?: string[];
      bound?: object;
    }>;
  } & {
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };

  smartInvert?: {
    mode?: 'lightness' | 'brightness';
    threshold?: number;
    fillOpacity?: number;
  };

  // === Data Processing ===
  stackDataFilterType?: 'min' | 'max';
  dataFilter?: (data: any[], labelMark: any) => any[];

  // === Custom Layout Functions ===
  customLayoutFunc?: (data: any[], labels: any[], region: any) => void;
  customOverlapFunc?: (labels: any[], labelMark: any) => void;
  onAfterOverlapping?: (labels: any[]) => void;

  // === Advanced Configuration ===
  labelLayout?: 'series' | 'region';
  support3d?: boolean;
  syncState?: boolean;
  showRelatedMarkTooltip?: boolean;

  // === Animation Properties ===
  animation?: object;
  animationEnter?: object;
  animationUpdate?: object;
  animationExit?: object;

  // === Excluded Properties (NOT included in IFunnelLabelSpec) ===
  // position?: string;  // 被 Omit 排除
  // offset?: number;    // 被 Omit 排除
}
```

### Text Mark Specifications

```typescript
type IComposedTextMarkSpec = ITextMarkSpec | IRichTextMarkSpec;

interface ITextMarkSpec extends IFillMarkSpec {
  text?: string | number | string[] | number[];
  dx?: number;
  dy?: number;
  fontSize?: number | ITokenKey;
  textAlign?: TextAlign;
  textBaseline?: TextBaseLine;
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  maxLineWidth?: number;
  ellipsis?: string;
  suffixPosition?: 'start' | 'end' | 'middle';
  underline?: boolean;
  underlineDash?: number[];
  underlineOffset?: number;
  lineThrough?: boolean;
  lineHeight?: number | string | ITokenKey;
  poptip?: PopTipAttributes;
  direction?: 'horizontal' | 'vertical';
  wordBreak?: 'break-word' | 'break-all' | 'keep-all';
  heightLimit?: number;
  lineClamp?: number;
}

type IRichTextMarkSpec = IRichTextAttribute &
  IFillMarkSpec & {
    type: 'rich';
    text: IRichTextAttribute['textConfig'];
  };
```

### Fill Mark Specification

```typescript
interface IFillMarkSpec extends ICommonSpec {
  // Shadow effects
  shadowBlur?: number; // Shadow blur radius
  shadowColor?: string; // Shadow color
  shadowOffsetX?: number; // Shadow X offset
  shadowOffsetY?: number; // Shadow Y offset

  // Fill properties
  fill?: VisualType<string> | IGradient | false | IColorKey; // Fill color
  fillOpacity?: number; // Fill opacity

  // Background properties
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null; // Background fill
  backgroundMode?: 'repeat' | 'repeatX' | 'repeatY' | 'noRepeat'; // Background repeat mode @default 'repeat'
  backgroundFit?: 'contain' | 'cover' | 'fill'; // Background fit mode @default 'cover'
  backgroundKeepAspectRatio?: boolean; // Maintain background aspect ratio @default false
  backgroundScale?: number; // Background scale factor @default 1
  backgroundOffsetX?: number; // Background X offset @default 0
  backgroundOffsetY?: number; // Background Y offset @default 0
  backgroundClip?: boolean; // Enable background clipping @default true
  backgroundCornerRadius?: number; // Background corner radius @default 0
  backgroundOpacity?: number; // Background opacity @default 1
}

interface ICommonSpec {
  visible?: boolean;
  x?: number;
  y?: number;
  z?: number;
  stroke?: string | IGradient | false | (number | boolean)[] | IColorKey | null;
  strokeOpacity?: number;
  opacity?: number;
  lineWidth?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  cursor?: Cursor;
  zIndex?: number;
  angle?: number;
  anchor?: [number, number];
  scaleX?: number;
  scaleY?: number;
  scaleCenter?: [number | string, number | string];
  alpha?: number;
  beta?: number;
  anchor3d?: [number, number];
  pickMode?: 'accurate' | 'imprecise' | 'custom';
  boundsMode?: 'accurate' | 'imprecise';
}
```

### Gradient Types

```typescript
type IGradient = IGradientLinear | IGradientRadial | IGradientConical;

interface IGradientLinear {
  x0?: GradientPropValue<number>;
  y0?: GradientPropValue<number>;
  x1?: GradientPropValue<number>;
  y1?: GradientPropValue<number>;
  stops: GradientStop[];
  gradient: 'linear';
}

interface IGradientRadial {
  r0?: GradientPropValue<number>;
  x0?: GradientPropValue<number>;
  y0?: GradientPropValue<number>;
  x1?: GradientPropValue<number>;
  y1?: GradientPropValue<number>;
  r1?: GradientPropValue<number>;
  stops: GradientStop[];
  gradient: 'radial';
}

interface IGradientConical {
  x?: GradientPropValue<number>;
  y?: GradientPropValue<number>;
  startAngle?: GradientPropValue<number>;
  endAngle?: GradientPropValue<number>;
  stops: GradientStop[];
  gradient: 'conical';
}

type GradientPropValue<T> = ValueType<T> | FunctionType<T>;
type GradientStop = {
  offset: GradientPropValue<number>;
  color?: GradientPropValue<string>;
  opacity?: number;
};
```

### State Styling

```typescript
type LabelStateStyle<T> = {
  hover?: T;
  hover_reverse?: T;
  selected?: T;
  selected_reverse?: T;
};
```

### Animation Types

```typescript
type ILabelAnimationSpec = Pick<BaseLabelAttrs, 'animation' | 'animationEnter' | 'animationUpdate' | 'animationExit'>;
```

### Token System

```typescript
interface ITokenKey<T = any> {
  type: 'token';
  key: string;
  default?: T;
}

interface IColorKey {
  type: 'color';
  key: string;
  default?: string;
}
```

### Text Formatting Types

```typescript
type TextAlign = 'left' | 'center' | 'right' | 'start' | 'end';
type TextBaseLine = 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter' | number;
type FontStyle = 'normal' | 'italic' | 'oblique';

type Cursor =
  | 'auto'
  | 'default'
  | 'none'
  | 'context-menu'
  | 'help'
  | 'pointer'
  | 'progress'
  | 'wait'
  | 'cell'
  | 'crosshair'
  | 'text'
  | 'vertical-text'
  | 'alias'
  | 'copy'
  | 'move'
  | 'no-drop'
  | 'not-allowed'
  | 'grab'
  | 'grabbing'
  | 'e-resize'
  | 'n-resize'
  | 'ne-resize'
  | 'nw-resize'
  | 's-resize'
  | 'se-resize'
  | 'sw-resize'
  | 'w-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'nesw-resize'
  | 'nwse-resize'
  | 'col-resize'
  | 'row-resize'
  | 'all-scroll'
  | 'zoom-in'
  | 'zoom-out';

type ScaleType =
  | 'linear'
  | 'log'
  | 'pow'
  | 'sqrt'
  | 'symlog'
  | 'time'
  | 'utc'
  | 'ordinal'
  | 'point'
  | 'band'
  | 'threshold'
  | 'quantile'
  | 'quantize'
  | 'identity';
```

### Rich Text Types

```typescript
interface IRichTextCharacter {
  text: string;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  textDecoration?: 'none' | 'underline' | 'line-through';
  script?: 'normal' | 'sub' | 'super';
}

interface IRichTextAttribute {
  textConfig: IRichTextCharacter[];
}
```

### External Dependencies

```typescript
interface PopTipAttributes {
  // PopTip configuration from @visactor/vrender-components
  visible?: boolean;
  title?: string;
  content?: string;
  placement?: string;
  // ... other poptip properties
}

interface IColor {
  // Color interface from @visactor/vrender-core
}

type Datum = Record<string, any>;

interface ISeries {
  // Series interface - represents chart series
}

interface IModelMarkAttributeContext {
  // Mark attribute context for function evaluation
}

interface DataView {
  // DataView interface from @visactor/vdataset
}

interface BaseLabelAttrs {
  overlap: {
    // Complex overlap detection and avoidance configuration
    hideOnHit?: boolean;
    avoidBaseMark?: boolean;
    strategy?: Array<{
      type: 'position' | 'bound';
      position?: string[];
      bound?: object;
    }>;
  };
  smartInvert: {
    // Smart color inversion configuration
    mode?: 'lightness' | 'brightness';
    threshold?: number;
    fillOpacity?: number;
  };
  dataFilter: (data: any[], labelMark: any) => any[];
  customLayoutFunc: (data: any[], labels: any[], region: any) => void;
  customOverlapFunc: (labels: any[], labelMark: any) => void;
  onAfterOverlapping: (labels: any[]) => void;
  animation: object; // Animation configuration
  animationEnter: object; // Enter animation configuration
  animationUpdate: object; // Update animation configuration
  animationExit: object; // Exit animation configuration
}

interface DataLabelAttrs {
  size: {
    padding: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}
```
