## IIndicatorSpec Type Definition

### Core Interface

`IIndicatorSpec` defines the configuration interface for indicator card components in VChart, providing data display capabilities with customizable title, content, positioning, and interactive behaviors.

```typescript
interface IIndicatorSpec extends IComponentSpec {
  visible?: boolean;
  fixed?: boolean;
  trigger?: 'hover' | 'select' | 'none';
  gap?: number;                              // @deprecated
  offsetX?: number | IPercent;
  offsetY?: number | IPercent;
  limitRatio?: number;
  title?: IIndicatorItemSpec;
  content?: IIndicatorItemSpec[] | IIndicatorItemSpec;
}
```

### Type Structure

#### Base Interface Inheritance
```typescript
// Inherits from component specification
interface IIndicatorSpec extends IComponentSpec {
  // Common component properties inherited:
  // - id?: StringOrNumber
  // - zIndex?: number
  // - style?: any
  
  // Indicator-specific properties
  visible?: boolean;
  fixed?: boolean;
  trigger?: 'hover' | 'select' | 'none';
  offsetX?: number | IPercent;
  offsetY?: number | IPercent;
  limitRatio?: number;
  title?: IIndicatorItemSpec;
  content?: IIndicatorItemSpec[] | IIndicatorItemSpec;
}
```

#### Indicator Item Configuration
```typescript
interface IIndicatorItemSpec {
  visible?: boolean;                    // Show/hide item
  field?: string;                       // Data field binding
  space?: number;                       // Item spacing
  autoLimit?: boolean;                  // Auto text truncation
  autoFit?: boolean;                    // Auto text scaling
  fitPercent?: number;                  // Fit ratio (0-1)
  fitStrategy?: 'default' | 'inscribed'; // Fit strategy
  formatMethod?: FormatMethodFunction;   // Text formatting
  style?: IndicatorItemStyleSpec;       // Text styling
}

// Format method function signature
type FormatMethodFunction = (
  text: string | number,
  textStyle: ITextGraphicAttribute
) => IFormatMethod<[activeDatum: Datum]> | ITextMarkSpec['text'] | ReturnType<IFormatMethod<[activeDatum: Datum]>>;
```

#### Style Configuration
```typescript
// Indicator item style specification
type IndicatorItemStyleSpec = Omit<ConvertToMarkStyleSpec<ITextMarkSpec>, 'visible' | 'text'> & {
  type?: 'text' | 'rich';              // @deprecated Text type
  text?: TextContentSpec;              // Text content
};

// Text content specification types
type TextContentSpec = 
  | IFormatMethod<[activeDatum: Datum]>
  | ITextMarkSpec['text']
  | ReturnType<IFormatMethod<[activeDatum: Datum]>>;

// Mark style conversion (supports visual channels)
type ConvertToMarkStyleSpec<T> = {
  [key in keyof T]: VisualType<T[key]>;
};

// Visual type supporting values, functions, and visual channels
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
```

### Display and Behavior Control

#### Visibility and Display Mode
```typescript
// Basic visibility control
const basicIndicator: IIndicatorSpec = {
  visible: true,     // Show indicator (default: true)
  fixed: true,       // Always display (default: true)
};

// Interactive display mode
const interactiveIndicator: IIndicatorSpec = {
  visible: true,
  fixed: false,      // Show only on interaction
  trigger: 'hover'   // Show on hover
};

// Permanent display with no interaction
const staticIndicator: IIndicatorSpec = {
  visible: true,
  fixed: true,
  trigger: 'none'    // No interactive triggers
};
```

#### Trigger Configuration
```typescript
// Hover trigger (show on mouse over)
const hoverTrigger: IIndicatorSpec = {
  trigger: 'hover',  // Default: 'select'
  fixed: false
};

// Selection trigger (show on click/select)
const selectTrigger: IIndicatorSpec = {
  trigger: 'select',  // Default behavior
  fixed: false
};

// Disabled interaction
const noTrigger: IIndicatorSpec = {
  trigger: 'none',
  fixed: true        // Must be fixed when no trigger
};
```

### Positioning and Layout

