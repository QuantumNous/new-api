{{ target: series-image-cloud }}

<!-- IImageCloudSeriesSpec -->

**Image Cloud Series** is used to draw image cloud charts. **Only applicable to rectangular coordinate systems**.

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  noStack = true,
  useInChart = ${useInChart},
  seriesType = 'imageCloud',
  seriesMarks = ['image'],
  preset = 'scaleIn' + '|' + 'fadeIn' ,
  defaultPreset = 'fadeIn',
) }}

#${prefix} urlField(string)

Image URL field, required configuration.

#${prefix} nameField(string)

Text field.

#${prefix} valueField(string)

Weight field.

#${prefix} imageSize(number)

Image size.

#${prefix} imageSizeRange(Array)

Image size range.

Default value: [50, 50]

#${prefix} ratio(number)

The ratio of image size to canvas size.

When layoutType is 'spiral', the default ratio is 0.45; for other layoutTypes, the default ratio is 0.1.

#${prefix} maskShape(string | object)

Cloud shape.

Default value: 'circle'

Supports multiple formats:

- String: Mask image URL or built-in shape name
- Object: Text outline or geometric shape outline configuration

Built-in shape options:

- `'triangleForward'`: Right arrow
- `'triangle'`: Triangle
- `'diamond'`: Diamond
- `'square'`: Square
- `'star'`: Star
- `'cardioid'`: Heart shape
- `'circle'`: Circle
- `'pentagon'`: Pentagon
- `'rect'`: Rectangle

Text outline configuration:

```ts
export interface TextShapeMask {
  type: 'text';
  text: string;
  hollow?: boolean;
  backgroundColor?: string;
  fill?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fontVariant: string;
}
```

几何形状轮廓配置：

```ts
export interface GeometricMaskShape {
  type: 'geometric';
  shape: string;
  hollow?: boolean;
  backgroundColor?: string;
  fill?: string;
}
```

#${prefix} imageMask(Object)

图片遮罩配置。

##${prefix} visible(boolean) = false

是否显示遮罩图元。

##${prefix} threshold(number)

二值化阈值。默认情况下，透明或白色的像素会被认为是背景进行剔除。

##${prefix} invert(boolean) = false

反转图像。

##${prefix} removeWhiteBorder(boolean) = false

是否对遮罩图片去除白边。

##${prefix} style(Object)

遮罩图元样式。

{{ use: mark-style(
  markName = 'imageMask'
) }}

#${prefix} layoutConfig(Object)

布局相关配置。支持三种布局模式：螺旋线布局、网格布局和堆叠布局。

根据 `layoutMode.layoutMode` 配置不同，有不同的配置项：

`layoutMode` 可选值：

- `'spiral'`: 螺旋线布局（默认）
- `'grid'`: 网格布局，每个网格单元的大小是固定的，图片的权重不再会影响图片的大小，仅会影响图片的位置
- `'stack'`: 堆叠布局，图片之间可以发生重叠

##${prefix} layoutMode = 'spiral'：

螺旋线布局。

###${prefix} spiralType(string) = 'archimedean'

螺旋线种类。

可选值：

- `'archimedean'`: 阿基米德螺旋线
- `'rectangular'`: 矩形螺旋线

###${prefix} fillingTimes(number) = 4

图片填充迭代次数。

###${prefix} minFillingImageSize(number)

填充图片的最小尺寸。

##${prefix} layoutMode = 'grid'

网格布局。

###${prefix} cellType(string) = 'rect'

网格单元形状。

可选值：

- `'rect'`: 矩形网格
- `'circle'`: 圆形网格
- `'hexagonal'`: 六边形网格

###${prefix} rectAspectRatio(number) = 1

矩形网格单元的宽高比。仅当 cellType 为 'rect' 时有效。

###${prefix} placement(string) = 'default'

图片的布局方式。

可选值：

- `'default'`: 图片填满网格单元，尽可能排列成遮罩的形状
- `'masked'`: 图片填满网格单元，并应用遮罩
- `'edge'`: 图片延着遮罩边缘布局

##${prefix} layoutMode = 'stack'

堆叠布局。

###${prefix} placement(string) = 'default'

图片的布局方式。

可选值：

- `'default'`: 图片填满网格单元，尽可能排列成遮罩的形状
- `'masked'`: 图片填满网格单元，并应用遮罩
- `'edge'`: 图片延着遮罩边缘布局

###${prefix} maxAngle(number) = 1.22173

最大旋转角度（弧度制）。默认值约为 70 度（1.22173 弧度）。

#${prefix} image(Object)

图片图元配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} padding(number)

图片间距。

##${prefix} style(Object)

图片样式。

{{ use: mark-style(
  markName = 'image'
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
