{{ target: component-indicator }}

## indicator (Object)

指标卡组件。

### visible(boolean) = true

是否显示指标卡组件。

### fixed(boolean) = true

初始显示状态。

可选：

- `true` 保持指标卡内容显示。
- `false` 交互后才显示。

### trigger(string) = 'select'

更新交互触发类型。

可选：

- `hover` 通过悬停交互触发指标卡数据的更新
- `select` 通过选中交互触发指标卡数据的更新
- `none`   指标卡数据不可更新

### offsetX(number) = 0

指标卡 x 方向偏移。

自`1.3.0`版本开始支持，支持两种格式：像素值（number）、百分比（string）。

### offsetY(number) = 0

指标卡 y 方向偏移。

自`1.3.0`版本开始支持，支持两种格式：像素值（number）、百分比（string）。

### limitRatio(number) = 1

指标卡宽度占内容区域的最大比值。

### title(Object)

指标卡标题文字配置。

{{ use: component-indicator-item(
  prefix = '###'
) }}

### content(Object|Array)

指标卡内容文字配置。

{{ use: component-indicator-item(
  prefix = '###'
) }}
