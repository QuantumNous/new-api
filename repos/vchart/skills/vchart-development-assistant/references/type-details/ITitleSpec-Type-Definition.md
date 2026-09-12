## Union Type Structure

```typescript
type ITitleSpec = ITitleSpecWithoutText & ITitleTextSpec & ISubTitleTextSpec;
```

## Base Title Specification

```typescript
interface ITitleSpecWithoutText extends Omit<IComponentSpec, 'orient'> {
  visible?: boolean; // Title visibility (default: true)
  orient?: IOrientType; // Title position (default: 'top')
  x?: number; // X coordinate in pixels
  y?: number; // Y coordinate in pixels
  width?: number; // Title width in pixels
  height?: number; // Title height in pixels
  minWidth?: number; // Minimum width constraint
  maxWidth?: number; // Maximum width (auto-ellipsis)
  minHeight?: number; // Minimum height constraint
  maxHeight?: number; // Maximum height constraint
  innerPadding?: IPadding | number | number[]; // Internal padding
  align?: string; // Horizontal alignment ('left' | 'center' | 'right')
  verticalAlign?: string; // Vertical alignment ('top' | 'middle' | 'bottom')
  textStyle?: ITitleTextStyle; // Main title styling
  subtextStyle?: ISubtitleTextStyle; // Subtitle styling
}
```

## Text Content Configuration

### Main Title Text

```typescript
type ITitleTextSpec =
  | {
      textType?: 'text'; // Plain text mode (default)
      text: string | number | string[] | number[]; // Text content
    }
  | {
      textType: 'rich'; // Rich text mode
      text: IRichTextCharacter[]; // Rich text content
    };
```

### Subtitle Text

```typescript
type ISubTitleTextSpec =
  | {
      subtextType?: 'text'; // Plain text mode (default)
      subtext?: string | number | string[] | number[]; // Subtitle content
    }
  | {
      subtextType?: 'rich'; // Rich text mode
      subtext?: IRichTextCharacter[]; // Rich text subtitle content
    };
```

## Component Base (Inherited)

```typescript
interface IComponentSpec extends IModelSpec {
  regionIndex?: number | number[]; // Associated region indices
  regionId?: StringOrNumber | StringOrNumber[]; // Associated region IDs
  seriesIndex?: number | number[]; // Associated series indices
  seriesId?: StringOrNumber | StringOrNumber[]; // Associated series IDs
}
```

## Text Style Configuration

### Main Title Style

```typescript
interface ITitleTextStyle extends Partial<ITextGraphicAttribute> {
  width?: number; // Fixed width
  height?: number; // Fixed height
  align?: string; // Horizontal alignment
  verticalAlign?: string; // Vertical alignment
  wordBreak?: 'break-word' | 'break-all' | 'keep-all'; // Line breaking mode
  maxLineWidth?: number; // Width limit for auto-wrap/ellipsis
  heightLimit?: number; // Height limit for content display
  lineClamp?: number; // Maximum number of lines
  character?: IRichTextCharacter[]; // Rich text config (deprecated)
}
```

### Subtitle Style

```typescript
interface ISubtitleTextStyle extends Partial<ITextGraphicAttribute> {
  width?: number; // Fixed width
  height?: number; // Fixed height
  align?: string; // Horizontal alignment
  verticalAlign?: string; // Vertical alignment
  wordBreak?: 'break-word' | 'break-all' | 'keep-all'; // Line breaking mode
  maxLineWidth?: number; // Width limit for auto-wrap/ellipsis
  heightLimit?: number; // Height limit for content display
  lineClamp?: number; // Maximum number of lines
  character?: IRichTextCharacter[]; // Rich text config (deprecated)
}
```

## Supporting Type Definitions

### Orientation Types

```typescript
type IOrientType = 'left' | 'top' | 'right' | 'bottom' | 'z';
```

### Padding Types

```typescript
interface IPadding {
  top?: number; // Top padding
  bottom?: number; // Bottom padding
  left?: number; // Left padding
  right?: number; // Right padding
}

type PaddingSpec = IPadding | number | number[];
```

### Rich Text Character

```typescript
interface IRichTextCharacter {
  text?: string; // Character text content
  fontSize?: number; // Font size
  fontFamily?: string; // Font family
  fontWeight?: string | number; // Font weight
  fontStyle?: string; // Font style
  fill?: string; // Text color
  stroke?: string; // Text stroke color
  // ... other text attributes
}
```

## Complete Interface Definition

