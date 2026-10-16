## Overview

`IExtensionGroupMarkSpec` is a specialized group mark specification for VChart series extensions, extending `ICustomMarkSpec` with group-specific functionality:

```typescript
export interface IExtensionGroupMarkSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
  /** Support for child nodes */
  children?: ICustomMarkSpec<EnableMarkType>[];
}
```

This type specifically extends `ICustomMarkSpec` for group marks and provides hierarchical structure through child mark support.

## Base Structure

`IExtensionGroupMarkSpec` extends `ICustomMarkSpec<MarkTypeEnum.group>` which combines multiple specifications:

```typescript
interface IExtensionGroupMarkSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
  // Inherited from ICustomMarkSpec
  type: MarkTypeEnum.group; // Fixed to 'group'
  name?: string; // Mark name for event filtering @since 1.12.5
  dataIndex?: number; // Associated data index @default Same as series
  dataKey?: string | ((datum: any) => string); // Data-Mark binding @since 1.9.5
  dataId?: StringOrNumber; // Associated data ID
  componentType?: string; // Component type @since 1.9.0
  animation?: boolean; // Animation enable @since 1.11.0
  parent?: string; // Parent element ID @since 1.13.0

  // Inherited from IMarkSpec<IGroupMarkSpec>
  id?: StringOrNumber; // User-defined ID
  interactive?: boolean; // Interactive response
  zIndex?: number; // Layer order
  visible?: boolean; // Visibility
  style?: ConvertToMarkStyleSpec<IGroupMarkSpec>;
  state?: IMarkStateFullSpec<IGroupMarkSpec>;
  stateSort?: (stateA: string, stateB: string) => number; // @since 1.9.0
  support3d?: boolean; // 3D perspective support
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;

  // Inherited from IModelSpec and IAnimationSpec
  // Model and animation specifications

  // Extension Group Specific
  children?: ICustomMarkSpec<EnableMarkType>[]; // Child mark specifications
}
```

## Core Configuration Properties

### Extension Group Specific Configuration

```typescript
interface ExtensionGroupConfig {
  /** Child mark specifications supporting all mark types */
  children?: ICustomMarkSpec<EnableMarkType>[];
}
```

### Mark Type Configuration (Fixed)

```typescript
interface MarkTypeConfig {
  /** Mark type fixed to group */
  type: MarkTypeEnum.group; // 'group'
}
```

### Data Binding Configuration (Inherited from ICustomMarkSpec)

```typescript
interface DataBindingConfig {
  /** Associated data index @default Same as series data */
  dataIndex?: number;

  /** Data-Mark binding key @since 1.9.5 */
  dataKey?: string | ((datum: any) => string);

  /** Associated data ID */
  dataId?: StringOrNumber;

  /** Component type specification @since 1.9.0 */
  componentType?: string;
}
```

### Basic Mark Configuration (Inherited from IMarkSpec)

```typescript
interface BasicMarkConfig {
  /** User-defined ID */
  id?: StringOrNumber;

  /** Interactive response */
  interactive?: boolean;

  /** Layer order with other marks */
  zIndex?: number;

  /** Mark visibility */
  visible?: boolean;

  /** 3D perspective support */
  support3d?: boolean;

  /** Custom shape function */
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
}
```

### Naming and Identification (Inherited from ICustomMarkSpec)

```typescript
interface NamingConfig {
  /** Mark name for event filtering @since 1.12.5 */
  name?: string;

  /** Parent element ID @since 1.13.0 */
  parent?: string;
}
```

### Animation Configuration (Inherited from ICustomMarkSpec)

```typescript
interface AnimationConfig {
  /** Enable animation @since 1.11.0 */
  animation?: boolean;
}
```

## Style Configuration

### Group Mark Styling

```typescript
interface GroupStyleConfig {
  /** Group mark style configuration */
  style?: ConvertToMarkStyleSpec<IGroupMarkSpec>;

  /** Interactive state styles */
  state?: IMarkStateFullSpec<IGroupMarkSpec>;

  /** State sorting method @since 1.9.0 */
  stateSort?: (stateA: string, stateB: string) => number;
}
```

