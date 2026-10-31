{{ target: component-band-axis }}

<!-- IBandAxisSpec -->

#${prefix} trimPadding(boolean)

自 `1.7.0` 版本支持，用于配置是否去除 band 轴两端的留白，如果为 true，则两端不会有留白，**并且 bandPadding、paddingInner 和 paddingOuter 的设置将被忽略**。

#${prefix} bandPadding(number|number[])
默认值为: `0.2`。

**仅当轴为离散轴时生效**，用于同时设置轴的 `paddingInner` 和 `paddingOuter`，数值在(0,1)之间，优先级低于 `paddingInner` 和 `paddingOuter`。

**因为有可能存在多层 scale（xField 设置成了数组，即分组场景），所以支持了数组类型，用于多层 scale 的 bandPadding 配置**

#${prefix} paddingInner(number|number[])
默认值为: `0.1`。

**仅当轴为离散轴时生效**，轴分组内的间隔，数值在(0,1)之间，优先级高于 `bandPadding`。

**因为有可能存在多层 scale（xField 设置成了数组，即分组场景），所以支持了数组类型，用于多层 scale 的 paddingInner 配置。**

更多可以参考 https://github.com/d3/d3-scale#band-scales。

#${prefix} paddingOuter(number|number[])
默认值为: `0.3`。

**仅当轴为离散轴时生效**，轴分组外的间隔，数值在(0,1)之间，优先级高于 `bandPadding`。

**因为有可能存在多层 scale（xField 设置成了数组，即分组场景），所以支持了数组类型，用于多层 scale 的 paddingOuter 配置。**

更多可以参考 https://github.com/d3/d3-scale#band-scales。

#${prefix} domain(array)

**仅当轴为离散轴时生效**，配置离散轴的数值范围。

#${prefix} bandSize(number)

**仅当轴为离散轴时生效**，配置离散轴的固定组宽。自 `1.4.0` 版本开始支持。

在视觉表现上是这样的效果：不管图表容器大小如何变化，轴上 tick 和 tick 之间的距离保持不变（如果是柱状图，则柱宽也保持不变）。

#${prefix} maxBandSize(number)

**仅当轴为离散轴时生效**，配置离散轴的最大组宽。自 `1.4.0` 版本开始支持。

由于图表会在容器中默认等比例展示全部的 tick，那么当图表容器变大时，自动计算的组宽也会等比例变大。当自动计算的组宽大于 `maxBandSize` 时，组宽将维持 `maxBandSize` 的值。

当已经配置 `bandSize` 时，`maxBandSize` 将不再生效。

#${prefix} minBandSize(number)

**仅当轴为离散轴时生效**，配置离散轴的最小组宽。自 `1.4.0` 版本开始支持。

由于图表会在容器中默认等比例展示全部的 tick，那么当图表容器变小时，自动计算的组宽也会等比例变小。当自动计算的组宽小于 `minBandSize` 时，组宽将维持 `minBandSize` 的值。

当已经配置 `bandSize` 时，`minBandSize` 将不再生效。

#${prefix} autoRegionSize(boolean)

**仅当轴为离散轴时生效**，是否根据组宽自动计算 region 宽度或高度。自 `1.4.0` 版本开始支持。

该配置仅当 `bandSize` 或 `maxBandSize` 已经配置时生效。

#${prefix} showAllGroupLayers(boolean)=false

自 `1.9.0` 版本支持，**仅当轴为离散轴时生效**。当存在多层分组场景时，是否展示所有的分组轴，默认关闭。

#${prefix} layers(object[])

自 `1.9.0` 版本支持，**当且仅当 `showAllGroupLayers` 配置开启生效**，用于每一层轴的相关配置，layer[0] 为离坐标轴线最近的轴，具体的配置如下:

##${prefix} visible(boolean)=true

是否显示。

##${prefix} tickStep(number)

tick 步长。

##${prefix} tickStep(number)

tick 步长。

##${prefix} tickCount(number|function) = 5

建议的 tick 数量，并不保证结果一定是配置值。
`1.4.0` 版本后， **在连续轴中**，`tickCount` 支持配置为一个函数，通常用以动态配置 tick 数量。函数定义如下：

```ts
tickCount?: (option: {
  axisLength?: number;  // 坐标轴占据的画布大小。直角坐标系中为轴的宽度或高度，极坐标系中半径轴的长度。
  labelStyle?: ITextGraphicAttribute; // 轴标签的样式
}) => number;
```

##${prefix} forceTickCount(number)

强制设置的 tick 数量，可以保证 tick 的数量于设置的数值匹配，但是可能由于数据范围导致 tick 值为小数。
