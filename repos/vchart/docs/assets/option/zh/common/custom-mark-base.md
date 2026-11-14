{{ target: common-custom-mark-base }}

<!-- ICustomMarkSpec -->

#${prefix} dataIndex(number)

支持自定义 mark 使用某一份数据，如果配置了 `dataId` 此配置无效。

#${prefix} dataId(string)

支持自定义 mark 使用某一份数据。自定义 mark 指定数据后，`line` 会基于每一个数据点，产生一个线的节点，其他图形会对应每一份数据产生一个图形。

#${prefix} dataKey(string | Function)

自 **1.9.5** 版本开始支持

支持自定义 mark 关联数据后，设置数据的`key`对应的字段，如果不设置和系列保持一致

#${prefix} componentType(string)

自 **1.9.0** 版本开始支持

当自定义 mark 的类型为`component`时，可以用于设置具体的组件类型

{{ use: common-mark(
  prefix = ${prefix}
) }}

#${prefix} animation(boolean) = false

自 **1.11.0** 版本开始支持

是否开启动画，默认关闭。

#${prefix} animationAppear(Object|boolean)

自 **1.11.0** 版本开始支持

图表入场动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationEnter(Object|boolean)

自 **1.11.0** 版本开始支持

数据更新 - 新增数据动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationUpdate(Object|boolean)

自 **1.11.0** 版本开始支持

数据更新 - 数据更新动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationExit(Object|boolean)

数据更新 - 数据删除动画。boolean 类型用于开启/关闭该动画。

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}