#### Offset Configuration
```typescript
// Pixel-based positioning
const pixelOffset: IIndicatorSpec = {
  offsetX: 20,       // 20px from default position
  offsetY: -10,      // 10px above default position
};

// Percentage-based positioning
const percentOffset: IIndicatorSpec = {
  offsetX: "15%",    // 15% of container width
  offsetY: "5%",     // 5% of container height
};

// Mixed positioning
const mixedOffset: IIndicatorSpec = {
  offsetX: "50%",    // Center horizontally
  offsetY: 30,       // 30px from top
};
```

#### Size Limitation
```typescript
// Width ratio limitation
const limitedWidth: IIndicatorSpec = {
  limitRatio: 0.3,   // Maximum 30% of content area width
  title: { autoLimit: true },    // Enable text truncation
  content: { autoFit: true }     // Enable text scaling
};

// Responsive sizing
const responsiveSize: IIndicatorSpec = {
  limitRatio: 0.25,
  content: [{
    autoFit: true,
    fitPercent: 0.8,           // 80% of available space
    fitStrategy: 'inscribed'   // Inscribed fit strategy
  }]
};
```

### Title Configuration

#### Basic Title Setup
```typescript
// Simple title configuration
const basicTitle: IIndicatorSpec = {
  title: {
    visible: true,
    field: 'category',         // Bind to data field
    space: 8,                  // 8px spacing to content
    style: {
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#333'
    }
  }
};
```

#### Advanced Title Formatting
```typescript
// Custom title with formatting
const formattedTitle: IIndicatorSpec = {
  title: {
    visible: true,
    field: 'metric',
    formatMethod: (text, textStyle) => {
      return (datum) => `Metric: ${text.toUpperCase()}`;
    },
    style: {
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      fill: '#2c3e50',
      textAlign: 'center'
    }
  }
};
```

#### Title with Auto-Fitting
```typescript
// Responsive title with auto-fitting
const responsiveTitle: IIndicatorSpec = {
  title: {
    visible: true,
    autoFit: true,
    fitPercent: 0.6,           // 60% of available width
    fitStrategy: 'default',
    style: {
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#1a73e8'
    }
  }
};
```

### Content Configuration

#### Single Content Item
```typescript
// Single content configuration
const singleContent: IIndicatorSpec = {
  content: {
    visible: true,
    field: 'value',
    autoLimit: true,           // Auto truncate if too long
    style: {
      fontSize: 24,
      fontWeight: 'normal',
      fill: '#666'
    }
  }
};
```

#### Multiple Content Items
```typescript
// Multiple content items
const multipleContent: IIndicatorSpec = {
  content: [
    {
      visible: true,
      field: 'currentValue',
      space: 5,                // 5px spacing to next item
      style: {
        fontSize: 20,
        fill: '#27ae60'
      }
    },
    {
      visible: true,
      field: 'previousValue',
      formatMethod: (text) => (datum) => `(${text})`,
      style: {
        fontSize: 14,
        fill: '#95a5a6'
      }
    }
  ]
};
```

#### Content with Rich Formatting
```typescript
// Rich text content with complex formatting
const richContent: IIndicatorSpec = {
  content: {
    visible: true,
    field: 'sales',
    formatMethod: (text, textStyle) => {
      return (datum) => {
        const value = parseFloat(text as string);
        const formatted = value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        });
        return formatted;
      };
    },
    style: {
      type: 'text',            // @deprecated but still supported
      fontSize: 28,
      fontWeight: 'bold',
      fill: '#e74c3c'
    }
  }
};
```

### Spacing and Layout

#### Legacy Gap Configuration
```typescript
// Deprecated gap usage (still supported)
const legacySpacing: IIndicatorSpec = {
  gap: 10,                     // @deprecated: use title.space or content.space
  title: { visible: true },
  content: { visible: true }
};
```

#### Modern Spacing Configuration
```typescript
// Modern spacing with individual control
const modernSpacing: IIndicatorSpec = {
  title: {
    visible: true,
    space: 12,                 // 12px between title and content
    style: { fontSize: 14 }
  },
  content: [{
    visible: true,
    space: 8,                  // 8px between content items
    style: { fontSize: 16 }
  }, {
    visible: true,
    style: { fontSize: 16 }
  }]
};
```

### Auto-Fitting Strategies

