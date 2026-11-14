## Overview
`IData` defines the data configuration interface for VChart components. It supports multiple data sources including arrays of data values, DataView instances, and combinations thereof.

## Core Type Structure

```typescript
type IData = IDataType | IDataType[];
type IDataType = IDataValues | DataView;
```

## Data Source Types

### 1. Single Data Source
```typescript
type IDataType = IDataValues | DataView;
```

### 2. Multiple Data Sources
```typescript
type IData = IDataType[];  // Array of data sources
```

## IDataValues Configuration

```typescript
interface IDataValues {
  id?: StringOrNumber;                    // Unique data identifier
  values: Datum[] | string;               // Data array or URL string
  fromDataIndex?: number;                 // Reference data index
  fromDataId?: StringOrNumber;            // Reference data ID
  transforms?: BuildInTransformOptions[]; // Data transformation configuration
  fields?: Record<string, IFieldsMeta>;   // Field metadata configuration
  parser?: SheetParseOptions | CommonParseOptions; // Data parser configuration
}
```

### Core Properties
- **id**: Unique identifier for the data source
- **values**: The actual data (array of objects) or URL string for remote data
- **fromDataIndex/fromDataId**: Reference to other data sources for data sharing
- **transforms**: Array of data transformation operations
- **fields**: Field-specific metadata and configurations
- **parser**: Data parsing options for different formats

## Field Metadata Configuration

```typescript
interface IFieldsMeta {
  alias?: string;                        // Field display name
  domain?: StringOrNumber[];             // Field value range
  lockStatisticsByDomain?: boolean | 'onlyFull'; // Lock domain for statistics
  type?: 'ordinal' | 'linear';          // Field data type
  sortIndex?: number;                    // Sort priority index
  sortReverse?: boolean;                 // Reverse sort order
  sort?: 'desc' | 'asc';                // Simple sort configuration
}
```

### Field Properties
- **alias**: Display name for the field in legends, labels, etc.
- **domain**: Predefined value range for the field
- **lockStatisticsByDomain**: Controls domain locking behavior in interactions
- **type**: Specifies whether field is categorical ('ordinal') or continuous ('linear')
- **sortIndex**: Priority for multi-field sorting (lower numbers sort first)
- **sortReverse**: Whether to reverse the sort order
- **sort**: Simplified sort configuration ('asc'/'desc')

## Data Transformation Options

```typescript
type BuildInTransformOptions =
  | { type: 'simplify'; options: ISimplifyOptions; }     // Geographic data simplification
  | { type: 'fields'; options: IFieldsOptions; }        // Field processing (sort, filter, reverse)
  | { type: 'filter'; options: IFilterOptions; }        // Custom filtering with callbacks
  | { type: 'fold'; options: IFoldOptions; };           // Data folding/reshaping
```

### Transform Types
- **simplify**: Reduces geographic data complexity for performance
- **fields**: Handles field-level operations like sorting and filtering
- **filter**: Applies custom filtering logic via callbacks
- **fold**: Reshapes data structure (wide to long format conversion)

## Data Parser Configuration

### Sheet Parser (CSV/TSV/DSV)
```typescript
interface SheetParseOptions extends CommonParseOptions {
  type: 'csv' | 'dsv' | 'tsv';          // File format type
  options?: IDsvParserOptions;           // Format-specific parsing options
}
```

### Common Parser Options
```typescript
interface CommonParseOptions {
  clone?: boolean;                       // Whether to clone data (default: true)
}
```

### Parser Properties
- **type**: Specifies the file format for parsing
- **options**: Format-specific parsing configurations
- **clone**: Controls whether data is cloned to prevent mutations

## Helper Types

### Data Key Configuration
```typescript
type DataKeyType = string | string[] | ((data: Datum, index: number) => string);
```

### Datum Type
```typescript
type Datum = Record<string, any>;      // Individual data record
```

### String or Number Union
```typescript
type StringOrNumber = string | number;
```

## Usage Examples

### Simple Array Data
```typescript
const data: IData = {
  values: [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 },
    { category: 'C', value: 15 }
  ]
};
```

### Data with Field Metadata
```typescript
const data: IData = {
  id: 'sales-data',
  values: [
    { month: 'Jan', sales: 1000, region: 'North' },
    { month: 'Feb', sales: 1200, region: 'South' }
  ],
  fields: {
    month: {
      type: 'ordinal',
      alias: 'Month'
    },
    sales: {
      type: 'linear',
      alias: 'Sales Amount',
      domain: [0, 2000]
    },
    region: {
      type: 'ordinal',
      sort: 'asc'
    }
  }
};
```

### Data with Transformations
```typescript
const data: IData = {
  values: [
    { name: 'Product A', Q1: 100, Q2: 120, Q3: 110, Q4: 130 },
    { name: 'Product B', Q1: 80, Q2: 90, Q3: 95, Q4: 105 }
  ],
  transforms: [
    {
      type: 'fold',
      options: {
        fields: ['Q1', 'Q2', 'Q3', 'Q4'],
        key: 'quarter',
        value: 'sales'
      }
    },
    {
      type: 'filter',
      options: {
        callback: (datum) => datum.sales > 100
      }
    }
  ]
};
```

### CSV Data with Parser
```typescript
const data: IData = {
  values: 'https://example.com/data.csv',
  parser: {
    type: 'csv',
    options: {
      delimiter: ',',
      header: true
    }
  }
};
```

### Multiple Data Sources
```typescript
const data: IData = [
  {
    id: 'source1',
    values: [{ x: 1, y: 10 }, { x: 2, y: 20 }]
  },
  {
    id: 'source2',
    values: [{ x: 1, z: 5 }, { x: 2, z: 15 }]
  }
];
```

### Referenced Data
```typescript
const data: IData = [
  {
    id: 'main',
    values: [
      { category: 'A', value: 100 },
      { category: 'B', value: 200 }
    ]
  },
  {
    id: 'filtered',
    fromDataId: 'main',
    transforms: [
      {
        type: 'filter',
        options: {
          callback: (datum) => datum.value > 150
        }
      }
    ]
  }
];
```

## DataView Integration

When using DataView instances directly:
```typescript
import { DataView } from '@visactor/vdataset';

const dataView = new DataView();
dataView.parse([
  { category: 'A', value: 10 },
  { category: 'B', value: 20 }
]);

const data: IData = dataView;
```

## Best Practices

1. **Use unique IDs** for data sources when working with multiple datasets
2. **Configure field metadata** for better chart behavior and user experience
3. **Apply transformations** to shape data appropriately for visualization
4. **Set appropriate field types** ('ordinal' vs 'linear') for correct scale handling
5. **Use data references** to avoid duplication and maintain consistency
6. **Enable cloning** (default) unless performance is critical and data mutation is acceptable
