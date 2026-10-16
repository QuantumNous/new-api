## ShapeType Type Definition

```typescript
type ShapeType =
  | 'circle' // Default shape for most components
  | 'square' // Square shape
  | 'rect' // Rectangle shape
  | 'triangle' // Triangle pointing up
  | 'diamond' // Diamond shape
  | 'star' // Five-pointed star
  | 'triangleUp' // Upward triangle
  | 'triangleDown' // Downward triangle
  | 'triangleLeft' // Left triangle
  | 'triangleRight' // Right triangle
  | 'triangleForward' // Forward triangle
  | 'cross' // Cross/plus shape
  | 'wye' // Y-shaped symbol
  | 'pentagon' // Pentagon shape
  | 'cardioid' // Heart-like shape
  | string; // Custom path or other symbols
```

## Usage Examples

```typescript
// Basic usage
const pointStyle = {
  symbolType: 'circle' as ShapeType,
  size: 10
};

// In chart configuration
const scatterChart = {
  point: {
    style: {
      shape: 'diamond' as ShapeType
    }
  }
};

// Shape style interface
const shapeConfig: IShapeStyle = {
  shape: 'star',
  size: 15
};
```
