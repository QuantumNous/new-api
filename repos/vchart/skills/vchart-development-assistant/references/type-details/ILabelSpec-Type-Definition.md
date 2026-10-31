## ILabelSpec Type Definition

### Core Interface

`ILabelSpec` defines the configuration for series data labels in VChart, extending label animation specifications with comprehensive styling and layout options.

```typescript
interface ILabelSpec extends ILabelAnimationSpec {
  zIndex?: number;
  visible?: boolean;
  interactive?: boolean;
  textType?: 'text' | 'rich';                    // @deprecated
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum, ctx?: ILabelFormatMethodContext]>;
  formatter?: string | string[];
  offset?: number;
  position?: string;
  style?: ConvertToMarkStyleSpec<IComposedTextMarkSpec>;
  state?: LabelStateStyle<Partial<IComposedTextMarkSpec>>;
  overlap?: OverlapConfig & { padding?: PaddingConfig; };
  smartInvert?: SmartInvertConfig;
  stackDataFilterType?: 'min' | 'max';
  dataFilter?: (labels: LabelItem[]) => LabelItem[];
  customLayoutFunc?: (labels: LabelItem[], texts: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike) => (IText | IRichText)[];
  customOverlapFunc?: (labels: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike, labelComponent?: IGroup) => (IText | IRichText)[];
  onAfterOverlapping?: (labels: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike, labelComponent?: IGroup) => (IText | IRichText)[];
  labelLayout?: 'series' | 'region';
  support3d?: boolean;
  syncState?: boolean;
  showRelatedMarkTooltip?: boolean;
}
```

### Supporting Types

#### Overlap Configuration
```typescript
type OverlapConfig = boolean | {
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
   * 分离力度配置
   */
  separateForce?: number;
  /**
   * 避让间距
   */
  avoidMarks?: string[];
};

type OverlapStrategy = {
  type: 'position';
  position: Array<'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>;
} | {
  type: 'moveY' | 'moveX';
  offset?: number;
} | {
  type: 'bound';
  position?: Array<'top' | 'bottom' | 'left' | 'right'>;
};

type PaddingConfig = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};
```

#### Smart Invert Configuration  
```typescript
type SmartInvertConfig = boolean | {
  /**
   * 是否启用智能反色
   * @default false
   */
  enable?: boolean;
  /**
   * 亮度阈值，用于判断是否反色
   * @default 128
   */
  threshold?: number;
  /**
   * 反色文本颜色
   * @default '#fff'
   */
  fillStrategy?: string | ((fill: string) => string);
};
```

#### Animation Specification
```typescript
interface ILabelAnimationSpec {
  /**
   * 标签动画配置
   */
  animation?: boolean | {
    duration?: number;
    delay?: number;
    easing?: string;
  };
  /**
   * 标签入场动画
   */
  animationEnter?: boolean | {
    duration?: number;
    delay?: number;
    easing?: string;
    type?: 'fadeIn' | 'moveIn' | 'scaleIn';
  };
  /**
   * 标签更新动画
   */
  animationUpdate?: boolean | {
    duration?: number;
    delay?: number;
    easing?: string;
  };
  /**
   * 标签退场动画
   */
  animationExit?: boolean | {
    duration?: number;
    delay?: number;
    easing?: string;
    type?: 'fadeOut' | 'moveOut' | 'scaleOut';
  };
}
```

#### Label Item and Graphics Types
```typescript
interface LabelItem {
  id?: string;
  data?: any;
  position?: IPointLike;
  style?: any;
}

interface IPointLike {
  x: number;
  y: number;
}

interface IText {
  setAttributes(attrs: any): void;
  attribute: any;
}

interface IRichText extends IText {}

interface IGraphic {
  AABBBounds: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface IGroup extends IGraphic {}
```

#### Format Method Context
```typescript
interface ILabelFormatMethodContext {
  series?: ISeries;
}
```

#### State Style Configuration
```typescript
type LabelStateStyle<T> = {
  hover?: T;                    // Hover state style
  hover_reverse?: T;           // Hover reverse state style
  selected?: T;                // Selected state style
  selected_reverse?: T;        // Selected reverse state style
};
```

