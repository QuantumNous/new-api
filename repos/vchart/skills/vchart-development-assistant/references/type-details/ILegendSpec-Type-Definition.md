## Overview
`ILegendSpec` defines the configuration interface for legend components in VChart. It is a union type that supports three legend types: discrete legends for categorical data, color legends for continuous color mapping, and size legends for continuous size mapping.

## Union Type Structure

```typescript
type ILegendSpec = IDiscreteLegendSpec | IColorLegendSpec | ISizeLegendSpec;
```

## Common Legend Configuration

```typescript
interface ILegendCommonSpec extends Omit<IComponentSpec, 'orient'> {
  visible?: boolean;                    // Legend visibility (default: true)
  orient?: IOrientType;                 // Legend position (default: 'left')
  position?: 'start' | 'middle' | 'end';  // Alignment within orientation (default: 'middle')
  layout?: 'horizontal' | 'vertical';  // Layout direction (auto-determined by orient)
  filter?: boolean;                     // Enable data filtering (default: true)
  customFilter?: CustomFilterFunction; // Custom filter function
  title?: ITitle;                       // Legend title configuration
  background?: ILegendBackground;       // Legend background styling
  interactive?: boolean;                // Enable interactions (default: true)
}
```

## Discrete Legend Specification

```typescript
interface IDiscreteLegendSpec extends ILegendCommonSpec {
  type?: 'discrete';                    // Discrete legend type (default)
  data?: DataTransformFunction;         // Custom data transformation
  item?: IItem;                         // Legend item configuration
  pager?: IPager | ILegendScrollbar;    // Pagination or scrollbar
  scale?: string;                       // Associated scale ID
  scaleName?: string;                   // Alternative scale name
  field?: string;                       // Data field mapping
  defaultSelected?: string[];           // Default selected items
}
```

## Color Legend Specification

```typescript
interface IColorLegendSpec extends IContinuousLegendSpec {
  type: 'color';                        // Color legend type
}
```

## Size Legend Specification

```typescript
interface ISizeLegendSpec extends IContinuousLegendSpec {
  type: 'size';                         // Size legend type
  sizeBackground?: IRectMarkStyle;      // Size background styling
  align?: 'top' | 'bottom' | 'left' | 'right';  // Handler alignment
}
```

## Continuous Legend Base

```typescript
interface IContinuousLegendSpec extends ILegendCommonSpec {
  inverse?: boolean;                    // Reverse display order (default: false)
  field?: string;                       // Associated data field
  scale?: string;                       // Associated scale ID
  defaultSelected?: [number, number];   // Default selected range
  slidable?: boolean;                   // Enable dragging (default: true)
  rail?: IRailConfiguration;            // Slider rail styling
  handler?: IHandlerConfiguration;      // Slider handler styling
  track?: ITrackConfiguration;          // Selected area styling
  startText?: ITextAttribute;           // Start text configuration
  endText?: ITextAttribute;             // End text configuration
  handlerText?: IHandlerTextAttribute;  // Handler text configuration
}
```

## Supporting Type Definitions

### Legend Item Configuration
```typescript
interface IItem {
  align?: 'left' | 'right';            // Icon-text alignment
  background?: IItemBackground;         // Item background styling
  shape?: IItemShape;                   // Icon configuration
  label?: IItemLabel;                   // Label configuration
  value?: IItemValue;                   // Value configuration
  focusIconStyle?: ISymbolMarkSpec;     // Focus button styling
  maxWidth?: number | string;           // Maximum width constraint
  width?: number | string;              // Fixed width
  height?: number | string;             // Fixed height
  autoEllipsisStrategy?: 'labelFirst' | 'valueFirst' | 'none';  // Text truncation strategy
}
```

### Title Configuration
```typescript
interface ITitle {
  textStyle?: ITextMarkSpec;            // Title text styling
  shape?: {                            // Title icon configuration
    visible?: boolean;
    space?: number;
    style?: ISymbolMarkSpec;
  };
  background?: {                       // Title background
    visible?: boolean;
    style?: IRectMarkSpec;
  };
  // Additional title properties from LegendTitle
}
```

### Background Configuration
```typescript
interface ILegendBackground {
  visible?: boolean;                    // Show background
  padding?: IPadding | number | number[];  // Background padding
  style?: IRectMarkSpec;                // Background styling
}
```

### Pagination Configuration
```typescript
interface IPager {
  textStyle?: ITextMarkSpec;            // Page text styling
  handler?: {                          // Navigation buttons
    space?: number;                     // Button-text spacing
    preShape?: string;                  // Previous button shape
    nextShape?: string;                 // Next button shape
    style?: ISymbolMarkSpec;            // Button styling
    state?: {                          // Button states
      hover?: ISymbolMarkSpec;
      disable?: ISymbolMarkSpec;
    };
  };
}
```

