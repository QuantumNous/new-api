{{ target: common-series }}

<!-- ISeriesSpec -->

{{ if: !${noType} }} #${prefix} type(string) = '${seriesType}'

系列类型。

{{ /if }}

{{ if: !${noData} }}

{{ use: common-data(
  prefix = '#' + ${prefix},
  dataType = 'IDataType',
  isHierarchy = ${isHierarchy},
  isSeries = true
) }}

{{ /if }}

{{ if: !${useInChart} }}

#${prefix} name(string)

用于自定义系列名称。

#${prefix} support3d(boolean)

当图表开启了 3d 模式，该图元是否支持（启用）3d 能力（当 support3d 为 false 的时候，该图元会忽略 3d 效果，始终保持和 2d 一样的效果）。

#${prefix} id(string|number)

用户自定义的 series id，可以用于事件及图形查找。

#${prefix} dataIndex(number) = 0

系列关联的数据索引（从 spec.data 中获取）。

#${prefix} dataId(string|number)

系列关联的数据 id（从 spec.data 中获取）。

#${prefix} regionIndex(number) = 0

系列关联的 region 索引。

#${prefix} regionId(string|number )

系列关联的 region id。

#${prefix} tooltip(Object)

系列上 tooltip 的配置。

{{ use: component-tooltip(
  prefix = ${prefix}
) }}

#${prefix} animation(boolean) = true

是否开启系列动画。

{{ /if }}

#${prefix} seriesField(string)

系列分组字段，默认会用于颜色映射；

{{ use: common-series-style(
  prefix = ${prefix}
) }}

{{ if: !${noStack} }}

#${prefix} stack(boolean)

是否对数据进行堆叠处理。

#${prefix} stackValue(string|number)

从 `1.4.0` 版本开始支持，`stackValue` 相等的系列将堆积在一起

#${prefix} percent(boolean)

否对数据进行百分比处理。

#${prefix} stackOffsetSilhouette(boolean)
是否围绕中心轴偏移轮廓。可用于绘制一些对称图形。

{{ /if }}

{{ if: !${percent} }}

#${prefix} percent(boolean)

否对数据进行百分比处理。

{{ /if }}

{{ if: !${noInvalidType} }}

#${prefix} invalidType(string)

无效数据的处理方式配置。可选值为：

- `'break'`: 指在该数据点处断开
- `'link'`: 指忽略该点保持连续
- `'zero'`: 指该点默认数值为 0
- `'ignore'`: 指不处理

{{ /if }}

#${prefix} dataKey(string|string[]|function)

dataKey 用于绑定数据与 Mark 的关系，该配置在动画中非常重要。

该配置支持函数回调，函数的定义如下：

```ts
(data: Datum, index: number) => string;
```

{{ if: !${noMorph} }}
#${prefix} morph(Object)

morph 动画配置。

##${prefix} enable(boolean) = true

系列 morph 动画是否开启。

##${prefix} morphKey(string)

图元匹配字段，系列前后根据 morphKey 配置的内容进行关联。

##${prefix} morphElementKey(string)

数据匹配字段，多数据图元可配置。

{{ /if }}

{{ use: common-extension-mark(
  prefix = ${prefix}
) }}

<!-- (IExtensionMarkSpec<Exclude<EnableMarkType, MarkTypeEnum.group>> | IExtensionGroupMarkSpec)[]; -->

{{ use: common-hover(
  prefix = ${prefix}
) }}

{{ use: common-select(
  prefix = ${prefix}
) }}

{{ if: !${noAnimation} }}

{{ use: animate-animation(
  prefix = ${prefix},
  noPreset = ${noPreset},
  preset = ${preset},
  defaultPreset = ${defaultPreset},
  seriesType = ${seriesType},
  seriesMarks = ${seriesMarks}
) }}

{{ /if }}

{{ use: common-interaction(
  prefix = ${prefix}
) }}