```typescript
interface ITitleSpec {
  // Component association
  regionIndex?: number | number[];
  regionId?: string | number | (string | number)[];
  seriesIndex?: number | number[];
  seriesId?: string | number | (string | number)[];

  // Basic properties
  visible?: boolean;
  orient?: 'left' | 'top' | 'right' | 'bottom' | 'z';

  // Positioning and sizing
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  // Spacing and alignment
  innerPadding?:
    | {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
      }
    | number
    | number[];
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';

  // Main title content (one of the following)
  textType?: 'text' | 'rich';
  text: string | number | string[] | number[] | IRichTextCharacter[];

  // Subtitle content (optional)
  subtextType?: 'text' | 'rich';
  subtext?: string | number | string[] | number[] | IRichTextCharacter[];

  // Main title styling
  textStyle?: {
    width?: number;
    height?: number;
    align?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    wordBreak?: 'break-word' | 'break-all' | 'keep-all';
    maxLineWidth?: number;
    heightLimit?: number;
    lineClamp?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    fill?: string;
    stroke?: string;
    // ... other ITextGraphicAttribute properties
  };

  // Subtitle styling
  subtextStyle?: {
    width?: number;
    height?: number;
    align?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    wordBreak?: 'break-word' | 'break-all' | 'keep-all';
    maxLineWidth?: number;
    heightLimit?: number;
    lineClamp?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    fill?: string;
    stroke?: string;
    // ... other ITextGraphicAttribute properties
  };
}
```

## Usage Examples

### Basic Title Configuration

```typescript
// Simple text title
const basicTitle: ITitleSpec = {
  visible: true,
  orient: 'top',
  text: 'Chart Title',
  textStyle: {
    fontSize: 18,
    fontWeight: 'bold',
    fill: '#333'
  }
};
```

### Title with Subtitle

```typescript
const titleWithSubtitle: ITitleSpec = {
  orient: 'top',
  text: 'Main Chart Title',
  subtext: 'Subtitle description',
  textStyle: {
    fontSize: 20,
    fontWeight: 'bold',
    fill: '#000'
  },
  subtextStyle: {
    fontSize: 14,
    fill: '#666'
  }
};
```

### Positioned Title

```typescript
const positionedTitle: ITitleSpec = {
  x: 100,
  y: 50,
  width: 300,
  text: 'Custom Positioned Title',
  align: 'center',
  textStyle: {
    fontSize: 16,
    maxLineWidth: 280
  }
};
```

### Rich Text Title

```typescript
const richTextTitle: ITitleSpec = {
  textType: 'rich',
  text: [
    { text: 'Sales ', fontSize: 18, fontWeight: 'bold', fill: '#000' },
    { text: 'Report', fontSize: 18, fontWeight: 'normal', fill: '#666' }
  ],
  orient: 'top'
};
```

### Responsive Title with Constraints

```typescript
const responsiveTitle: ITitleSpec = {
  text: 'Long Title That May Need Wrapping or Ellipsis',
  maxWidth: 400,
  textStyle: {
    fontSize: 16,
    maxLineWidth: 380,
    lineClamp: 2,
    wordBreak: 'break-word'
  },
  innerPadding: { left: 10, right: 10, top: 5, bottom: 5 }
};
```

### Multi-line Array Title

```typescript
const multiLineTitle: ITitleSpec = {
  text: ['Line 1 of Title', 'Line 2 of Title'],
  textStyle: {
    fontSize: 16,
    align: 'center',
    lineHeight: 1.5
  }
};
```

## Chart Integration Examples

### Bar Chart with Title

```typescript
const barChart = {
  type: 'bar',
  data: { values: data },
  title: {
    visible: true,
    text: 'Monthly Sales Data',
    orient: 'top',
    textStyle: {
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#2c3e50'
    }
  }
};
```

### Chart with Rich Text Title and Subtitle

```typescript
const chartWithRichTitle = {
  type: 'line',
  data: { values: data },
  title: {
    textType: 'rich',
    text: [
      { text: '2024 ', fontSize: 18, fontWeight: 'bold', fill: '#e74c3c' },
      { text: 'Performance Overview', fontSize: 18, fill: '#34495e' }
    ],
    subtextType: 'text',
    subtext: 'Quarterly revenue and growth metrics',
    subtextStyle: {
      fontSize: 12,
      fill: '#7f8c8d'
    }
  }
};
```

### Multiple Titles for Different Regions

```typescript
const multiRegionChart = {
  type: 'common',
  region: [{ id: 'region1' }, { id: 'region2' }],
  title: [
    {
      regionId: 'region1',
      text: 'Region 1 Title',
      orient: 'top'
    },
    {
      regionId: 'region2',
      text: 'Region 2 Title',
      orient: 'top'
    }
  ]
};
```