### Scrollbar Configuration
```typescript
interface ILegendScrollbar {
  type: 'scrollbar';
  railStyle?: IRectMarkSpec;            // Scrollbar rail styling
  sliderStyle?: IRectMarkSpec;          // Scrollbar slider styling
}
```

## Complete Interface Definition

```typescript
interface ILegendSpec {
  // Component association
  regionIndex?: number | number[];
  regionId?: string | number | (string | number)[];
  seriesIndex?: number | number[];
  seriesId?: string | number | (string | number)[];
  
  // Common properties
  visible?: boolean;
  orient?: 'left' | 'top' | 'right' | 'bottom' | 'z';
  position?: 'start' | 'middle' | 'end';
  layout?: 'horizontal' | 'vertical';
  filter?: boolean;
  customFilter?: (data: any, selectedRange: string[] | number[], datumField: string) => any;
  interactive?: boolean;
  
  // Legend type (determines additional properties)
  type?: 'discrete' | 'color' | 'size';
  
  // Title configuration
  title?: {
    textStyle?: ITextMarkSpec;
    shape?: {
      visible?: boolean;
      space?: number;
      style?: ISymbolMarkSpec;
    };
    background?: {
      visible?: boolean;
      style?: IRectMarkSpec;
    };
  };
  
  // Background configuration
  background?: {
    visible?: boolean;
    padding?: IPadding | number | number[];
    style?: IRectMarkSpec;
  };
  
  // Discrete legend specific
  data?: (data: LegendItemDatum[], colorScale: IBaseScale, globalScale: IGlobalScale) => LegendItemDatum[];
  item?: {
    align?: 'left' | 'right';
    background?: {
      visible?: boolean;
      style?: IRectMarkSpec;
      state?: {
        selected?: IRectMarkSpec;
        unSelected?: IRectMarkSpec;
        selectedHover?: IRectMarkSpec;
        unSelectedHover?: IRectMarkSpec;
      };
    };
    shape?: {
      visible?: boolean;
      space?: number;
      style?: ISymbolMarkSpec;
      state?: {
        selected?: ISymbolMarkSpec;
        unSelected?: ISymbolMarkSpec;
        selectedHover?: ISymbolMarkSpec;
        unSelectedHover?: ISymbolMarkSpec;
      };
    };
    label?: {
      widthRatio?: number;
      space?: number;
      formatMethod?: (text: string | number, item: LegendItemDatum, index: number) => any;
      formatter?: string;
      style?: ITextMarkSpec;
      state?: {
        selected?: ITextMarkSpec;
        unSelected?: ITextMarkSpec;
        selectedHover?: ITextMarkSpec;
        unSelectedHover?: ITextMarkSpec;
      };
    };
    value?: {
      widthRatio?: number;
      space?: number;
      alignRight?: boolean;
      formatMethod?: (text: string | number, item: LegendItemDatum, index: number) => any;
      formatter?: string | string[];
      style?: ITextMarkSpec;
      state?: {
        selected?: ITextMarkSpec;
        unSelected?: ITextMarkSpec;
        selectedHover?: ITextMarkSpec;
        unSelectedHover?: ITextMarkSpec;
      };
    };
    maxWidth?: number | string;
    width?: number | string;
    height?: number | string;
    autoEllipsisStrategy?: 'labelFirst' | 'valueFirst' | 'none';
  };
  pager?: {
    textStyle?: ITextMarkSpec;
    handler?: {
      space?: number;
      preShape?: string;
      nextShape?: string;
      style?: ISymbolMarkSpec;
      state?: {
        hover?: ISymbolMarkSpec;
        disable?: ISymbolMarkSpec;
      };
    };
  } | {
    type: 'scrollbar';
    railStyle?: IRectMarkSpec;
    sliderStyle?: IRectMarkSpec;
  };
  scale?: string;
  scaleName?: string;
  field?: string;
  defaultSelected?: string[];
  
  // Continuous legend specific (color/size)
  inverse?: boolean;
  slidable?: boolean;
  rail?: {
    width?: number;
    height?: number;
    style?: IRectMarkSpec;
  };
  handler?: {
    visible?: boolean;
    style?: ISymbolMarkSpec;
  };
  track?: {
    style?: IRectMarkSpec;
  };
  startText?: {
    visible?: boolean;
    text?: string | number;
    space?: number;
    style?: ITextMarkSpec;
  };
  endText?: {
    visible?: boolean;
    text?: string | number;
    space?: number;
    style?: ITextMarkSpec;
  };
  handlerText?: {
    visible?: boolean;
    precision?: number;
    formatter?: (text: string | number) => string | number;
    space?: number;
    style?: ITextMarkSpec | ((value: string | number, position: 'start' | 'end', context: {
      layout?: 'horizontal' | 'vertical' | string;
      align?: 'top' | 'bottom' | 'left' | 'right';
      railWidth: number;
      railHeight: number;
      handlerSize?: number;
      slidable?: boolean;
    }) => ITextMarkSpec | undefined);
  };
  
  // Size legend specific
  sizeBackground?: IRectMarkSpec;
  align?: 'top' | 'bottom' | 'left' | 'right';
}
```

