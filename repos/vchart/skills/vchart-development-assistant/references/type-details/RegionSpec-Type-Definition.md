## Union Type Structure

```typescript
type RegionSpec = IRegionSpec | IGeoRegionSpec;
```

## Base Region Specification

```typescript
interface IRegionSpec extends ILayoutItemSpec {
  id?: StringOrNumber; // Region identifier
  coordinate?: CoordinateType; // Coordinate system type
  style?: ConvertToMarkStyleSpec<IRectMarkSpec>; // Region background styling
  stackInverse?: boolean; // Stack order inversion (default: false)
  stackSort?: boolean; // Stack sorting (default: false)
}
```

## Geographic Region Specification

```typescript
interface IGeoRegionSpec extends IRegionSpec {
  coordinate?: 'geo'; // Geographic coordinate system
  roam?: boolean | { blank?: boolean }; // Drag interaction configuration
  longitudeField?: string; // Longitude field name in data
  latitudeField?: string; // Latitude field name in data
  projection?: Partial<Omit<IProjectionSpec, 'name'>>; // Geographic projection config
  zoomLimit?: {
    // Zoom constraints
    min?: number; // Minimum zoom level
    max?: number; // Maximum zoom level
  };
}
```

## Layout Item Specification (Inherited)

```typescript
interface ILayoutItemSpec {
  // Layout type and positioning
  layoutType?: 'region-relative' | 'absolute' | 'normal';
  layoutLevel?: number; // Layout priority level
  layoutBindRegionID?: number | number[]; // Bound region IDs

  // Orientation and alignment
  orient?: 'left' | 'right' | 'top' | 'bottom';
  alignSelf?: 'start' | 'end' | 'middle';

  // Size constraints
  width?: ILayoutNumber; // Width specification
  height?: ILayoutNumber; // Height specification
  maxWidth?: ILayoutNumber; // Maximum width
  minWidth?: ILayoutNumber; // Minimum width
  maxHeight?: ILayoutNumber; // Maximum height
  minHeight?: ILayoutNumber; // Minimum height

  // Spacing and positioning
  padding?: ILayoutPaddingSpec; // Internal padding
  offsetX?: ILayoutNumber; // X-axis offset
  offsetY?: ILayoutNumber; // Y-axis offset

  // Absolute positioning (when layoutType === 'absolute')
  left?: ILayoutNumber; // Distance from left edge
  right?: ILayoutNumber; // Distance from right edge
  top?: ILayoutNumber; // Distance from top edge
  bottom?: ILayoutNumber; // Distance from bottom edge
  center?: boolean; // Center positioning

  // Display properties
  zIndex?: number; // Display layer level
  clip?: boolean; // Content clipping
}
```

## Supporting Type Definitions

### Coordinate System Types

```typescript
type CoordinateType = 'cartesian' | 'polar' | 'geo' | 'none';
```

### Layout Number Types

```typescript
type ILayoutNumber = number | string | ((chartViewRect: ILayoutRect) => number);
```

### Layout Padding Types

```typescript
type ILayoutPaddingSpec =
  | number // Single value for all sides
  | number[] // Array [top, right, bottom, left]
  | {
      // Object format
      left?: ILayoutNumber;
      right?: ILayoutNumber;
      top?: ILayoutNumber;
      bottom?: ILayoutNumber;
    };
```

### Geographic Projection Types

```typescript
interface IProjectionSpec {
  name: string; // Projection name
  type: ProjectionType; // Projection algorithm
  zoom?: number; // Initial zoom level (default: 1)
  center?: [number, number]; // Initial focus coordinates [lng, lat]
}

type ProjectionType =
  | 'albers'
  | 'albersUsa'
  | 'azimuthalEqualArea'
  | 'azimuthalEquidistant'
  | 'conic'
  | 'conicConformal'
  | 'conicEqualArea'
  | 'conicEquidistant'
  | 'equalEarth'
  | 'equirectangular'
  | 'gnomonic'
  | 'identity'
  | 'mercator'
  | 'naturalEarth1'
  | 'orthographic'
  | 'stereographic'
  | 'transverseMercator';
```

## Usage Examples

### Basic Cartesian Region

```typescript
const basicRegion: RegionSpec = {
  id: 'main-region',
  coordinate: 'cartesian',
  padding: { left: 50, right: 50, top: 30, bottom: 60 }
};
```

### Geographic Region with Projection

```typescript
const geoRegion: RegionSpec = {
  id: 'world-map',
  coordinate: 'geo',
  roam: true,
  projection: {
    type: 'mercator',
    zoom: 1,
    center: [0, 0]
  },
  zoomLimit: {
    min: 0.5,
    max: 10
  }
};
```

### Stacked Series Region

```typescript
const stackedRegion: RegionSpec = {
  id: 'stack-region',
  coordinate: 'cartesian',
  stackInverse: true,
  stackSort: true,
  style: {
    fill: '#f0f0f0',
    stroke: '#ddd'
  }
};
```

### Responsive Region with Percentage

```typescript
const responsiveRegion: RegionSpec = {
  id: 'responsive-region',
  coordinate: 'cartesian',
  width: '80%',
  height: '60%',
  padding: [20, 40, 20, 40],
  center: true
};
```

### Polar Coordinate Region

```typescript
const polarRegion: RegionSpec = {
  id: 'polar-chart',
  coordinate: 'polar',
  width: 400,
  height: 400,
  padding: 50
};
```

## Chart Integration Examples

### Multi-Region Layout

```typescript
const multiRegionChart = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 2
  },
  region: [
    {
      id: 'region-0',
      coordinate: 'cartesian',
      col: 0,
      row: 0
    },
    {
      id: 'region-1',
      coordinate: 'cartesian',
      col: 1,
      row: 0
    },
    {
      id: 'geo-region',
      coordinate: 'geo',
      col: 0,
      row: 1,
      colSpan: 2,
      projection: {
        type: 'naturalEarth1'
      }
    }
  ]
};
```

### Geographic Chart with Data Fields

```typescript
const geoChart = {
  type: 'map',
  region: {
    coordinate: 'geo',
    roam: { blank: true },
    longitudeField: 'lng',
    latitudeField: 'lat',
    projection: {
      type: 'albers',
      center: [104, 38],
      zoom: 1.2
    },
    zoomLimit: {
      min: 0.8,
      max: 5
    }
  }
};
```

### Region with Custom Styling

```typescript
const styledRegion: RegionSpec = {
  id: 'styled-region',
  coordinate: 'cartesian',
  style: {
    fill: 'linear-gradient(90deg, #ff6b6b, #4ecdc4)',
    stroke: '#333',
    strokeWidth: 2,
    cornerRadius: 8
  },
  padding: { left: 60, right: 40, top: 40, bottom: 80 },
  clip: true
};
```
