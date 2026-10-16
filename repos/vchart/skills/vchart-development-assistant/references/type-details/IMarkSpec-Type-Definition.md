## IMarkSpec Type Definition

### Core Interface

`IMarkSpec` defines the configuration for mark elements in VChart, extending progressive rendering capabilities with comprehensive styling and interaction options.

```typescript
type IMarkSpec<T extends ICommonSpec = ICommonSpec> = {
  /**
   * 用户id
   */
  id?: StringOrNumber;
  /**
   * 是否响应交互
   */
  interactive?: boolean;
  /**
   * 与其他mark元素的层级
   */
  zIndex?: number;
  /**
   * mark 层 是否显示配置
   */
  visible?: boolean;
  /**
   * 默认样式设置
   */
  style?: ConvertToMarkStyleSpec<T>;
  /**
   * 不同状态下的样式配置
   */
  state?: IMarkStateFullSpec<T>;
  /**
   * 状态排序方法，默认状态都是按照添加的顺序处理的，如果有特殊的需求，需要指定状态顺序，可以通过这个方法实现
   * @since 1.9.0
   */
  stateSort?: (stateA: string, stateB: string) => number;
  /**
   * 是否是3d视角的mark
   */
  support3d?: boolean;
  /**
   * customized shape of mark
   */
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
} & IMarkProgressiveConfig;
```

### Progressive Rendering Configuration

#### IMarkProgressiveConfig
```typescript
type IMarkProgressiveConfig = {
  /**
   * 是否开启大数据渲染模式，开启后会降低渲染的精度
   * @default false
   */
  large?: boolean;
  /**
   * 开启大数据渲染优化的阀值，对应的是data的长度
   * 推荐 largeThreshold < progressiveThreshold
   */
  largeThreshold?: number;
  /**
   * 分片长度
   */
  progressiveStep?: number;
  /**
   * 开启分片渲染的阀值，对应的是单系列data的长度
   */
  progressiveThreshold?: number;
};
```

### State Management System

#### IMarkStateFullSpec
```typescript
interface IMarkStateFullSpec<T> extends Record<string, IMarkStateSpec<T> | IMarkStateStyleSpec<T>> {
  /**
   * 正常状态下图元的样式设置
   */
  normal?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * hover状态下图元的样式设置
   */
  hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * 没有被hover的状态下图元的样式设置
   */
  hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * 选中状态下图元的样式设置
   */
  selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * 没有被选中的状态下图元的样式设置
   */
  selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
}
```

#### IMarkStateSpec
```typescript
interface IMarkStateSpec<T> {
  /**
   * 筛选器
   */
  filter?: IMarkStateFilter;
  /**
   * 状态优先级
   */
  level?: number | undefined;
  /**
   * 状态样式配置
   */
  style: ConvertToMarkStyleSpec<T>;
}
```

#### IMarkStateStyleSpec
```typescript
type IMarkStateStyleSpec<T> = ConvertToMarkStyleSpec<T>;
```

### State Filter System

#### IMarkStateFilter
```typescript
type IMarkStateFilter =
  | {
      /** 维度筛选 */
      fields: { [key in string]: { type: 'ordinal' | 'linear'; domain: StringOrNumber[] } };
    }
  | {
      /** 筛选数据 */
      datums: Datum[];
      /** 筛选数据 */
      datumKeys: string[];
    }
  | {
      /** 筛选 item */
      items: IGraphic[];
    }
  /** 筛选函数 */
  | ((
      datum: Datum,
      options: {
        mark?: IMark;
        type?: string;
        renderNode?: IGraphic;
      }
    ) => boolean);
```

### Supporting Types

#### Style Conversion System
```typescript
type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
  [key in keyof T]: VisualType<T[key]>;
};

type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
type ValueType<T> = T;
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
```

#### Custom Path Types
```typescript
interface ICustomPath2D {
  // VRender Path2D interface for custom shape drawing
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
  closePath(): void;
}
```

#### Base Data Types
```typescript
type StringOrNumber = string | number;

interface Datum {
  [key: string]: any;
}

interface IGraphic {
  // VRender graphic node interface
  [key: string]: any;
}
```

### Usage Examples

#### Basic Mark Configuration
```typescript
const basicMark: IMarkSpec<IRectMarkSpec> = {
  id: 'my-rect-mark',
  visible: true,
  interactive: true,
  zIndex: 10,
  style: {
    fill: '#1890ff',
    stroke: '#333',
    lineWidth: 1
  }
};
```

#### Mark with State Styles
```typescript
const interactiveMark: IMarkSpec<ISymbolMarkSpec> = {
  visible: true,
  interactive: true,
  style: {
    fill: '#52c41a',
    size: 8
  },
  state: {
    hover: {
      style: {
        fill: '#73d13d',
        size: 12
      }
    },
    selected: {
      level: 2,
      style: {
        fill: '#1890ff',
        size: 10,
        stroke: '#096dd9',
        lineWidth: 2
      }
    },
    hover_reverse: {
      style: {
        fillOpacity: 0.5
      }
    }
  }
};
```

#### Progressive Rendering Mark
```typescript
const progressiveMark: IMarkSpec<ILineMarkSpec> = {
  visible: true,
  style: {
    stroke: '#ff4d4f',
    lineWidth: 2
  },
  large: true,
  largeThreshold: 5000,
  progressiveStep: 1000,
  progressiveThreshold: 10000
};
```

#### Mark with Custom State Filter
```typescript
const filteredMark: IMarkSpec<IAreaMarkSpec> = {
  visible: true,
  style: {
    fill: '#faad14',
    fillOpacity: 0.6
  },
  state: {
    highlight: {
      filter: {
        fields: {
          category: { type: 'ordinal', domain: ['A', 'B', 'C'] }
        }
      },
      style: {
        fill: '#ff7a45',
        fillOpacity: 1
      }
    },
    disabled: {
      filter: (datum, options) => {
        return datum.value < 10;
      },
      style: {
        fillOpacity: 0.2
      }
    }
  }
};
```

#### Mark with Custom Shape
```typescript
const customShapeMark: IMarkSpec<ISymbolMarkSpec> = {
  visible: true,
  style: {
    fill: '#722ed1',
    size: 20
  },
  customShape: (datum, attrs, path) => {
    // Create custom diamond shape
    const size = attrs.size || 10;
    const half = size / 2;
    
    path.moveTo(0, -half);
    path.lineTo(half, 0);
    path.lineTo(0, half);
    path.lineTo(-half, 0);
    path.closePath();
    
    return path;
  }
};
```

#### 3D Mark Configuration
```typescript
const mark3D: IMarkSpec<IRectMarkSpec> = {
  visible: true,
  support3d: true,
  style: {
    fill: '#13c2c2',
    width: 20,
    height: 30,
    z: 10
  },
  state: {
    hover: {
      style: {
        fill: '#36cfc9',
        z: 15
      }
    }
  }
};
```

#### Complex State Sorting
```typescript
const prioritizedMark: IMarkSpec<ITextMarkSpec> = {
  visible: true,
  interactive: true,
  style: {
    text: 'Label',
    fontSize: 12,
    fill: '#333'
  },
  state: {
    hover: {
      style: { fill: '#1890ff' }
    },
    selected: {
      style: { fontWeight: 'bold' }
    },
    error: {
      style: { fill: '#ff4d4f' }
    }
  },
  stateSort: (stateA, stateB) => {
    // Error state has highest priority
    const priority = { error: 3, selected: 2, hover: 1 };
    return (priority[stateB] || 0) - (priority[stateA] || 0);
  }
};
```
