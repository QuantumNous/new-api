## Overview
`ISeriesStyle` defines the styling configuration for grouped series in VChart. It allows customization of visual styles for different series groups based on the `seriesField` value, enabling distinct styling for each category within the same chart.

## Core Type Structure

```typescript
type ISeriesStyle = ISeriesStyleItem[];
```

## Series Style Item Configuration

```typescript
interface ISeriesStyleItem {
  name: string;                                 // Series group name (matches seriesField value)
  [markName: string]: {                        // Mark-specific styling configuration
    style?: any;                               // Visual style properties for the mark
  };
}
```

## Expanded Type Definition

```typescript
// Flattened for better AI understanding
interface ISeriesStyleItem {
  name: string;                                 // Required: series group identifier
  
  // Mark-specific style configurations (all optional)
  point?: { style?: ISymbolMarkSpec; };         // Point/symbol mark styling
  line?: { style?: ILineMarkSpec; };            // Line mark styling
  area?: { style?: IAreaMarkSpec; };            // Area mark styling
  bar?: { style?: IRectMarkSpec; };             // Bar/rectangle mark styling
  label?: { style?: ITextMarkSpec; };           // Label text styling
  [customMarkName: string]: { style?: any; };  // Custom mark styling
}
```

## Mark Style Properties

### Symbol/Point Mark Styling
```typescript
interface ISymbolMarkSpec {
  fill?: string;                               // Fill color
  stroke?: string;                             // Border color
  strokeWidth?: number;                        // Border width
  size?: number;                               // Symbol size
  symbolType?: string;                         // Symbol shape (circle, square, triangle, etc.)
  fillOpacity?: number;                        // Fill transparency
  strokeOpacity?: number;                      // Border transparency
}
```

### Line Mark Styling
```typescript
interface ILineMarkSpec {
  stroke?: string;                             // Line color
  strokeWidth?: number;                        // Line width
  strokeOpacity?: number;                      // Line transparency
  lineDash?: number[];                         // Dash pattern
  curveType?: string;                          // Curve interpolation type
}
```

### Area Mark Styling
```typescript
interface IAreaMarkSpec {
  fill?: string;                               // Fill color
  fillOpacity?: number;                        // Fill transparency
  stroke?: string;                             // Border color
  strokeWidth?: number;                        // Border width
  curveType?: string;                          // Curve interpolation type
}
```

### Rectangle/Bar Mark Styling
```typescript
interface IRectMarkSpec {
  fill?: string;                               // Fill color
  stroke?: string;                             // Border color
  strokeWidth?: number;                        // Border width
  fillOpacity?: number;                        // Fill transparency
  strokeOpacity?: number;                      // Border transparency
  cornerRadius?: number | number[];            // Corner radius
}
```

### Text/Label Mark Styling
```typescript
interface ITextMarkSpec {
  fill?: string;                               // Text color
  fontSize?: number;                           // Font size
  fontFamily?: string;                         // Font family
  fontWeight?: string | number;                // Font weight
  textAlign?: string;                          // Horizontal alignment
  textBaseline?: string;                       // Vertical alignment
}
```

## Usage Examples

### Basic Series Styling
```typescript
const seriesStyle: ISeriesStyle = [
  {
    name: 'Desktop',
    point: {
      style: {
        fill: '#1f77b4',
        size: 8,
        symbolType: 'circle'
      }
    },
    line: {
      style: {
        stroke: '#1f77b4',
        strokeWidth: 2
      }
    }
  },
  {
    name: 'Mobile',
    point: {
      style: {
        fill: '#ff7f0e',
        size: 8,
        symbolType: 'square'
      }
    },
    line: {
      style: {
        stroke: '#ff7f0e',
        strokeWidth: 2,
        lineDash: [5, 5]
      }
    }
  }
];
```

### Bar Chart Series Styling
```typescript
const barSeriesStyle: ISeriesStyle = [
  {
    name: 'Q1',
    bar: {
      style: {
        fill: '#5470c6',
        stroke: '#4c63b6',
        strokeWidth: 1,
        cornerRadius: [4, 4, 0, 0]
      }
    },
    label: {
      style: {
        fill: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold'
      }
    }
  },
  {
    name: 'Q2',
    bar: {
      style: {
        fill: '#91cc75',
        stroke: '#82bb6a',
        strokeWidth: 1,
        cornerRadius: [4, 4, 0, 0]
      }
    },
    label: {
      style: {
        fill: '#333333',
        fontSize: 12,
        fontWeight: 'bold'
      }
    }
  }
];
```

