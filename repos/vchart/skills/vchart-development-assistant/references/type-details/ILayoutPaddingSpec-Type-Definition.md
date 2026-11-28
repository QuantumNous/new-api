## Overview

```typescript
type ILayoutPaddingSpec = ILayoutOrientPadding | ILayoutNumber | ILayoutNumber[];
```

## Padding Configuration Types

### 1. Directional Padding Object

```typescript
interface ILayoutOrientPadding {
  left?: ILayoutNumber; // Left padding
  right?: ILayoutNumber; // Right padding
  top?: ILayoutNumber; // Top padding
  bottom?: ILayoutNumber; // Bottom padding
}
```

### 2. Single Value Padding

```typescript
type ILayoutPaddingSpec = ILayoutNumber; // Applied to all directions
```

### 3. Array Padding

```typescript
type ILayoutPaddingSpec = ILayoutNumber[]; // CSS-style array format
```

## Layout Number Types

```typescript
type ILayoutNumber = number | IPercent | ((layoutRect: ILayoutRect) => number) | IPercentOffset;
```

### Number Value

```typescript
type ILayoutNumber = number; // Pixel value (e.g., 10, 20, 50)
```

### Percentage String

```typescript
type IPercent = `${number}%`; // Percentage string (e.g., "10%", "25%", "50%")
```

### Callback Function

```typescript
type ILayoutNumber = (layoutRect: ILayoutRect) => number;

interface ILayoutRect {
  width: number; // Available width
  height: number; // Available height
}
```

### Percent with Offset

```typescript
interface IPercentOffset {
  percent?: number; // Percentage value (0-1 range)
  offset?: number; // Pixel offset value
}
```

## Value Calculation Logic

### Percentage Calculation

- **String format**: `"25%"` means 25% of the container dimension
- **Object format**: `{ percent: 0.25 }` means 25% of the container dimension

### Combined Percentage and Offset

```typescript
{ percent: 0.5, offset: 10 }  // 50% of container + 10 pixels
{ percent: 0.2, offset: -5 }  // 20% of container - 5 pixels
```

### Callback Function Parameters

```typescript
(layoutRect: ILayoutRect) => {
  // layoutRect.width: available container width
  // layoutRect.height: available container height
  return layoutRect.width * 0.1; // 10% of width
};
```

## Array Format Specification

Following CSS padding array convention:

```typescript
// 1 value: [all]
[10][ // top: 10, right: 10, bottom: 10, left: 10
  // 2 values: [vertical, horizontal]
  (10, 20)
][ // top: 10, right: 20, bottom: 10, left: 20
  // 3 values: [top, horizontal, bottom]
  (10, 20, 30)
][ // top: 10, right: 20, bottom: 30, left: 20
  // 4 values: [top, right, bottom, left]
  (10, 20, 30, 40)
]; // top: 10, right: 20, bottom: 30, left: 40
```

## Usage Examples

### Simple Numeric Padding

```typescript
// Uniform padding of 10 pixels
const padding: ILayoutPaddingSpec = 10;

// Array format - top/bottom: 20px, left/right: 40px
const padding: ILayoutPaddingSpec = [20, 40];

// Array format - all four directions
const padding: ILayoutPaddingSpec = [10, 20, 30, 40];
```

### Directional Object Padding

```typescript
// Object format with specific directions
const padding: ILayoutPaddingSpec = {
  top: 20,
  right: 15,
  bottom: 25,
  left: 10
};

// Partial directional padding
const padding: ILayoutPaddingSpec = {
  top: 30,
  bottom: 20
  // left and right default to 0
};
```

### Percentage Padding

```typescript
// String percentage format
const padding: ILayoutPaddingSpec = {
  top: '10%', // 10% of container height
  left: '5%', // 5% of container width
  right: '5%',
  bottom: '15%'
};

// Mixed percentage and pixel values
const padding: ILayoutPaddingSpec = {
  top: '20%', // 20% of container
  bottom: 40 // 40 pixels
};
```

### Percentage with Offset

```typescript
// Percentage + offset object format
const padding: ILayoutPaddingSpec = {
  top: { percent: 0.1, offset: 5 }, // 10% + 5px
  bottom: { percent: 0.15, offset: -10 }, // 15% - 10px
  left: { percent: 0.05 }, // 5% + 0px
  right: { offset: 20 } // 0% + 20px
};
```

### Dynamic Callback Padding

```typescript
// Function-based dynamic padding
const padding: ILayoutPaddingSpec = {
  top: rect => rect.height * 0.1, // 10% of available height
  left: rect => Math.min(rect.width * 0.05, 50), // 5% of width, max 50px
  right: rect => (rect.width > 800 ? 40 : 20), // Responsive padding
  bottom: 30 // Fixed bottom padding
};

// Array with callback functions
const padding: ILayoutPaddingSpec = [
  rect => rect.height * 0.05, // top: 5% of height
  20, // right: 20px
  rect => rect.height * 0.1, // bottom: 10% of height
  15 // left: 15px
];
```

### Complex Mixed Examples

```typescript
// Complex chart title padding
const titlePadding: ILayoutPaddingSpec = {
  top: '5%',
  bottom: { percent: 0.03, offset: 10 },
  left: rect => (rect.width > 600 ? 40 : 20),
  right: rect => (rect.width > 600 ? 40 : 20)
};

// Legend padding with responsive behavior
const legendPadding: ILayoutPaddingSpec = [
  '2%', // top: 2%
  rect => rect.width * 0.02, // right: 2% of width
  { percent: 0.02, offset: 5 }, // bottom: 2% + 5px
  10 // left: 10px
];
```
