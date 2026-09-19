## Core Type Structure

```typescript
interface ISeriesSpec extends IInteractionSpec {
  type: SeriesType; // Required series type
  name?: string; // Series display name
  id?: StringOrNumber; // User-defined series ID

  // Data configuration
  data?: IDataType; // Series-specific data
  dataIndex?: number; // Chart data index reference
  dataId?: StringOrNumber; // Chart data ID reference
  dataKey?: DataKeyType; // Data-mark binding key

  // Layout and association
  regionIndex?: number; // Associated region index
  regionId?: StringOrNumber; // Associated region ID
  seriesField?: string; // Grouping field
  seriesStyle?: ISeriesStyle; // Series styling configuration

  // Data processing
  stack?: boolean; // Enable stacking
  stackValue?: StringOrNumber; // Stack grouping value
  totalLabel?: ITotalLabelSpec; // Stack total labels
  percent?: boolean; // Percentage processing
  stackOffsetSilhouette?: boolean; // Center-axis offset
  invalidType?: IInvalidType; // Invalid data handling

  // Visual and interaction
  tooltip?: ISeriesTooltipSpec; // Series tooltip configuration
  animation?: boolean; // Animation enable/disable
  animationThreshold?: number; // Animation auto-disable threshold
  support3d?: boolean; // 3D perspective support
  morph?: IMorphSeriesSpec; // Morph animation configuration
  extensionMark?: (IExtensionMarkSpec<Exclude<EnableMarkType, 'group'>> | IExtensionGroupMarkSpec)[];
  zIndex?: number; // Layer order (series config only)
}
```

## Interaction Configuration (Extended)

```typescript
interface IInteractionSpec {
  hover?: IHoverSpec | boolean; // Hover interaction configuration
  select?: ISelectSpec | boolean; // Selection interaction configuration
  interactions?: IInteractionItemSpec[]; // Custom interaction configurations
}
```

## Series Types

```typescript
type SeriesType = keyof typeof SeriesTypeEnum | string;

enum SeriesTypeEnum {
  // Basic chart types
  area = 'area', // Area chart
  line = 'line', // Line chart
  bar = 'bar', // Bar/column chart
  scatter = 'scatter', // Scatter plot
  pie = 'pie', // Pie chart

  // Range charts
  rangeColumn = 'rangeColumn', // Range column chart
  rangeArea = 'rangeArea', // Range area chart

  // Specialized charts
  radar = 'radar', // Radar chart
  rose = 'rose', // Rose chart
  funnel = 'funnel', // Funnel chart
  waterfall = 'waterfall', // Waterfall chart
  heatmap = 'heatmap', // Heat map
  boxPlot = 'boxPlot', // Box plot

  // Progress charts
  circularProgress = 'circularProgress', // Circular progress
  linearProgress = 'linearProgress', // Linear progress
  gauge = 'gauge', // Gauge chart
  gaugePointer = 'gaugePointer', // Gauge pointer
  liquid = 'liquid', // Liquid fill gauge

  // Hierarchical charts
  treemap = 'treemap', // Tree map
  sunburst = 'sunburst', // Sunburst chart
  circlePacking = 'circlePacking', // Circle packing

  // Network and flow charts
  sankey = 'sankey', // Sankey diagram
  link = 'link', // Link chart

  // Specialized visualizations
  wordCloud = 'wordCloud', // Word cloud
  correlation = 'correlation', // Correlation matrix
  venn = 'venn', // Venn diagram
  mosaic = 'mosaic', // Mosaic chart
  pictogram = 'pictogram', // Pictogram chart

  // Geographic charts
  geo = 'geo', // Geographic series
  map = 'map', // Map chart
  dot = 'dot' // Dot map
}
```

## Data Configuration

### Data Sources

```typescript
// Series-specific data
data?: IDataType;  // IDataValues | DataView

// Reference chart data
dataIndex?: number;        // Index of chart.data array (default: 0)
dataId?: StringOrNumber;   // ID of chart.data source

// Data-mark binding
dataKey?: DataKeyType;     // string | string[] | ((data: Datum, index: number) => string)
```

### Invalid Data Handling

```typescript
type IInvalidType = 'break' | 'link' | 'zero' | 'ignore';

// 'break' - Break connection at invalid points
// 'link'  - Ignore invalid points, maintain continuity
// 'zero'  - Treat invalid points as zero values
// 'ignore' - No special handling
```

## Layout and Association

### Region Association

```typescript
regionIndex?: number;          // Associated region index (default: 0)
regionId?: StringOrNumber;     // Associated region ID
```

### Series Grouping