#### Text Truncation Strategy
```typescript
// Auto-limit for text truncation
const truncationStrategy: IIndicatorSpec = {
  limitRatio: 0.4,
  content: {
    visible: true,
    autoLimit: true,           // Enable truncation
    field: 'longDescription',
    style: {
      fontSize: 12,
      fill: '#666'
    }
  }
};
```

#### Text Scaling Strategy
```typescript
// Auto-fit for text scaling
const scalingStrategy: IIndicatorSpec = {
  content: {
    visible: true,
    autoFit: true,             // Enable scaling
    fitPercent: 0.85,          // Use 85% of available space
    fitStrategy: 'inscribed',  // Fit within bounds
    style: {
      fontSize: 16,            // Base font size
      fill: '#333'
    }
  }
};
```

#### Combined Strategies
```typescript
// Combined auto-fitting approaches
const combinedStrategy: IIndicatorSpec = {
  limitRatio: 0.3,
  title: {
    visible: true,
    autoFit: true,
    fitPercent: 0.7,
    fitStrategy: 'default'
  },
  content: [{
    visible: true,
    autoLimit: true,           // Truncate if needed
    autoFit: true,             // Scale if possible
    fitPercent: 0.8,
    space: 6
  }]
};
```

### Advanced Formatting

#### Complex Format Methods
```typescript
// Advanced formatting with context awareness
const advancedFormatting: IIndicatorSpec = {
  content: {
    visible: true,
    field: 'percentage',
    formatMethod: (text, textStyle) => {
      return (datum, context) => {
        const value = parseFloat(text as string);
        const trend = datum.trend || 'neutral';
        const symbol = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
        return `${symbol} ${value.toFixed(1)}%`;
      };
    },
    style: {
      fontSize: 18,
      fontFamily: 'monospace'
    }
  }
};
```

#### Dynamic Style Based on Data
```typescript
// Data-driven styling
const dynamicStyling: IIndicatorSpec = {
  content: {
    visible: true,
    field: 'status',
    style: {
      fontSize: 16,
      fill: (datum) => {
        // Dynamic color based on data
        switch (datum.status) {
          case 'success': return '#27ae60';
          case 'warning': return '#f39c12';
          case 'error': return '#e74c3c';
          default: return '#666';
        }
      },
      fontWeight: (datum) => datum.important ? 'bold' : 'normal'
    }
  }
};
```

### Implementation Examples

#### Sales Dashboard Indicator
```typescript
// Sales performance indicator
const salesIndicator: IIndicatorSpec = {
  visible: true,
  trigger: 'select',
  offsetX: "10%",
  offsetY: 20,
  limitRatio: 0.25,
  
  title: {
    visible: true,
    field: 'region',
    space: 8,
    style: {
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#2c3e50'
    }
  },
  
  content: [
    {
      visible: true,
      field: 'sales',
      space: 4,
      formatMethod: (text) => (datum) => {
        const value = parseFloat(text as string);
        return value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0
        });
      },
      style: {
        fontSize: 20,
        fontWeight: 'bold',
        fill: '#27ae60'
      }
    },
    {
      visible: true,
      field: 'growth',
      formatMethod: (text) => (datum) => {
        const growth = parseFloat(text as string);
        const sign = growth >= 0 ? '+' : '';
        return `${sign}${growth.toFixed(1)}%`;
      },
      style: {
        fontSize: 14,
        fill: (datum) => datum.growth >= 0 ? '#27ae60' : '#e74c3c'
      }
    }
  ]
};
```

#### KPI Indicator with Auto-Fitting
```typescript
// KPI indicator with responsive design
const kpiIndicator: IIndicatorSpec = {
  visible: true,
  fixed: true,
  trigger: 'none',
  offsetX: "50%",
  offsetY: "10%",
  limitRatio: 0.4,
  
  title: {
    visible: true,
    autoFit: true,
    fitPercent: 0.8,
    style: {
      fontSize: 14,
      textAlign: 'center',
      fill: '#666'
    }
  },
  
  content: {
    visible: true,
    autoFit: true,
    fitPercent: 0.9,
    fitStrategy: 'inscribed',
    formatMethod: (text) => (datum) => {
      const value = parseFloat(text as string);
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toString();
    },
    style: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      fill: '#1a73e8'
    }
  }
};
```

