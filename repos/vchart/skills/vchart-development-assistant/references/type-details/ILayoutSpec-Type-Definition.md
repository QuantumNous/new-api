## Overview

```typescript
type ILayoutSpec = IBaseLayoutSpec | IGridLayoutSpec;
```

## Base Layout Specification

```typescript
interface IBaseLayoutSpec extends ILayoutSpecBase {
  type: 'base'; // Default layout type
}
```

## Grid Layout Specification

```typescript
interface IGridLayoutSpec extends ILayoutSpecBase {
  type: 'grid'; // Grid layout type
  col: number; // Total number of columns
  row: number; // Total number of rows
  colWidth?: ColumnWidthSpec[]; // Column width specifications
  rowHeight?: RowHeightSpec[]; // Row height specifications
  elements: ElementSpec[]; // Element positioning configuration
}
```

## Layout Specification Base

```typescript
interface ILayoutSpecBase {
  type: string; // Layout type identifier
}
```

## Element Positioning Configuration

```typescript
type ElementSpec = (
  | {
      modelKey: string; // Component spec key (e.g., 'legends')
      modelIndex: number; // Component index
    }
  | {
      modelId: string; // Component identifier
    }
) & {
  col: number; // Column position (0-based)
  colSpan?: number; // Column span (default: 1)
  row: number; // Row position (0-based)
  rowSpan?: number; // Row span (default: 1)
};
```

## Grid Size Configuration

### Column Width Specification

```typescript
interface ColumnWidthSpec {
  index: number; // Column index (0-based)
  size: number | ((maxSize: number) => number); // Width in pixels or function
}
```

### Row Height Specification

```typescript
interface RowHeightSpec {
  index: number; // Row index (0-based)
  size: number | ((maxSize: number) => number); // Height in pixels or function
}
```

## Complete Interface Definition

```typescript
interface ILayoutSpec {
  // Layout type
  type: 'base' | 'grid';

  // Grid layout specific properties (when type === 'grid')
  col?: number; // Total columns in grid
  row?: number; // Total rows in grid

  // Optional grid sizing
  colWidth?: {
    index: number; // Column index (0-based)
    size: number | ((maxSize: number) => number); // Column width
  }[];

  rowHeight?: {
    index: number; // Row index (0-based)
    size: number | ((maxSize: number) => number); // Row height
  }[];

  // Element positioning (grid layout only)
  elements?: {
    // Component identification (one of the following)
    modelKey?: string; // Component type (e.g., 'legends', 'axes')
    modelIndex?: number; // Component index within type
    modelId?: string; // Unique component identifier

    // Grid positioning
    col: number; // Column position (0-based)
    colSpan?: number; // Columns to span (default: 1)
    row: number; // Row position (0-based)
    rowSpan?: number; // Rows to span (default: 1)
  }[];
}
```

## Usage Examples

### Base Layout (Default)

```typescript
const baseLayout: ILayoutSpec = {
  type: 'base'
};
```

### Simple Grid Layout

```typescript
const simpleGrid: ILayoutSpec = {
  type: 'grid',
  col: 2,
  row: 2,
  elements: [
    {
      modelKey: 'legends',
      modelIndex: 0,
      col: 0,
      row: 0
    },
    {
      modelId: 'main-chart',
      col: 1,
      row: 0,
      colSpan: 1,
      rowSpan: 2
    }
  ]
};
```

### Grid with Custom Sizing

```typescript
const customSizedGrid: ILayoutSpec = {
  type: 'grid',
  col: 3,
  row: 2,
  colWidth: [
    { index: 0, size: 100 }, // First column: 100px
    { index: 2, size: 150 } // Third column: 150px
  ],
  rowHeight: [
    { index: 0, size: 80 }, // First row: 80px
    { index: 1, size: maxSize => maxSize - 100 } // Second row: remaining space minus 100px
  ],
  elements: [
    {
      modelKey: 'title',
      modelIndex: 0,
      col: 0,
      row: 0,
      colSpan: 3 // Span all 3 columns
    },
    {
      modelKey: 'legends',
      modelIndex: 0,
      col: 0,
      row: 1
    },
    {
      modelId: 'chart-region',
      col: 1,
      row: 1,
      colSpan: 2 // Span 2 columns
    }
  ]
};
```

### Dashboard-Style Layout

```typescript
const dashboardLayout: ILayoutSpec = {
  type: 'grid',
  col: 4,
  row: 3,
  colWidth: [
    { index: 0, size: 200 }, // Sidebar width
    { index: 1, size: maxSize => (maxSize - 200) / 3 },
    { index: 2, size: maxSize => (maxSize - 200) / 3 },
    { index: 3, size: maxSize => (maxSize - 200) / 3 }
  ],
  elements: [
    // Header
    {
      modelKey: 'title',
      modelIndex: 0,
      col: 0,
      row: 0,
      colSpan: 4
    },
    // Sidebar
    {
      modelKey: 'legends',
      modelIndex: 0,
      col: 0,
      row: 1,
      rowSpan: 2
    },
    // Chart grid
    {
      modelId: 'chart1',
      col: 1,
      row: 1
    },
    {
      modelId: 'chart2',
      col: 2,
      row: 1
    },
    {
      modelId: 'chart3',
      col: 3,
      row: 1
    },
    {
      modelId: 'chart4',
      col: 1,
      row: 2,
      colSpan: 2 // Span 2 columns
    },
    {
      modelId: 'chart5',
      col: 3,
      row: 2
    }
  ]
};
```

