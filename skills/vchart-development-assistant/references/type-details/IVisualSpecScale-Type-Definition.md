## Overview

```typescript
interface IVisualSpecScale {
  // Scale identity
  id?: string; // Scale unique identifier for global reference

  // Scale type
  type: 'ordinal' | 'linear'; // Scale mapping type

  // Data mapping
  domain: Array<any> | IDomainSpec[]; // Input data domain
  range: Array<any>; // Output visual range

  // Advanced options
  specified?: Record<string, any>; // Direct value mapping (ordinal only)
  clamp?: boolean; // Clamp output to range bounds (linear only) @default false @since 1.13.6
}

// Domain specification for data field mapping
interface IDomainSpec {
  dataId: string; // Data source identifier
  fields: string[]; // Data field names to extract domain from
}
```

## Scale Type Specifications

### Ordinal Scale

```typescript
interface IOrdinalScale extends IVisualSpecScale {
  type: 'ordinal';
  domain: Array<string | number> | IDomainSpec[]; // Discrete values
  range: Array<any>; // Corresponding visual values
  specified?: Record<string | number, any>; // Direct value overrides
}
```

### Linear Scale

```typescript
interface ILinearScale extends IVisualSpecScale {
  type: 'linear';
  domain: [number, number] | IDomainSpec[]; // Continuous numeric domain
  range: [number, number] | Array<string>; // Continuous output range
  clamp?: boolean; // Restrict output to range bounds @default false
}
```

## Use example

### Linear scale for bar

```javascript
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { name: 'atom_4', value: 33.33, success_count: 333, run_count: 1000 },
        { name: 'atom_3', value: 37.89, success_count: 379, run_count: 1000 },
        { name: 'atom_1', value: 45.67, success_count: 457, run_count: 1000 },
      ],
    },
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'barData',
        fields: ['success_count'],
      },
    ],
    range: ['red', 'green'],
    clamp: true,
  },
  bar: {
    style: {
      fill: {
        scale: 'color',
        field: 'success_count',
      },
    },
  },
};
```
