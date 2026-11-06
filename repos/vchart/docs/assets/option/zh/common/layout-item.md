{{ target: common-layout-item }}

<!-- ILayoutItemSpec -->

#${prefix} layoutType(string) = ${defaultLayoutType}

当前模块的布局类型，配置为 `absolute` 的话，当前元素会以图表左上角为原点进行绝对布局。

目前支持的布局类型如下：

- `'region'`: 图表的绘图区域，一般只有 region 模块为这个类型
- `'region-relative'`: 与 region 位置相关的模块，比如轴，datazoom 等，多个同方向的模块不会重叠
- `'region-relative-overlap'`: 自 `1.8.8` 版本开始支持，与 region 位置相关的模块使用重叠布局，可以通过这个配置将多个坐标轴重叠在一起
- `'normal'`: 普通占位元素，比如图例，标题等
- `'normal-inline'`: 行内占位元素，用于多个图例并排展示场景等
- `'absolute'`: 绝对布局元素，比如 tooltip，markline 等

#${prefix} layoutLevel(number) = ${defaultLayoutLevel}

布局顺序等级，等级越大的，越优先布局，比如顶部同时有标题和图例的场景，期望标题先放在顶部，然后放置图例。

{{ if: !${noOrient} & !${isRegion} }}
#${prefix} orient(string)

模块布局位置。可选位置：

- 'left'
- 'top'
- 'right'
- 'bottom'

{{ /if }}

{{ if: !${isRegion} }}

#${prefix} alignSelf('start' | 'end' | 'middle') = 'start'

从 1.8.9 版本开始支持，

对于布局类型为`normal-inline`的元素，设置行内元素的对齐方式:

- 顶部的元素，'start' - 顶部对齐；'end' - '底部对齐'; 'middle' - 居中对齐
- 底部的元素，'start' - 底部对齐；'end' - '顶部对齐'; 'middle' - 居中对齐
- 左侧的元素，'start' - 左侧对齐；'end' - '右侧对齐'; 'middle' - 居中对齐
- 右侧的元素，'start' - 右侧对齐；'end' - '左侧对齐'; 'middle' - 居中对齐

{{ /if }}

#${prefix} padding(ILayoutNumber|Array|Object) = 0

模块的布局间距配置（上下左右四个方向），支持非对象配置、数组配置与对象配置。

非对象配置时，配置值会同时应用到上下左右四个方向，属性如下:

{{ use: common-layout-number }}

数组配置时，数组每一项都支持 ILayoutNumber ，使用示例:

```ts
padding: [5]; // 上右下左内边距均为 5px
padding: ['10%']; // 上下内边距为相对 图表视图区域 高的 10%，左右内边距为相对 图表视图区域 宽的 10%
padding: [5, 10]; // 上下内边距为 5px，左右内边距为 10px
padding: [
  5, // 上内边距为 5px
  '10%', // 左右内边距为相对 图表视图区域 宽的 10%
  10 // 下内边距为 10px
];
padding: [
  5, // 上内边距为 5px，
  '10%', // 右内边距为相对 图表视图区域 宽的 10%，
  '5%', // 下内边距为相对 图表视图区域 高的 5%
  (rect: ILayoutRect) => rect.height * 0.1 + 10 // 左内边距为图表视图区域 高的 0.1 + 10
];
```

对象配置的属性如下：

{{ use: common-layout-padding(
  prefix = '#' + ${prefix}
) }}

使用示例:

```ts
padding: 10,   // 上右下左内边距均为 10px
padding: '10%' // 上右下左内边距均为相对 **图表视图区域** 宽高的 10%
padding: {
  top: 10, // 上方内边距 10px
  left: ({ width }) => width * 0.1, // 左方内边距为布局宽度的 0.1
  right: '10%' // 右方内边距为布局宽度的 0.1
}
```

#${prefix} noOuterPadding(boolean) = true