#### Multi-Label Support
```typescript
type IMultiLabelSpec<T extends Omit<ILabelSpec, 'position'>> = T | T[];
```

### Property Groups

#### Basic Configuration
```typescript
interface ILabelBasicConfig {
  zIndex?: number;              // Label layer level
  visible?: boolean;            // Show/hide labels (default: false)
  interactive?: boolean;       // Enable interaction (default: false)
  textType?: 'text' | 'rich';  // @deprecated Text type
}
```

#### Content and Formatting
```typescript
interface ILabelContentConfig {
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum, ctx?: ILabelFormatMethodContext]>;
  formatter?: string | string[];  // Template string with {} variables
  offset?: number;                // Distance from data mark
  position?: string;              // Label position
}
```

#### Layout and Overlap Handling
```typescript
interface ILabelLayoutConfig {
  overlap?: OverlapConfig & {
    padding?: PaddingConfig;  // Overlap area padding
  };
  smartInvert?: SmartInvertConfig;    // Smart color inversion
  labelLayout?: 'series' | 'region';             // Layout scope
  support3d?: boolean;                            // 3D support
}
```

#### Advanced Features
```typescript
interface ILabelAdvancedConfig {
  stackDataFilterType?: 'min' | 'max';           // Stack data filter type
  dataFilter?: (labels: LabelItem[]) => LabelItem[];     // Custom data filter
  customLayoutFunc?: (labels: LabelItem[], texts: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike) => (IText | IRichText)[];       // Custom layout function
  customOverlapFunc?: (labels: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike, labelComponent?: IGroup) => (IText | IRichText)[];     // Custom overlap function
  onAfterOverlapping?: (labels: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike, labelComponent?: IGroup) => (IText | IRichText)[];   // Post-overlap callback
  syncState?: boolean;                            // Sync with mark state (default: false)
  showRelatedMarkTooltip?: boolean;              // Show related mark tooltip (default: false)
}
```

### Usage Examples

#### Basic Label Configuration
```typescript
const basicLabel: ILabelSpec = {
  visible: true,
  position: 'top',
  style: {
    fontSize: 12,
    fill: '#333'
  }
};
```

#### Formatted Labels
```typescript
const formattedLabel: ILabelSpec = {
  visible: true,
  formatter: 'Value: {value}',
  formatMethod: (text, datum, ctx) => {
    return `${text} (${datum.category})`;
  }
};
```

#### Interactive Labels with States
```typescript
const interactiveLabel: ILabelSpec = {
  visible: true,
  interactive: true,
  style: {
    fontSize: 12,
    fill: '#666'
  },
  state: {
    hover: {
      fill: '#333',
      fontSize: 14
    },
    selected: {
      fill: '#1890ff',
      fontWeight: 'bold'
    }
  }
};
```

#### Overlap Prevention
```typescript
const overlapLabel: ILabelSpec = {
  visible: true,
  overlap: {
    hideOnHit: true,
    avoidBaseMark: true,
    strategy: [
      {
        type: 'position',
        position: ['top', 'bottom', 'left', 'right']
      }
    ],
    padding: { top: 2, bottom: 2, left: 4, right: 4 }
  },
  smartInvert: {
    enable: true,
    threshold: 128,
    fillStrategy: '#fff'
  }
};
```

### Total Label Specification

```typescript
type ITotalLabelSpec = Pick<ILabelSpec, 'visible' | 'formatMethod' | 'interactive' | 'offset' | 'style' | 'state' | 'textType' | 'overlap'> & {
  position?: 'top' | 'bottom';        // Total label position (default: 'top')
  alwayCalculateTotal?: boolean;      // Always calculate total (default: false)
};
```

### Internal Types

#### Transformed Label Specification
```typescript
type TransformedLabelSpec = ILabelSpec & {
  getStyleHandler: (series: ISeries) => (mark?: ILabelMark, spec?: any) => void;
};
```

#### Label Information Context
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