### State Management

```typescript
interface IMarkStateFullSpec<T> {
  /** Normal state style */
  normal?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Hover state style */
  hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Non-hover state style */
  hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Selected state style */
  selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Non-selected state style */
  selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
}

interface IMarkStateSpec<T> {
  /** State filter criteria */
  filter?: IMarkStateFilter;

  /** State priority level */
  level?: number | undefined;

  /** State style */
  style: ConvertToMarkStyleSpec<T>;
}

type IMarkStateStyleSpec<T> = ConvertToMarkStyleSpec<T>;
```

### State Filters

```typescript
type IMarkStateFilter =
  | {
      /** Dimension filtering */
      fields: { [key in string]: { type: 'ordinal' | 'linear'; domain: StringOrNumber[] } };
    }
  | {
      /** Data filtering */
      datums: Datum[];
      datumKeys: string[];
    }
  | {
      /** Item filtering */
      items: IGraphic[];
    }
  | ((
      datum: Datum,
      options: {
        mark?: IMark;
        type?: string;
        renderNode?: IGraphic;
      }
    ) => boolean);
```

## Child Mark Configuration

### Supported Child Mark Types

```typescript
type EnableMarkType = keyof IBuildinMarkSpec;

type IBuildinMarkSpec = {
  group: IGroupMarkSpec; // Nested group marks
  symbol: ISymbolMarkSpec; // Symbol marks
  rule: IRuleMarkSpec; // Rule/line marks
  line: ILineMarkSpec; // Line marks
  text: ITextMarkSpec; // Text marks
  rect: IRectMarkSpec; // Rectangle marks
  image: IImageMarkSpec; // Image marks
  path: IPathMarkSpec; // Path marks
  area: IAreaMarkSpec; // Area marks
  arc: IArcMarkSpec; // Arc marks
  polygon: IPolygonMarkSpec; // Polygon marks
  boxPlot: IBoxPlotMarkSpec; // Box plot marks
  linkPath: ILinkPathMarkSpec; // Link path marks
  ripple: IRippleMarkSpec; // Ripple marks
};
```

### Child Mark Specification

```typescript
interface ChildMarkConfig {
  /** Array of child mark specifications */
  children?: ICustomMarkSpec<EnableMarkType>[];
}

interface ICustomMarkSpec<T extends EnableMarkType> {
  type: T; // Child mark type
  name?: string; // Child mark name
  dataIndex?: number; // Child data index
  dataKey?: string | ((datum: any) => string); // Child data key
  dataId?: StringOrNumber; // Child data ID
  componentType?: string; // Child component type
  animation?: boolean; // Child animation
  parent?: string; // Child parent ID

  // Child mark styling
  id?: StringOrNumber;
  interactive?: boolean;
  zIndex?: number;
  visible?: boolean;
  style?: ConvertToMarkStyleSpec<IBuildinMarkSpec[T]>;
  state?: IMarkStateFullSpec<IBuildinMarkSpec[T]>;
  support3d?: boolean;
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
}
```

## Progressive Rendering Configuration

### Mark Progressive Configuration (Inherited)

```typescript
interface IMarkProgressiveConfig {
  /** Progressive rendering configuration for large datasets */
  progressive?: {
    /** Enable progressive rendering */
    enable?: boolean;
    /** Batch size for rendering */
    threshold?: number;
    /** Rendering chunk size */
    step?: number;
  };
}
```

## Dependency Type Definitions

### Group Mark Style Types

```typescript
interface IGroupMarkSpec extends ICommonSpec {
  /** Group fill color */
  fill?: string;

  /** Group stroke color */
  stroke?: string;

  /** Group stroke width */
  strokeWidth?: number;

  /** Group opacity */
  opacity?: number;

  /** Group clip path */
  clip?: boolean;

  /** Group transform */
  transform?: string;

  // ... additional group style properties
}
```