## Usage Examples

### Basic Discrete Legend
```typescript
const discreteLegend: ILegendSpec = {
  type: 'discrete',
  visible: true,
  orient: 'right',
  position: 'middle'
};
```

### Styled Discrete Legend with Items
```typescript
const styledDiscreteLegend: ILegendSpec = {
  type: 'discrete',
  orient: 'top',
  layout: 'horizontal',
  title: {
    textStyle: {
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#333'
    }
  },
  item: {
    align: 'left',
    shape: {
      visible: true,
      space: 8,
      style: {
        size: 10
      }
    },
    label: {
      space: 6,
      style: {
        fontSize: 12,
        fill: '#666'
      }
    }
  }
};
```

### Color Legend for Continuous Data
```typescript
const colorLegend: ILegendSpec = {
  type: 'color',
  orient: 'bottom',
  field: 'temperature',
  scale: 'temperatureScale',
  defaultSelected: [20, 80],
  rail: {
    width: 200,
    height: 20,
    style: {
      fill: 'linear-gradient(90deg, blue, red)'
    }
  },
  handler: {
    visible: true,
    style: {
      fill: '#fff',
      stroke: '#333',
      size: 12
    }
  }
};
```

### Size Legend with Custom Text
```typescript
const sizeLegend: ILegendSpec = {
  type: 'size',
  orient: 'right',
  field: 'population',
  align: 'left',
  startText: {
    visible: true,
    text: 'Small',
    style: {
      fontSize: 10,
      fill: '#999'
    }
  },
  endText: {
    visible: true,
    text: 'Large',
    style: {
      fontSize: 10,
      fill: '#999'
    }
  },
  handlerText: {
    visible: true,
    precision: 0,
    formatter: (value) => `${value}K`,
    style: (value, position) => ({
      dx: position === 'start' ? -6 : 6,
      fill: Number(value) > 50 ? '#d03050' : '#666'
    })
  }
};
```

### Legend with Pagination
```typescript
const paginatedLegend: ILegendSpec = {
  type: 'discrete',
  orient: 'bottom',
  layout: 'horizontal',
  pager: {
    textStyle: {
      fontSize: 12,
      fill: '#666'
    },
    handler: {
      space: 8,
      style: {
        size: 12,
        fill: '#007acc'
      },
      state: {
        hover: {
          fill: '#005a9e'
        },
        disable: {
          fill: '#ccc'
        }
      }
    }
  }
};
```

### Legend with Scrollbar
```typescript
const scrollableLegend: ILegendSpec = {
  type: 'discrete',
  orient: 'right',
  pager: {
    type: 'scrollbar',
    railStyle: {
      fill: '#f0f0f0',
      cornerRadius: 3
    },
    sliderStyle: {
      fill: '#007acc',
      cornerRadius: 3
    }
  }
};
```

## Chart Integration Examples

### Bar Chart with Discrete Legend
```typescript
const barChart = {
  type: 'bar',
  data: { values: data },
  xField: 'category',
  yField: 'value',
  seriesField: 'series',
  legends: {
    visible: true,
    orient: 'top',
    item: {
      shape: {
        style: {
          symbolType: 'rect'
        }
      }
    }
  }
};
```

### Heatmap with Color Legend
```typescript
const heatmap = {
  type: 'heatmap',
  data: { values: data },
  xField: 'x',
  yField: 'y',
  valueField: 'value',
  legends: {
    type: 'color',
    orient: 'right',
    field: 'value',
    rail: {
      width: 20,
      height: 200
    }
  }
};
```

### Scatter Plot with Size Legend
```typescript
const scatterPlot = {
  type: 'scatter',
  data: { values: data },
  xField: 'x',
  yField: 'y',
  sizeField: 'size',
  legends: {
    type: 'size',
    orient: 'bottom',
    field: 'size',
    align: 'top'
  }
};
```

### Multi-Legend Configuration
```typescript
const multiLegendChart = {
  type: 'scatter',
  data: { values: data },
  legends: [
    {
      type: 'discrete',
      orient: 'top',
      field: 'category'
    },
    {
      type: 'color',
      orient: 'right',
      field: 'temperature'
    },
    {
      type: 'size',
      orient: 'bottom',
      field: 'population'
    }
  ]
};
```
