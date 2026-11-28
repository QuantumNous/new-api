```typescript
type LiquidShapeType =
  // All SymbolType values (same as ShapeType)
  | 'circle' // Default liquid mask shape
  | 'square'
  | 'rect'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'triangleUp'
  | 'triangleDown'
  | 'triangleLeft'
  | 'triangleRight'
  | 'triangleForward'
  | 'cross'
  | 'wye'
  | 'pentagon'
  | 'cardioid'
  // Liquid-specific shape
  | 'drop' // Water drop shape for liquid charts
  | string; // Custom shapes
```