```typescript
seriesField?: string;          // Field for series grouping
seriesStyle?: ISeriesStyle;    // Styling for grouped series
```

## Data Processing Configuration

### Stacking

```typescript
stack?: boolean;                    // Enable data stacking
stackValue?: StringOrNumber;        // Stack group identifier
stackOffsetSilhouette?: boolean;    // Center-axis offset for stacking
totalLabel?: ITotalLabelSpec;       // Labels for stack totals
```

### Percentage Processing

```typescript
percent?: boolean;  // Convert values to percentages
```

## Animation Configuration

```typescript
animation?: boolean;                // Enable/disable series animation
animationThreshold?: number;        // Auto-disable threshold for data length
morph?: IMorphSeriesSpec;          // Morph animation between chart types
```

## Extension Marks

```typescript
extensionMark?: (IExtensionMarkSpec<Exclude<EnableMarkType, 'group'>> | IExtensionGroupMarkSpec)[];

// Available mark types: symbol, rule, line, text, rect, image, path, area, arc, polygon, boxPlot, linkPath, ripple
```

## Helper Types

### Data Key Configuration

```typescript
type DataKeyType =
  | string // Single field name
  | string[] // Multiple field names
  | ((data: Datum, index: number) => string); // Dynamic key function
```

### String or Number Union

```typescript
type StringOrNumber = string | number;
```

## Usage Examples

### Basic Line Series

```typescript
const lineSeries: ISeriesSpec = {
  type: 'line',
  name: 'Sales Trend',
  dataIndex: 0,
  dataKey: 'id',
  regionIndex: 0,
  animation: true,
  invalidType: 'break'
};
```

### Stacked Bar Series

```typescript
const stackedBar: ISeriesSpec = {
  type: 'bar',
  name: 'Revenue by Quarter',
  data: { values: quarterlyData },
  stack: true,
  stackValue: 'revenue',
  totalLabel: {
    visible: true,
    position: 'top'
  },
  seriesField: 'quarter'
};
```

### Grouped Series with Custom Styling

```typescript
const groupedSeries: ISeriesSpec = {
  type: 'bar',
  name: 'Sales by Region',
  dataIndex: 0,
  seriesField: 'region',
  seriesStyle: {
    normal: {
      fill: (datum, context) => context.seriesColor(datum.region)
    },
    hover: {
      stroke: '#000',
      strokeWidth: 2
    }
  }
};
```

### Series with Extension Marks

```typescript
const seriesWithMarks: ISeriesSpec = {
  type: 'line',
  name: 'Temperature',
  dataIndex: 0,
  extensionMark: [
    {
      type: 'symbol',
      dataIndex: 0,
      style: {
        fill: 'red',
        size: 8,
        symbolType: 'circle'
      }
    },
    {
      type: 'text',
      dataIndex: 0,
      style: {
        text: datum => `${datum.value}°C`,
        fontSize: 12,
        dy: -10
      }
    }
  ]
};
```

### Percentage Area Series

```typescript
const percentageArea: ISeriesSpec = {
  type: 'area',
  name: 'Market Share',
  dataIndex: 0,
  stack: true,
  percent: true,
  seriesField: 'company',
  animation: true,
  animationThreshold: 5000
};
```

### Series with Custom Data Key

```typescript
const customKeySeries: ISeriesSpec = {
  type: 'scatter',
  name: 'Customer Analysis',
  data: { values: customerData },
  dataKey: (data, index) => `${data.customerId}-${data.timestamp}`,
  tooltip: {
    visible: true,
    mark: {
      content: {
        key: datum => datum.customerName,
        value: datum => `Revenue: ${datum.revenue}`
      }
    }
  }
};
```

### 3D Series Configuration

```typescript
const series3D: ISeriesSpec = {
  type: 'bar',
  name: '3D Sales Data',
  dataIndex: 0,
  support3d: true,
  animation: true,
  zIndex: 10
};
```

### Radar Series with Interaction

```typescript
const radarSeries: ISeriesSpec = {
  type: 'radar',
  name: 'Performance Metrics',
  dataIndex: 0,
  seriesField: 'department',
  hover: {
    enable: true,
    highlightPolicy: 'single'
  },
  select: {
    enable: true,
    mode: 'single'
  },
  animation: {
    appear: {
      duration: 1000,
      easing: 'cubicOut'
    }
  }
};
```

### Morph Animation Series

```typescript
const morphSeries: ISeriesSpec = {
  type: 'bar',
  name: 'Dynamic Chart',
  dataIndex: 0,
  morph: {
    enable: true,
    morphKey: 'category',
    duration: 1000
  },
  animation: true
};
```
