# GeometricMaskShape Type Definition

## Interface Definition

```typescript
export interface GeometricMaskShape {
  /** Specifies shape cloud generation based on geometric shape */
  type: 'geometric';
  /** 
   * Geometric shape type, supports:
   * - 'triangleForward': Right arrow
   * - 'triangle': Triangle
   * - 'diamond': Diamond
   * - 'square': Square
   * - 'star': Star
   * - 'cardioid': Heart
   * - 'circle': Circle
   * - 'pentagon': Pentagon
   * - 'rect': Rectangle
   */
  shape: string;
  /** Whether to create hollow shape, filling only background area */
  hollow?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Fill color */
  fill?: string;
}
```

`GeometricMaskShape` is an interface for creating word cloud shapes based on predefined geometric forms. When used, it automatically creates a shape word cloud where the text layout conforms to the outline of the specified geometric shape.

## Type Properties

### Required Properties

- **`type`** - `'geometric'`
  - Type discriminator that specifies geometric shape-based generation
  - Must be set to `'geometric'` to indicate geometric shape mask

- **`shape`** - `string`
  - Specifies the geometric shape type for the outline
  - Accepts predefined shape names from the supported geometric shapes
  - See GeometricShapeType for available values

### Optional Properties

- **`hollow`** - `boolean` (optional)
  - Controls whether to create a hollow shape
  - When `true`, only fills the background area, leaving the shape outline empty
  - When `false` or undefined, fills the entire geometric shape

- **`backgroundColor`** - `string` (optional)
  - Background color for the geometric shape
  - Applied to the area behind the shape outline
  - Accepts any valid CSS color string

- **`fill`** - `string` (optional)
  - Fill color for the geometric shape outline
  - Applied to the shape outline area when not hollow
  - Accepts any valid CSS color string

## Supported Geometric Shapes

The `shape` property accepts the following predefined geometric shape types:

- **`'triangleForward'`** - Right arrow shape
- **`'triangle'`** - Triangle shape
- **`'diamond'`** - Diamond shape
- **`'square'`** - Square shape
- **`'star'`** - Star shape
- **`'cardioid'`** - Heart shape
- **`'circle'`** - Circle shape
- **`'pentagon'`** - Pentagon shape
- **`'rect'`** - Rectangle shape (supported since version 1.9.3)

## Usage Context

`GeometricMaskShape` is used as part of a union type for the `maskShape` property in word cloud series:

```typescript
maskShape?: string | WordCloudShapeType | TextShapeMask | GeometricMaskShape;
```

When a `GeometricMaskShape` object is provided as `maskShape`, the word cloud automatically switches to shape word cloud mode, where words are arranged to fill the outline of the specified geometric shape.

## Related Types

### WordCloudShapeType
Type for predefined shape names:

```typescript
type WordCloudShapeType = keyof typeof shapes;
```

Includes the same shape names as supported by GeometricMaskShape.

### TextShapeMask
Interface for text-based word cloud masks:

```typescript
interface TextShapeMask {
  type: 'text';
  text: string;
  hollow?: boolean;
  backgroundColor?: string;
  fill?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fontVariant?: string;
}
```

### GeometricShapeType
Union type representing available geometric shape names:

```typescript
type GeometricShapeType = 
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

## Shape Configuration

### Hollow vs Filled Shapes
- **Hollow shapes** (`hollow: true`): Only the background area is filled, creating an outline effect
- **Filled shapes** (`hollow: false`): The entire shape area is filled with words

### Color Configuration
- **backgroundColor**: Controls the color behind the shape outline
- **fill**: Controls the color of the shape outline itself
- Both properties accept standard CSS color values (hex, rgb, rgba, named colors)

## Dependencies

- `@visactor/vlayouts` - External layout library providing the GeometricMaskShape interface
- VChart word cloud series interfaces for complete mask shape configuration
- Predefined geometric shape constants for shape validation