### Animation and Model Specifications

```typescript
interface IAnimationSpec<T, K> {
  // Animation configuration interface
}

interface IModelSpec {
  // Model specification interface
}
```

### Basic Types

```typescript
type StringOrNumber = string | number;
type Datum = Record<string, any>;

enum MarkTypeEnum {
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

### VRender Types

```typescript
interface IGraphic {
  // VRender graphic element interface
}

interface IMark {
  // VChart mark interface
}

interface ICustomPath2D {
  // Custom path interface
}
```

## Usage Examples

### Basic Extension Group Mark

```typescript
const basicGroupMark: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'customGroup',
  visible: true,
  style: {
    fill: 'transparent',
    stroke: '#cccccc',
    strokeWidth: 1
  },
  children: [
    {
      type: 'rect',
      style: {
        fill: '#ff0000',
        width: 20,
        height: 10
      }
    },
    {
      type: 'text',
      style: {
        text: 'Label',
        fontSize: 12,
        fill: '#333333'
      }
    }
  ]
};
```

### Hierarchical Group Structure

```typescript
const hierarchicalGroup: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'mainGroup',
  dataIndex: 0,
  style: {
    fill: 'transparent'
  },
  children: [
    {
      type: 'group',
      name: 'subGroup1',
      style: { fill: 'rgba(255, 0, 0, 0.1)' },
      children: [
        {
          type: 'symbol',
          style: {
            fill: '#ff0000',
            size: 8,
            shape: 'circle'
          }
        },
        {
          type: 'text',
          style: {
            text: datum => datum.label,
            fontSize: 10,
            fill: '#333'
          }
        }
      ]
    },
    {
      type: 'group',
      name: 'subGroup2',
      style: { fill: 'rgba(0, 255, 0, 0.1)' },
      children: [
        {
          type: 'rect',
          style: {
            fill: '#00ff00',
            width: 15,
            height: 15
          }
        }
      ]
    }
  ]
};
```

### Interactive Group with State Management

```typescript
const interactiveGroup: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'interactiveGroup',
  interactive: true,
  dataKey: datum => `group_${datum.id}`,
  style: {
    fill: 'transparent',
    stroke: '#999999',
    strokeWidth: 1
  },
  state: {
    hover: {
      style: {
        stroke: '#ff0000',
        strokeWidth: 2
      }
    },
    selected: {
      style: {
        fill: 'rgba(255, 0, 0, 0.1)',
        stroke: '#ff0000',
        strokeWidth: 3
      }
    }
  },
  stateSort: (a, b) => (a === 'selected' ? 1 : -1),
  children: [
    {
      type: 'symbol',
      interactive: true,
      style: {
        fill: '#1890ff',
        size: 12
      },
      state: {
        hover: { fill: '#40a9ff', size: 14 },
        selected: { fill: '#096dd9', size: 16 }
      }
    },
    {
      type: 'text',
      style: {
        text: datum => datum.name,
        fontSize: 11,
        fill: '#666'
      },
      state: {
        hover: { fill: '#333', fontSize: 12 },
        selected: { fill: '#000', fontWeight: 'bold' }
      }
    }
  ]
};
```

### Data-Driven Group Configuration

```typescript
const dataDrivenGroup: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'dataDrivenGroup',
  dataIndex: 1,
  dataKey: 'groupKey',
  componentType: 'annotation',
  style: {
    fill: 'transparent'
  },
  children: [
    {
      type: 'rect',
      dataKey: 'backgroundKey',
      style: {
        fill: datum => datum.bgColor || '#f0f0f0',
        width: datum => datum.width || 50,
        height: datum => datum.height || 30,
        cornerRadius: 4
      }
    },
    {
      type: 'text',
      dataKey: 'labelKey',
      style: {
        text: datum => datum.label || '',
        fontSize: datum => datum.fontSize || 12,
        fill: datum => datum.textColor || '#333',
        textAlign: 'center',
        textBaseline: 'middle'
      }
    },
    {
      type: 'symbol',
      dataKey: 'iconKey',
      style: {
        shape: datum => datum.iconShape || 'circle',
        size: datum => datum.iconSize || 8,
        fill: datum => datum.iconColor || '#666'
      }
    }
  ]
};
```

### Animated Group with 3D Support

```typescript
const animatedGroup: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'animatedGroup',
  animation: true,
  support3d: true,
  style: {
    fill: 'transparent'
  },
  children: [
    {
      type: 'path',
      animation: true,
      support3d: true,
      style: {
        path: 'M 0 0 L 10 10 L 0 20 Z',
        fill: '#ff6b6b',
        stroke: '#ff5252',
        strokeWidth: 2
      },
      customShape: (datum, attrs, path) => {
        // Custom 3D path generation
        const z = datum.z || 0;
        path.moveTo(0, 0);
        path.lineTo(10 + z, 10);
        path.lineTo(z, 20);
        path.closePath();
        return path;
      }
    },
    {
      type: 'text',
      animation: true,
      style: {
        text: '3D Label',
        fontSize: 10,
        fill: '#333',
        z: datum => datum.z || 0
      }
    }
  ]
};
```

### Custom Layout Group

```typescript
const customLayoutGroup: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'customLayoutGroup',
  parent: 'mainContainer',
  zIndex: 100,
  customShape: (datum, attrs, path) => {
    // Custom group bounds calculation
    const { width, height } = attrs;
    path.rect(0, 0, width || 100, height || 50);
    return path;
  },
  children: [
    {
      type: 'line',
      name: 'connector',
      style: {
        x1: 0,
        y1: 25,
        x2: 100,
        y2: 25,
        stroke: '#ddd',
        strokeWidth: 1,
        lineDash: [5, 5]
      }
    },
    {
      type: 'symbol',
      name: 'startPoint',
      style: {
        x: 0,
        y: 25,
        size: 6,
        fill: '#52c41a',
        shape: 'circle'
      }
    },
    {
      type: 'symbol',
      name: 'endPoint',
      style: {
        x: 100,
        y: 25,
        size: 6,
        fill: '#f5222d',
        shape: 'circle'
      }
    }
  ]
};
```

### Filter-Based State Group

```typescript
const filterStateGroup: IExtensionGroupMarkSpec = {
  type: MarkTypeEnum.group,
  name: 'filterStateGroup',
  state: {
    highlight: {
      filter: {
        fields: {
          category: { type: 'ordinal', domain: ['A', 'B'] }
        }
      },
      level: 1,
      style: {
        stroke: '#1890ff',
        strokeWidth: 2
      }
    },
    dimmed: {
      filter: (datum, options) => {
        return datum.value < options.mark?.threshold;
      },
      level: 0,
      style: {
        opacity: 0.3
      }
    }
  },
  children: [
    {
      type: 'rect',
      style: {
        fill: '#1890ff',
        width: 40,
        height: 20
      },
      state: {
        highlight: {
          style: { fill: '#40a9ff' }
        },
        dimmed: {
          style: { fill: '#d9d9d9' }
        }
      }
    }
  ]
};
```

## Usage Context

`IExtensionGroupMarkSpec` is used for creating hierarchical mark structures in VChart series extensions:

- **Composite Elements**: Building complex visual elements from multiple primitive marks
- **Hierarchical Organization**: Creating nested group structures for logical organization
- **Interactive Units**: Grouping related marks for unified interaction handling
- **Layout Containers**: Using groups as layout containers for child mark positioning
- **State Management**: Coordinated state changes across multiple child marks
- **3D Rendering**: Supporting three-dimensional group rendering with child elements

Extension group marks are particularly useful for:

- Creating custom annotation components
- Building complex chart elements (legends, tooltips, callouts)
- Implementing composite interactive elements
- Supporting hierarchical data visualization
- Creating reusable visual components
- Managing complex mark relationships and dependencies