## Chart Integration Examples

### Multi-Chart Grid Layout

```typescript
const multiChartGrid = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 2,
    elements: [
      {
        modelKey: 'region',
        modelIndex: 0,
        col: 0,
        row: 0
      },
      {
        modelKey: 'region',
        modelIndex: 1,
        col: 1,
        row: 0
      },
      {
        modelKey: 'region',
        modelIndex: 2,
        col: 0,
        row: 1,
        colSpan: 2 // Full width bottom chart
      }
    ]
  },
  region: [{ id: 'region1' }, { id: 'region2' }, { id: 'region3' }]
};
```

### Layout with Shared Components

```typescript
const sharedComponentLayout = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 3,
    row: 3,
    rowHeight: [
      { index: 0, size: 60 }, // Title row
      { index: 2, size: 80 } // Legend row
    ],
    elements: [
      // Shared title
      {
        modelKey: 'title',
        modelIndex: 0,
        col: 0,
        row: 0,
        colSpan: 3
      },
      // Charts
      {
        modelKey: 'region',
        modelIndex: 0,
        col: 0,
        row: 1
      },
      {
        modelKey: 'region',
        modelIndex: 1,
        col: 1,
        row: 1
      },
      {
        modelKey: 'region',
        modelIndex: 2,
        col: 2,
        row: 1
      },
      // Shared legend
      {
        modelKey: 'legends',
        modelIndex: 0,
        col: 0,
        row: 2,
        colSpan: 3
      }
    ]
  }
};
```

### Responsive Grid Layout

```typescript
const responsiveLayout: ILayoutSpec = {
  type: 'grid',
  col: 2,
  row: 3,
  colWidth: [
    { index: 0, size: maxSize => Math.min(300, maxSize * 0.3) },
    { index: 1, size: maxSize => maxSize - Math.min(300, maxSize * 0.3) }
  ],
  rowHeight: [
    { index: 0, size: 60 }, // Fixed header
    { index: 1, size: maxSize => (maxSize - 140) * 0.7 }, // Main content
    { index: 2, size: 80 } // Fixed footer
  ],
  elements: [
    {
      modelKey: 'title',
      modelIndex: 0,
      col: 0,
      row: 0,
      colSpan: 2
    },
    {
      modelKey: 'legends',
      modelIndex: 0,
      col: 0,
      row: 1
    },
    {
      modelId: 'main-chart',
      col: 1,
      row: 1
    },
    {
      modelKey: 'dataZoom',
      modelIndex: 0,
      col: 0,
      row: 2,
      colSpan: 2
    }
  ]
};
```

## Layout Type Behaviors

### Base Layout (`type: 'base'`)

- Uses default positioning strategy
- Components positioned based on their `orient` property
- Automatic space allocation
- No explicit grid structure

### Grid Layout (`type: 'grid'`)

- Explicit grid-based positioning
- Precise control over component placement
- Support for spanning multiple cells
- Custom row/column sizing

## Element Identification Methods

### Model Key + Index

```typescript
{
  modelKey: 'legends',                 // Component type
  modelIndex: 0,                      // Index within type
  col: 0,
  row: 0
}
```

### Model ID

```typescript
{
  modelId: 'unique-component-id',      // Direct component reference
  col: 1,
  row: 0
}
```

## Size Configuration Options

### Fixed Size

```typescript
colWidth: [
  { index: 0, size: 200 } // Fixed 200px width
];
```

### Dynamic Size Function

```typescript
colWidth: [
  {
    index: 1,
    size: maxSize => maxSize * 0.6 // 60% of available space
  }
];
```

### Remaining Space Calculation

```typescript
colWidth: [
  { index: 0, size: 150 }, // Fixed 150px
  {
    index: 1,
    size: maxSize => maxSize - 150 // Remaining space
  }
];
```

## Grid Positioning Rules

### Column/Row Indexing

- Columns: 0-based indexing from left to right
- Rows: 0-based indexing from top to bottom

### Spanning Behavior

- `colSpan`: Number of columns the element occupies
- `rowSpan`: Number of rows the element occupies
- Default span is 1 for both dimensions

### Overlap Handling

- Elements can be positioned in overlapping cells
- Later-defined elements render on top
- Useful for layered components

## Common Layout Patterns

### Header-Content-Footer

```typescript
{
  type: 'grid',
  col: 1,
  row: 3,
  rowHeight: [
    { index: 0, size: 60 },            // Header
    { index: 2, size: 40 }             // Footer
  ]
}
```

### Sidebar-Main

```typescript
{
  type: 'grid',
  col: 2,
  row: 1,
  colWidth: [
    { index: 0, size: 200 }            // Sidebar
  ]
}
```

### Equal Grid

```typescript
{
  type: 'grid',
  col: 2,
  row: 2
  // No custom sizing = equal distribution
}
```
