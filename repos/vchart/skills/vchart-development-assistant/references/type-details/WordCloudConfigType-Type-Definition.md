## Interface Definition

```typescript
export type WordCloudConfigType = {
  /** Text overflow handling strategy for canvas boundaries */
  drawOutOfBound?: DrawOutOfBoundType;
  /** Ellipsis text configuration */
  ellipsis?: EllipsisType;
  /** Layout mode for word cloud rendering */
  layoutMode?: 'fast' | 'grid' | 'default';
  /** Adaptive scaling configuration */
  zoomToFit: ZoomToFitType;
  /** Progressive rendering configuration - layout time */
  progressiveTime?: number;
  /** Progressive rendering configuration - layout steps */
  progressiveStep?: number;
};
```

## Related Types

### DrawOutOfBoundType

Union type for text overflow handling strategies:

```typescript
type DrawOutOfBoundType = 'clip' | 'hidden' | 'ellipsis';
```

- **`'clip'`** - Draw overflow text and clip parts exceeding canvas
- **`'hidden'`** - Do not draw overflow text
- **`'ellipsis'`** - Draw overflow text with user-specified ellipsis replacement

### EllipsisType

Configuration for ellipsis text replacement:

```typescript
type EllipsisType = {
  /** Replacement string for overflow text */
  string?: string;
  /** Length limit for text truncation */
  limitLength?: number;
};
```

- **`string`** - Replacement text for overflow content (default: `'...'`)
- **`limitLength`** - Character limit beyond which ellipsis is applied

### ZoomToFitType

Configuration for adaptive font size scaling:

```typescript
type ZoomToFitType = {
  /** Whether to repeat scaling attempts */
  repeat?: boolean;
  /** Whether to allow font size reduction */
  shrink?: boolean;
  /** Whether to allow font size enlargement */
  enlarge?: boolean;
  /** Minimum font size when shrinking */
  fontSizeLimitMin?: number;
  /** Maximum font size when enlarging */
  fontSizeLimitMax?: number;
};
```
