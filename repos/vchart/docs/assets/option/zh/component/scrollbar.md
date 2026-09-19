{{ target: component-scrollbar }}

## scrollBar(Array)

滚动条配置。

### round(boolean)

滑块是否圆角。

### innerPadding(boolean)

滚动条内边距，影响滑轨的实际可用空间 [top, right, bottom, left]。

### range([number, number])

滑块当前的可视范围，数值为 0 - 1。

### limitRange([number, number])

滑块限制的滚动范围，数值为 0 - 1。

### rail(Object)

滚动条轨道。

#### style(Object)

滚动条轨道样式。

{{ use: graphic-rect(
  prefix = '####'
) }}

### slider(Object)

滚动条滑块。

#### style(Object)

滚动条滑块样式。

{{ use: graphic-rect(
  prefix = '####'
) }}

{{ use: component-data-filter-base(
  prefix = '##'
) }}

### filterMode(string) = 'axis'

数据过滤模式。

可选值:

- 'filter'
- 'axis'

其中 `filterMode` 设置为 `filter` 的时候，表示多数据进行过滤，会影响轴的刻度计算；`filterMode` 设置为 `axis` 的时候，只是影响对应轴的坐标对应范围，不对数据进行过滤。