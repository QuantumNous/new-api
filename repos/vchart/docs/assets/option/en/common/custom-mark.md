{{ target: common-custom-mark }}

<!-- ICustomMarkSpec -->

## customMark(Array)

Custom marks are a user-customizable interface for drawing arbitrary content on charts. Currently supported graphical types are as follows:

- `symbol` Point shape
- `rule` A line segment that requires specifying the start and end points
- `text` Text
- `rect` Rectangle
- `path` Path
- `arc` Sector
- `polygon` Polygon
- `image` Image
- `group` Group, allows other marks to be placed within the group

Note: Layout-related configuration is supported since version `1.11.0`

## customMark.symbol(Object)

Graphical type `symbol`

### type(string) = "symbol"

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-symbol(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.rule(Object)

Graphical type `rule`

### type(string) = "rule"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-rule(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.text(Object)

Graphical type `text`

### type(string) = "text"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-text(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.rect(Object)

Graphical type `rect`

### type(string) = "rect"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-rect(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.path(Object)

Graphical type `path`

### type(string) = "path"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-path(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.arc(Object)

Graphical type `arc`

### type(string) = "arc"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-arc(
  prefix = '###',
  markType = 'arc'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.polygon(Object)

Graphical type `polygon`

### type(string) = "polygon"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-polygon(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.image(Object)

Graphical type `image`

### type(string) = "image"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-image(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.group(Object)

Graphical type `group`

### type(string) = "group"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### children(Array)

Group acts as a special mark. It allows for new marks to be configured within the group's children section

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