### Area Chart Series Styling
```typescript
const areaSeriesStyle: ISeriesStyle = [
  {
    name: 'Revenue',
    area: {
      style: {
        fill: 'rgba(84, 112, 198, 0.3)',
        stroke: '#5470c6',
        strokeWidth: 2,
        curveType: 'monotone'
      }
    },
    point: {
      style: {
        fill: '#5470c6',
        size: 6,
        symbolType: 'circle'
      }
    }
  },
  {
    name: 'Profit',
    area: {
      style: {
        fill: 'rgba(145, 204, 117, 0.3)',
        stroke: '#91cc75',
        strokeWidth: 2,
        curveType: 'monotone'
      }
    },
    point: {
      style: {
        fill: '#91cc75',
        size: 6,
        symbolType: 'diamond'
      }
    }
  }
];
```

### Multi-Mark Series Styling
```typescript
const complexSeriesStyle: ISeriesStyle = [
  {
    name: 'Primary',
    bar: {
      style: {
        fill: '#1f77b4',
        fillOpacity: 0.8,
        stroke: '#0d5aa7',
        strokeWidth: 1
      }
    },
    label: {
      style: {
        fill: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center'
      }
    },
    point: {
      style: {
        fill: '#1f77b4',
        size: 5,
        symbolType: 'circle',
        stroke: '#ffffff',
        strokeWidth: 2
      }
    }
  },
  {
    name: 'Secondary',
    bar: {
      style: {
        fill: '#ff7f0e',
        fillOpacity: 0.8,
        stroke: '#e6670a',
        strokeWidth: 1
      }
    },
    label: {
      style: {
        fill: '#333333',
        fontSize: 11,
        fontWeight: 'normal',
        textAlign: 'center'
      }
    },
    point: {
      style: {
        fill: '#ff7f0e',
        size: 5,
        symbolType: 'triangle',
        stroke: '#ffffff',
        strokeWidth: 2
      }
    }
  }
];
```

### Custom Mark Styling
```typescript
const customMarkStyle: ISeriesStyle = [
  {
    name: 'Category A',
    customSymbol: {
      style: {
        fill: '#e74c3c',
        size: 10,
        symbolType: 'star'
      }
    },
    customLine: {
      style: {
        stroke: '#e74c3c',
        strokeWidth: 3,
        lineDash: [10, 5]
      }
    }
  },
  {
    name: 'Category B',
    customSymbol: {
      style: {
        fill: '#3498db',
        size: 10,
        symbolType: 'cross'
      }
    },
    customLine: {
      style: {
        stroke: '#3498db',
        strokeWidth: 3,
        lineDash: [5, 10]
      }
    }
  }
];
```

### Gradient and Advanced Styling
```typescript
const advancedSeriesStyle: ISeriesStyle = [
  {
    name: 'Gradient Series',
    bar: {
      style: {
        fill: {
          gradient: 'linear',
          x0: 0, y0: 0, x1: 0, y1: 1,
          stops: [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ]
        },
        stroke: '#4c63b6',
        strokeWidth: 1
      }
    },
    label: {
      style: {
        fill: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        textBaseline: 'middle'
      }
    }
  }
];
```

### Chart Configuration Integration
```typescript
// Usage in chart specification
const chartSpec = {
  type: 'line',
  data: { values: data },
  xField: 'date',
  yField: 'value',
  seriesField: 'category',        // Enables series grouping
  seriesStyle: [                  // Apply ISeriesStyle configuration
    {
      name: 'Desktop',
      line: {
        style: {
          stroke: '#1f77b4',
          strokeWidth: 2
        }
      },
      point: {
        style: {
          fill: '#1f77b4',
          size: 6
        }
      }
    },
    {
      name: 'Mobile',
      line: {
        style: {
          stroke: '#ff7f0e',
          strokeWidth: 2,
          lineDash: [5, 5]
        }
      },
      point: {
        style: {
          fill: '#ff7f0e',
          size: 6,
          symbolType: 'square'
        }
      }
    }
  ]
};
```

## Mark Name Reference

Common mark names that can be styled:
- `point` - Symbol/point marks
- `line` - Line marks
- `area` - Area marks
- `bar` - Rectangle/bar marks
- `label` - Text label marks
- Custom mark names as defined in series configuration

## Type Relationships

```typescript
// Series specification with style
interface ISeriesSpec {
  seriesField?: string;          // Field that creates groups
  seriesStyle?: ISeriesStyle;    // Styling for each group
  // ... other properties
}

// Chart specification with global series style
interface IChartSpec {
  seriesStyle?: ISeriesStyle;    // Global series styling
  // ... other properties
}
```
