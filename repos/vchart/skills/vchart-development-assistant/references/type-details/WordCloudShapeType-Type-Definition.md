```typescript
type WordCloudShapeType =
  | 'triangleForward'
  | 'triangle'
  | 'diamond'
  | 'square'
  | 'star'
  | 'cardioid'
  | 'circle'
  | 'pentagon'
  | 'rect';
```

## Type Composition

`WordCloudShapeType` is a union of string literal types derived from the keys of the `shapes` object. Based on the available shape constants and documentation, the type includes these predefined shape names:

- `'triangleForward'` - Right arrow shape
- `'triangle'` - Triangle shape
- `'diamond'` - Diamond shape
- `'square'` - Square shape
- `'star'` - Star shape
- `'cardioid'` - Heart shape
- `'circle'` - Circle shape
- `'pentagon'` - Pentagon shape
- `'rect'` - Rectangle shape
