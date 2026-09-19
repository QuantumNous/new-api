{{ target: common-extension-mark }}

<!-- IExtensionMarkSpec -->

#${prefix} extensionMark(Array)

extension marks are a user-customizable interface for drawing arbitrary content on series. Currently supported graphical types are as follows:

- `symbol` Point shape
- `rule` A line segment that requires specifying the start and end points
- `text` Text
- `rect` Rectangle
- `path` Path
- `arc` Sector
- `polygon` Polygon
- `image` Image
- `group` Group, allows other marks to be placed within the group

#${prefix} extensionMark.symbol(Object)

Graphical type `symbol`

##${prefix} type(string) = "symbol"

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.rule(Object)

Graphical type `rule`

##${prefix} type(string) = "rule"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-rule(
 prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.text(Object)

Graphical type `text`

##${prefix} type(string) = "text"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.rect(Object)

Graphical type `rect`

##${prefix} type(string) = "rect"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.path(Object)

Graphical type `path`

##${prefix} type(string) = "path"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-path(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.arc(Object)

Graphical type `arc`

##${prefix} type(string) = "arc"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-arc(
  prefix = '##' + ${prefix},
  markType = 'arc'
) }}

#${prefix} extensionMark.polygon(Object)

Graphical type `polygon`

##${prefix} type(string) = "polygon"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-polygon(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.image(Object)

Graphical type `image`

##${prefix} type(string) = "image"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.group(Object)

Graphical type `group`

##${prefix} type(string) = "group"

Required configuration to specify the graphical type

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} children(Array)

Group acts as a special mark. It allows for new marks to be configured within the group's children section