是否按照 orient 自动修改 padding，隐藏位于外侧的 padding。当设置为 true 时，组件会自动将外侧（即 orient 指定的方向）的 padding 设置为 0。目前只在组件上生效。

属性说明：

- 类型：`boolean`
- 默认值：`true`
- 依赖于 `orient` 属性，只有设置了 `orient` 并且组件支持该属性时才生效。
- 仅对组件有效，对其他布局元素无效。

使用场景：

- 当组件（如图例、标题、坐标轴等）贴近图表边缘时，通常希望外侧（orient 指定方向）的 padding 自动为 0，以节省空间并实现更好的视觉对齐。
- 需要最大化利用图表空间时。

使用示例：

```ts
const legendSpec = {
  type: 'legend',
  orient: 'right', // 图例位于右侧
  padding: [10, 10, 10, 10], // 上、右、下、左四个方向都有10px的内边距
  noOuterPadding: true // 自动将右侧padding设置为0
};
// 结果：实际生效的padding为 { top: 10, right: 0, bottom: 10, left: 10 }
```

效果对比：

- `noOuterPadding: false` 时，所有方向的 padding 都会保留。
- `noOuterPadding: true` 时，orient 指定方向的 padding 会被自动设置为 0。

注意事项：

- 该属性默认值为 `true`，通常无需显式配置，除非你希望保留外侧 padding。
- 依赖于 `orient`，未设置 `orient` 时该属性无效。
- 目前仅对组件生效。

#${prefix} width(ILayoutNumber)

模块的布局宽度配置。

{{ use: common-layout-number }}

#${prefix} minWidth(ILayoutNumber)

模块的最小布局宽度配置。当配置了 width 时，此配置无效。

{{ use: common-layout-number }}

#${prefix} maxWidth(ILayoutNumber)

模块的最大布局宽度配置。当配置了 width 时，此配置无效。

{{ use: common-layout-number }}

#${prefix} height(ILayoutNumber)

模块的布局高度配置。

{{ use: common-layout-number }}

#${prefix} minHeight(ILayoutNumber)

模块的最小布局宽度配置。当配置了 height 时，此配置无效。

{{ use: common-layout-number }}

#${prefix} maxHeight(ILayoutNumber)

模块的最大布局宽度配置。当配置了 height 时，此配置无效。

{{ use: common-layout-number }}

#${prefix} offsetX(ILayoutNumber)

模块的布局位置在 X 方向的偏移。

{{ use: common-layout-number }}

#${prefix} offsetY(ILayoutNumber)

模块的布局位置在 Y 方向的偏移。

{{ use: common-layout-number }}

#${prefix} zIndex(number) = ${defaultLayoutZIndex}

模块的展示层级，当 2 个模块重叠时，层级较大的展示在上方。

{{ if: !${noClip} | ${isRegion} }}
#${prefix} clip(boolean)

模块是否裁剪超出布局区域外的绘图内容 。

{{/if}}

{{ if: !${isRegion} }}
#${prefix} left(ILayoutNumber)

模块绝对布局下，与图表左侧的距离。注意**仅在 layoutType === 'absolute' 时生效**。

{{ use: common-layout-number }}

#${prefix} right(ILayoutNumber)

模块绝对布局下，与图表右侧的距离。注意**仅在 layoutType === 'absolute' 时生效**。

{{ use: common-layout-number }}

#${prefix} top(ILayoutNumber)

模块绝对布局下，与图表顶部的距离。注意**仅在 layoutType === 'absolute' 时生效**。

{{ use: common-layout-number }}

#${prefix} bottom(ILayoutNumber)

模块绝对布局下，与图表底部的距离。注意**仅在 layoutType === 'absolute' 时生效**。

{{ use: common-layout-number }}

#${prefix} center(boolean)

模块绝对布局下，元素将放置在图表的正中间。注意**仅在 layoutType === 'absolute' 时生效，同时将忽略 padding 属性**。
{{/if}}
