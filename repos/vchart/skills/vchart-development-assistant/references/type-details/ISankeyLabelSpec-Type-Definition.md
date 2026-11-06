# ISankeyLabelSpec Type Definition

## Interface Overview

```typescript
type ISankeyLabelSpec = ILabelSpec & {
  position?: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right';
  limit?: number;
};
```

`ISankeyLabelSpec` 定义了桑基图标签的完整规范，继承自 `ILabelSpec` 的所有属性，并添加了桑基图特定的位置配置和文字缩略功能。

## Core Properties

### Sankey-specific Properties

- `position?: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right'` - 标签布局方式，默认 'outside'
  - `'outside'` - 在节点外部显示
  - `'inside-start'` - 在节点内部起始位置
  - `'inside-middle'` - 在节点内部中间位置
  - `'inside-end'` - 在节点内部结束位置
  - `'left'` - 节点左侧
  - `'right'` - 节点右侧
- `limit?: number` - 标签文字缩略，指定最大字符数

## Inherited Properties (from ILabelSpec)

### Basic Display

- `zIndex?: number` - 标签组件的层级
- `visible?: boolean` - 是否显示标签，默认 false
- `interactive?: boolean` - 是否支持交互，默认 false

### Text Content & Formatting

- `textType?: 'text' | 'rich'` - 文本类型，rich 类型已废弃 (since 1.7.0)
- `formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum, ctx?: ILabelFormatMethodContext]>` - 格式化函数 (since 1.10.0)
- `formatter?: string | string[]` - 字符串模板，使用 {} 包裹变量名 (since 1.7.0)

### Layout & Positioning

- `offset?: number` - 标签与对应数据图元的间距
- `overlap?: BaseLabelAttrs['overlap'] & { padding?: DataLabelAttrs['size']['padding'] }` - 标签防重叠配置
- `smartInvert?: BaseLabelAttrs['smartInvert']` - 标签智能反色配置

### Visual Styling

- `style?: ConvertToMarkStyleSpec<IComposedTextMarkSpec>` - 标签样式配置
- `state?: LabelStateStyle<Partial<IComposedTextMarkSpec>>` - 交互状态样式配置

### Data Processing

- `stackDataFilterType?: 'min' | 'max'` - 堆积数据过滤类型 (since 1.12.0)
- `dataFilter?: BaseLabelAttrs['dataFilter']` - 自定义标签数据筛选和排序 (since 1.3.0)

### Custom Layout Functions

- `customLayoutFunc?: BaseLabelAttrs['customLayoutFunc']` - 自定义标签布局函数 (since 1.3.0)
- `customOverlapFunc?: BaseLabelAttrs['customOverlapFunc']` - 自定义标签躲避函数 (since 1.3.0)
- `onAfterOverlapping?: BaseLabelAttrs['onAfterOverlapping']` - 防重叠计算完成后的回调函数 (since 1.13.5)

### Advanced Configuration

- `labelLayout?: 'series' | 'region'` - 标签布局方式
- `support3d?: boolean` - 是否支持 3D
- `syncState?: boolean` - 是否同步数据图元的状态变化，默认 false (since 1.9.0)
- `showRelatedMarkTooltip?: boolean` - 是否显示标签关联图元的 mark tooltip，默认 false (since 1.13.5)

### Animation Properties

- `animation?: BaseLabelAttrs['animation']` - 动画配置
- `animationEnter?: BaseLabelAttrs['animationEnter']` - 入场动画配置
- `animationUpdate?: BaseLabelAttrs['animationUpdate']` - 更新动画配置
- `animationExit?: BaseLabelAttrs['animationExit']` - 退场动画配置

## Complete Type Definitions

### IFormatMethod<T>

```typescript
type IFormatMethod<T extends any[]> = (
  ...args: T
) => ReturnType<ITextFormatMethod<T>> | ReturnType<IRichTextFormatMethod<T>>;

type ITextFormatMethod<T extends any[]> = (
  ...args: T
) => ITextMarkSpec['text'] | { type: 'text'; text: ITextMarkSpec['text'] };

type IRichTextFormatMethod<T extends any[]> = (...args: T) =>
  | {
      type: 'rich';
      text: IRichTextCharacter[];
    }
  | IRichTextCharacter[];
```

### ILabelFormatMethodContext

```typescript
interface ILabelFormatMethodContext {
  series?: ISeries;
}
```

### ConvertToMarkStyleSpec<T>

```typescript
type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
  [key in keyof T]: VisualType<T[key]>;
};

type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
type ValueType<T> = T;
type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
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
  whiteSpace?: 'normal' | 'no-wrap';
}

type IRichTextMarkSpec = IRichTextAttribute &
  IFillMarkSpec & {
    type: 'rich';
    text: IRichTextAttribute['textConfig'];
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
  pickStrokeBuffer?: number;
  texture?: TextureType | string;
  textureColor?: string;
  textureSize?: number;
  texturePadding?: number;
  outerBorder?: IBorder;
  innerBorder?: IBorder;
  html?: IMarkHtmlSpec;
}
```

### Animation Types

```typescript
type ILabelAnimationSpec = Pick<BaseLabelAttrs, 'animation' | 'animationEnter' | 'animationUpdate' | 'animationExit'>;
```

### Text Formatting Types

```typescript
type TextAlign = 'left' | 'center' | 'right' | 'start' | 'end';
type TextBaseLine = 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type FontStyle = 'normal' | 'italic' | 'oblique' | string;

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

type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
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

### Token and Theme Types

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

interface IBorder {
  distance: number | string;
  stroke?: string | IGradient;
  strokeOpacity?: number;
  lineWidth?: number;
  lineDash?: number[];
  lineDashOffset?: number;
}
```

### External Dependencies

```typescript
type Datum = Record<string, any>;

interface ISeries {
  // Series interface
}

interface IModelMarkAttributeContext {
  // Mark attribute context for function evaluation
}

interface DataView {
  // DataView interface from @visactor/vdataset
}

interface PopTipAttributes {
  // PopTip configuration from @visactor/vrender-components
}

interface IColor {
  // Color interface from @visactor/vrender-core
}

type IMarkHtmlSpec = Partial<IGraphicStyle['html']>;

interface IGraphicStyle {
  html: {
    // HTML layer configuration
  };
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
  animation: object;
  animationEnter: object;
  animationUpdate: object;
  animationExit: object;
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