#### Multi-Metric Indicator
```typescript
// Complex multi-metric indicator
const multiMetricIndicator: IIndicatorSpec = {
  visible: true,
  trigger: 'hover',
  fixed: false,
  offsetX: 15,
  offsetY: -5,
  limitRatio: 0.35,
  
  title: {
    visible: true,
    space: 10,
    style: {
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#2c3e50',
      textAlign: 'left'
    }
  },
  
  content: [
    {
      visible: true,
      field: 'primaryMetric',
      space: 6,
      autoLimit: true,
      style: {
        fontSize: 18,
        fontWeight: 'bold',
        fill: '#3498db'
      }
    },
    {
      visible: true,
      field: 'secondaryMetric',
      space: 4,
      style: {
        fontSize: 14,
        fill: '#7f8c8d'
      }
    },
    {
      visible: true,
      field: 'change',
      formatMethod: (text) => (datum) => {
        const change = parseFloat(text as string);
        const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '●';
        return `${arrow} ${Math.abs(change).toFixed(1)}%`;
      },
      style: {
        fontSize: 12,
        fill: (datum) => {
          const change = datum.change;
          return change > 0 ? '#27ae60' : change < 0 ? '#e74c3c' : '#95a5a6';
        }
      }
    }
  ]
};
```

### Chart Integration

#### Bar Chart with Indicator
```typescript
// Bar chart with data indicator
const chartWithIndicator = {
  type: 'bar',
  data: { values: chartData },
  xField: 'category',
  yField: 'value',
  
  // Indicator configuration
  indicator: {
    visible: true,
    trigger: 'hover',
    offsetX: 10,
    offsetY: -10,
    
    title: {
      visible: true,
      field: 'category'
    },
    
    content: {
      visible: true,
      field: 'value',
      formatMethod: (text) => (datum) => `Value: ${text}`
    }
  } as IIndicatorSpec
};
```

#### Multi-Series Chart Integration
```typescript
// Multi-series chart with comprehensive indicator
const multiSeriesChart = {
  type: 'line',
  data: { values: timeSeriesData },
  xField: 'date',
  yField: 'value',
  seriesField: 'series',
  
  indicator: {
    visible: true,
    trigger: 'select',
    fixed: false,
    limitRatio: 0.3,
    
    title: {
      visible: true,
      formatMethod: (text) => (datum) => `${datum.series} - ${datum.date}`
    },
    
    content: [
      {
        visible: true,
        field: 'value',
        space: 5,
        formatMethod: (text) => (datum) => `Current: ${text}`
      },
      {
        visible: true,
        field: 'previousValue',
        formatMethod: (text) => (datum) => `Previous: ${text || 'N/A'}`
      }
    ]
  } as IIndicatorSpec
};
```

### Type Safety and Validation

#### Type-Safe Indicator Builder
```typescript
// Type-safe indicator configuration builder
function createIndicator(
  options: {
    titleField?: string;
    contentField?: string | string[];
    trigger?: IIndicatorSpec['trigger'];
    offset?: { x?: number | IPercent; y?: number | IPercent };
  }
): IIndicatorSpec {
  return {
    visible: true,
    trigger: options.trigger || 'select',
    offsetX: options.offset?.x || 0,
    offsetY: options.offset?.y || 0,
    
    title: options.titleField ? {
      visible: true,
      field: options.titleField
    } : undefined,
    
    content: Array.isArray(options.contentField) 
      ? options.contentField.map(field => ({ visible: true, field }))
      : options.contentField ? { visible: true, field: options.contentField }
      : undefined
  };
}

// Usage with validation
const validatedIndicator = createIndicator({
  titleField: 'category',
  contentField: ['value', 'percentage'],
  trigger: 'hover',
  offset: { x: "10%", y: 20 }
});
```

#### Content Type Validation
```typescript
// Validate content configuration type
function validateIndicatorContent(
  content: IIndicatorSpec['content']
): content is NonNullable<IIndicatorSpec['content']> {
  if (!content) return false;
  
  if (Array.isArray(content)) {
    return content.every(item => typeof item === 'object' && item !== null);
  }
  
  return typeof content === 'object' && content !== null;
}

// Type-safe content access
const safeContent: Required<Pick<IIndicatorSpec, 'content'>> = {
  content: { visible: true, field: 'value' }
};
```
