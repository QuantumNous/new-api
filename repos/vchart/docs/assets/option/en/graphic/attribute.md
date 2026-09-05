{{ target: graphic-attribute }}

<!-- IAttribute Common Graphic Attributes -->

{{ if: !${noFill} }}
{{ use: graphic-fill-style(
  prefix = ${prefix}
) }}
{{ /if }}

{{ if: !${noStroke} }}
{{ use: graphic-stroke-style(
  prefix = ${prefix},
  markType = ${markType}
) }}
{{ /if }}

#${prefix} opacity(number)

Overall transparency setting.

#${prefix} cursor(string)

What is the cursor style when the mouse hovers over the graphic element? Same as CSS cursor.

{{ if: !${noTexture} }}

#${prefix} texture(string)

Texture type configuration, supports: `'circle' | 'diamond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid'`.

Example:

```ts
style: {
  texture: 'circle',
  texturePadding: 1,
  textureSize: 5,
  textureColor: 'red'
}
```

#${prefix} textureColor(string)

Texture color.

#${prefix} textureSize(number)

Size of the texture unit.

#${prefix} texturePadding(number)

Gap size between texture units.

{{ /if }}

#${prefix} pickable(boolean) = true

Whether to support event pick-up, default is true.

#${prefix} childrenPickable(boolean) = true

For group nodes, whether to support event pick-up of its child elements, default is true. If group `pickable` is off and `childrenPickable` is on, the child nodes of the group will still participate in event pick-up.

#${prefix} zIndex(number)

Display level configuration.

#${prefix} visible(boolean) = true

Whether the element is visible.

#${prefix} dx(number)

Offset in the x direction.

#${prefix} dy(number)

Offset in the y direction.

{{ if: !${noAngle} }}

#${prefix} angle(number)

Rotation angle.

{{ /if }}

#${prefix} scaleX(number) = 1
Scale ratio in the x direction.

#${prefix} scaleY(number) = 1
Scale ratio in the y direction.

#${prefix} scaleCenter([number|string, number|string])

Scale Center. Supported since version `1.4.0`.

Can be configured with fixed coordinates, such as [100, 100], or percentage coordinates, such as ['50%', '50%'], which represents scaling around the center of the graphic element.

#${prefix} pickStrokeBuffer(number) = 0

Supported since version `1.7.3`, it is used to expand the picking range of strokes. 0 is the default line width, positive numbers widen the width, and negative numbers widen the width.

#${prefix} boundsPadding(number|array)
Bounds padding of the graphic bounding box, default value is 0, supports two formats:

- number: set uniform padding for top, right, bottom, and left
- array: padding array, format `[top, right, bottom, left]`, sets padding for each of the four directions separately

#${prefix} html(object)
Supported since version `1.10.0`, used to configure the HTML overlay of the graphic element.

##${prefix} dom(string|HTMLElement)
DOM string or node.

{{ use: graphic-dom-attributes(
  prefix = ${prefix} + '#'
) }}
{{ /if }}

#${prefix} react(object)
Supported since version `1.11.0`, used to configure the React overlay of the graphic element.

##${prefix} element(Object)
React element

{{ use: graphic-dom-attributes(
  prefix = ${prefix} + '#'
) }}
{{ /if }}
