{{ target: component-data-filter-base }}

#${prefix} visible(boolean) = true

是否显示组件。

#${prefix} orient(string) = 'left'

组件位置。

可选值：

- 'left'
- 'top'
- 'right'
- 'bottom'

#${prefix} width(string | number) = 'auto'

组件宽度。

#${prefix} height(string | number) = 'auto'

组件高度。

#${prefix} field(string)

声明关联的映射字段。

#${prefix} axisId(string)

关联的轴 ID。

#${prefix} axisIndex(number)

关联的轴序号。

#${prefix} regionId(string)

关联的 region ID。

组件关联的 region 索引，与 axis 关联的 region 取交集

- 未配置：默认跟随 axis 控制的 region
- 已配置：用户配置与 axis 关联的 region 取交集
- 配置优先级：regionIndex > regionId

#${prefix} regionIndex(number)

关联的 region 序号。

组件关联的 region 索引，与 axis 关联的 region 取交集

- 未配置：默认跟随 axis 控制的 region
- 已配置：用户配置与 axis 关联的 region 取交集
- 配置优先级：regionIndex > regionId

#${prefix} filterMode(string) = 'filter'

数据过滤模式。

可选值:

- 'filter'
- 'axis'

其中 `filterMode` 设置为 `filter` 的时候，表示多数据进行过滤，会影响轴的刻度计算；`filterMode` 设置为 `axis` 的时候，只是影响对应轴的坐标对应范围，不对数据进行过滤。

#${prefix} start(number) = 0

起点配置（比例）：范围[0, 1]。

#${prefix} end(number) = 1

终点配置（比例）：范围[0, 1]。

#${prefix} startValue(string | number)

起点数据配置：没有配置的时候根据 start 进行转换。

#${prefix} endValue(string | number)

终点数据配置：没有配置的时候根据 end 进行转换。

#${prefix} rangeMode([string | string])

起点和终点的配置模式：只有模式和配置匹配时才生效，比如 rangeMode: ['percent', 'value']，那么必须 start 和 endValue 都配置才可以生效。

#${prefix} autoIndent(boolean)

是否进行自动缩进。

#${prefix} auto(boolean) = false

是否为自动模式。开启以后，组件不会导致轴 scale 缩放，end、roam、minSpan、maxSpan、minValueSpan、maxValueSpan 等可能导致缩放的配置将被忽略，且组件可以自动消失。自 `1.4.0` 版本开始支持。

#${prefix} zoomLock(boolean) = false
是否锁定选择区域（或叫做数据窗口）的大小。自 `1.5.1` 版本开始支持。

#${prefix} minSpan(number) = 0
用于限制窗口大小的最小值, [0, 1]。自 `1.5.1` 版本开始支持。

#${prefix} maxSpan(number) = 1
用于限制窗口大小的最大值, [0, 1]。自 `1.5.1` 版本开始支持。

#${prefix} minValueSpan(number)
用于限制窗口大小的最小数据值, 仅在continous scale生效，优先级高于minSpan。自 `1.5.1` 版本开始支持。

#${prefix} maxValueSpan(number)
用于限制窗口大小的最大数据值, 仅在continous scale生效，优先级高于maxSpan。自 `1.5.1` 版本开始支持。

#${prefix} delayType(string)
事件触发延迟类型, 不配置视作不开启。自 `1.5.1` 版本开始支持。

可选值：
- `'throttle'`: 节流
- `'debounce'`: 防抖

#${prefix} delayTime(number) = 30
事件触发延迟时长。自 `1.5.1` 版本开始支持。

#${prefix} roamZoom(boolean|object) = false
漫游模式 - 缩放（画布内自由交互）, 默认不开启。自 `1.5.1` 版本开始支持。

##${prefix} focus(boolean) = true
是否开启聚焦缩放。开启时, 默认以鼠标位置开始; 关闭时, 以画布中心缩放

{{ use: roam-spec(
prefix = '#' + ${prefix}
) }}

#${prefix} roamDrag(boolean|object) = false
漫游模式 - 拖拽（画布内自由交互）, 默认不开启。自 `1.5.1` 版本开始支持。

##${prefix} reverse(boolean) = true
拖拽方向与滚动条移动方向是否相反。

{{ use: roam-spec(
prefix = '#' + ${prefix}
) }}

#${prefix} roamScroll(boolean|object) = false
漫游模式 - 滚动（画布内自由交互）, 默认不开启。自 `1.5.1` 版本开始支持。

##${prefix} reverse(boolean) = true
滚动方向与滚动条移动方向是否相反。

#${prefix} realTime(boolean) = true
是否在交互时实时更新视图, 默认开启。自 `1.5.1` 版本开始支持。

### customDomain(array)

支持自定义domain, 用于统一dataZoom domain与关联axis domain(当brush组件开启`zoomAfterBrush`时, 关联的dataZoom需要和axis保持一致, 否则刷取范围无法正确计算)。自 1.10.0 版本开始支持。

### updateDataAfterChange(Function)
自定义datazoom更新时的回调。自 1.10.0 版本开始支持。

```ts
/**
 * @params start dataZoom起点
 * @params start dataZoom终点
 * @params startValue dataZoom起点数据值
 * @params endValue dataZoom终点数据值
 */
(start: number, end: number, startValue: any, endValue: any) => void
```

{{ use: roam-spec(
prefix = '#' + ${prefix}
) }}

{{ use: common-layout-item(
  prefix = ${prefix},
  defaultLayoutType = 'region-relative',
  defaultLayoutLevel = 40,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
