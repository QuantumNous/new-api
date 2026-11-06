{{ target: component-polar-axis }}

<!-- 极坐标系的坐标轴配置 -->
<!-- IPolarAxisSpec -->

## axes(Array|Object)

极坐标系下坐标轴配置，支持：

- 线性轴：`type: 'linear'`
- 离散轴：`type: 'band'`

轴类型对应 scale 类型，半径轴默认为 'linear'，角度轴默认为 'band'。

TODO: 补充图示。

## axes.linear(Object)

线性轴配置。

### type(string) = 'linear'

声明线性轴。

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'polar',
  type='linear'
) }}

## axes.band(Object)

离散轴配置。

### type(string) = 'band'

声明离散轴。

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'polar',
  type='band'
) }}
