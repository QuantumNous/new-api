{{ target: graphic-dom-attributes }}

#${prefix} id(string)

Sets the `id` of the DOM node. When the id changes, the old node is completely unloaded.

#${prefix} pointerEvents(string|boolean) = false

Whether to block pointer events, default is `false`.

#${prefix} container(string|HTMLElement)
The HTML container to mount.

#${prefix} width(number)
Width of the node.

#${prefix} height(number)
Height of the node.

#${prefix} style(string|object|function)
The style of the node. Supports style strings or objects.
Supports style strings, style objects, and callback functions, where the type definition of the callback function is as follows:

```ts
(pos: { top: number; left: number; width: number; height: number }, graphic: IGraphic, wrapContainer: HTMLElement) =>
  Record<string, any>;
```

#${prefix} visible(boolean) = true
Whether the node is visible.

#${prefix} anchorType(string) = 'boundsLeftTop'

Node layout alignment options are supported as follows:

- `position`: Positioned based on the main graphic element's location (`x`, `y`)
- `boundsLeftTop`: Positioned at the top-left corner of the main graphic's bounding box
- `top`: Positioned at the top of the main graphic's bounding box
- `bottom`: Positioned at the bottom of the main graphic's bounding box
- `left`: Positioned at the left side of the main graphic's bounding box
- `right`: Positioned at the right side of the main graphic's bounding box
- `top-left`: Positioned at the top-left corner of the main graphic's bounding box
- `top-right`: Positioned at the top-right corner of the main graphic's bounding box
- `bottom-left`: Positioned at the bottom-left corner of the main graphic's bounding box
- `bottom-right`: Positioned at the bottom-right corner of the main graphic's bounding box
- `center`: Positioned at the center of the main graphic's bounding box

When the main graphic element is `text`, the default positioning method is `position`. For `text` elements with `position` as the positioning method, the calculation of the position will consider the alignment and matrix transformations of the `text` element, which are then synchronized to the outer container of the DOM node.
For DOM nodes, we calculate the positioning of the outer container of the DOM node based on the aforementioned methods. The DOM node can then adjust its final position through styling adjustments based on the calculated position.
