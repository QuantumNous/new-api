{{ target: common-chart-spec }}

<!-- IChartSpec，用于图表通用配置 -->

#${prefix} type(string) = '${chartType}'

图表类型。

{{ if: ${chartType} === 'common' }}

**组合图使用说明:**

**因为组合图不限制坐标系，所以内部不能确定应该创建什么类型的坐标轴，所以在配置组合图时，必须声明 `axes` 属性，来声明使用什么类型的坐标轴。**

1. 对于直角坐标系，我们需要声明对应方向的坐标轴以及类型，举例如下：

```ts
axes: [
  { orient: 'left', type: 'linear' }, // 声明左轴为线性轴
  { orient: 'bottom', type: 'band' } // 声明下轴为离散轴
];
```

2. 对于极坐标系，我们需要声明对应方向的坐标轴以及类型，举例如下：

```ts
axes: [
  { orient: 'angle', type: 'band' }, // 声明圆弧轴为离散轴
  { orient: 'radius', type: 'linear' } // 声明半径轴为线性轴
];
```

{{ /if }}

{{ if: !${noData} }}

{{ use: common-data(
    prefix = '#' + ${prefix},
    isHierarchy = ${isHierarchy},
    dataType = 'IDataType|IDataType[]'
) }}

{{ /if }}

#${prefix} width(number) = 500

图表宽度。

#${prefix} height(number) = 500

图表高度。

#${prefix} autoFit(boolean) = true

图表宽高是否自适应容器，浏览器环境下默认为 true。该配置的优先级高于构造函数中的 autoFit 配置。如果用户配置了 width，则以用户配置的 width 为准，height 同理。

#${prefix} background(string|Object)

图表背景色配置，优先级高于构造函数中的 background 配置。

{{ use : background }}

#${prefix} padding(Object|number) = 12

图表整体 padding 设置。支持直接设置数值，也可以通过对象类型分别为上下左右方向配置。

- number：单位为 px，上下左右四个方向同时配置
- Object：对象类型使用如下

{{ use: common-layout-padding(
  prefix = '#' + ${prefix},
) }}

#${prefix} color(Array|Object)

图表颜色映射配置。可以直接传递色值数组，也可以进行颜色的数据映射。

- 可以直接传递色值数组，可以改变图表的色系

```ts
color: ['#BBD6B8', '#EA5455', '#19A7CE'],
```

- 进行数据映射，通过 scale 指定映射规则

{{ use: common-visual-spec-scale(
    prefix = '#' + ${prefix},
    includeId = false
) }}

#${prefix} labelLayout(string)='series'

标签布局方式。默认按照系列单独布局，可设置为'series' 或 'region'。当设置为 region 时，相同 region 的系列标签会共同进行防重叠计算。
