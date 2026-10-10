{{ target: graphic-dom-attributes }}

#${prefix} id(string)

设置 dom 节点对应的`id`，当 id 发生变化的时候，会完全卸载老的节点

#${prefix} pointerEvents(string|boolean) = false

是否阻止 pointer 事件，默认值为`false`

#${prefix} container(string|HTMLElement)
挂载的 HTML 容器。

#${prefix} width(number)
节点的宽度。

#${prefix} height(number)
节点的高度。

#${prefix} style(string|object|function)
节点的样式。支持样式字符串或对象。
支持样式字符串，样式对象，以及回调函数，其中回调函数的类型定义如下：

```ts
(pos: { top: number; left: number; width: number; height: number }, graphic: IGraphic, wrapContainer: HTMLElement) =>
  Record<string, any>;
```

#${prefix} visible(boolean) = true
是否显示节点。

#${prefix} anchorType(string) = 'boundsLeftTop'

节点布局对齐方式，支持如下配置：

- `position`: 根据主图元的位置（也就是 `x`, `y`）定位
- `boundsLeftTop`: 根据主图形包围盒的左上角定位
- `top`: 根据主图形包围盒的顶部定位
- `bottom`: 根据主图形包围盒的底部定位
- `left`: 根据主图形包围盒的左侧定位
- `right`: 根据主图形包围盒的右侧定位
- `top-left`: 根据主图形包围盒的左上角定位
- `top-right`: 根据主图形包围盒的右上角定位
- `bottom-left`: 根据主图形包围盒的左下角定位
- `bottom-right`: 根据主图形包围盒的右下角定位
- `center`: 根据主图形包围盒的中心定位

其中主图元为`text`的时候，默认值定位方式为`position`；对于主图元为`text`，并且定位方式为`position`的时候，计算定位会考虑`text`图元的对齐方式和矩阵变换，同步到 dom 节点的外层容器上；
对于 dom 节点而言，我们根据上诉定位方式计算 dom 节点外层容器的定位，dom 节点可以根据定位后的位置，通过样式微调最终定位效果；
