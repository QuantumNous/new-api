{{ target: common-series }}

<!-- ISeriesSpec -->

{{ if: !${noType} }} #${prefix} type(string) = '${seriesType}'

Series type.

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

Used to customize the series name.

#${prefix} support3d(boolean)

When the chart is enabled for 3d mode, whether this graphic element supports (enables) 3d capabilities (when support3d is false, this graphic element will ignore the 3d effect and always maintain the same effect as 2d).

#${prefix} id(string|number)

User-defined series id, which can be used for event and graphic searches.

#${prefix} dataIndex(number) = 0

Data index associated with the series (retrieved from spec.data).

#${prefix} dataId(string|number)

Data id associated with the series (retrieved from spec.data).

#${prefix} regionIndex(number) = 0

Region index associated with the series.

#${prefix} regionId(string|number )

Region id associated with the series.

#${prefix} tooltip(Object)

Configuration for tooltip on the series.

{{ use: component-tooltip(
  prefix = ${prefix}
) }}

#${prefix} animation(boolean) = true

Whether to enable series animation.

{{ /if }}

#${prefix} seriesField(string)

Series grouping field, typically used for color mapping;

{{ use: common-series-style(
  prefix = ${prefix}
) }}

{{ if: !${noStack} }}

#${prefix} stack(boolean)

Whether to stack the data.

#${prefix} stackValue(string|number)

Supported since `1.4.0` version, Series with equal `stackValue` will be stacked together

#${prefix} percent(boolean)

Whether to display the data as a percentage.

#${prefix} stackOffsetSilhouette(boolean)
Whether to offset the silhouette around the central axis. Useful for drawing some symmetrical graphics.

{{ /if }}

{{ if: !${percent} }}

#${prefix} percent(boolean)

Whether to display the data as a percentage.

{{ /if }}

{{ if: !${noInvalidType} }}

#${prefix} invalidType(string)

Invalid data handling configuration. Options are:

- `'break'`: Break at the data point
- `'link'`: Ignore the point and keep continuity
- `'zero'`: Set the default value of the point to 0
- `'ignore'`: Do not process

{{ /if }}

#${prefix} dataKey(string|string[]|function)

DataKey is used to bind the relationship between data and Mark, which is very important in animation.

This configuration supports callback functions, with the function defined as:

```ts
(data: Datum, index: number) => string;
```

{{ if: !${noMorph} }}
#${prefix} morph(Object)

Morph animation configuration.

##${prefix} enable(boolean) = true

Whether to enable series morph animation.

##${prefix} morphKey(string)

Primitive matching field, the series is related to the content configured by morphKey before and after.

##${prefix} morphElementKey(string)

Data matching field, configurable for multiple data primitives.

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
  seriesMarks = ${seriesMarks},
) }}

{{ /if }}

{{ use: common-interaction(
  prefix = ${prefix}
) }}
