# 扩展图表：时间轴图

时间轴图（Timeline Chart）是一种用于按时间顺序展示事件的可视化图表，特别适合展示项目进度、企业发展历程、产品迭代过程等场景。

VChart 提供了时间轴图扩展组件，支持水平和垂直两种布局方式，可以灵活配置事件节点的样式、标签位置和图标等元素。

![img](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/timeline/timeline-basic.png)

## 如何使用扩展图表

时间轴图需要手动注册后才能使用，注册和使用方式如下：

```js
import VChart from '@visactor/vchart';
import { registerTimelineChart } from '@visactor/vchart-extension';

const spec = {
  type: 'timeline'
  //  your spec
};
registerTimelineChart();

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();
```

如果是通过 cdn 引入的方式，注册方式如下：

```html
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart-extension/build/index.min.js"></script>
<script>
  const spec = {
    type: 'timeline'

    //  your spec
  };
  VChartExtension.registerTimelineChart();

  const vchart = new VChart.default(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## 相关配置项

### 时间轴图配置

```ts
export interface ITimelineChartSpec extends ICartesianChartSpec {
  type: 'timeline';
  /**
   * 时间轴方向
   * - 'horizontal': 水平方向，时间从左到右
   * - 'vertical': 垂直方向，时间从上到下
   */
  direction?: 'horizontal' | 'vertical';
  /**
   * 系列配置
   */
  series?: IEventSeriesSpec[];
}
```

### 事件系列配置

```ts
export interface IEventSeriesSpec extends ICartesianSeriesSpec {
  type: 'event';
  /**
   * 时间字段，用于指定事件在时间轴上的位置
   */
  timeField?: string;
  /**
   * 事件名称字段
   */
  eventField?: string;
  /**
   * 事件详情字段（副标题）
   */
  subTitleField?: string;
  /**
   * 图标字段，用于显示图标或图片
   */
  iconField?: string;
  /**
   * 系列字段，用于分组显示
   */
  seriesField?: string;
  /**
   * 标题和副标题的位置
   * - 水平布局: 'top' | 'bottom' | 'top-bottom' | 'bottom-top'
   * - 垂直布局: 'left' | 'right' | 'left-right' | 'right-left'
   */
  labelPosition?: LabelPosition;
  /**
   * 图标图元配置
   * offset: 图标相对于点的偏移距离，单位像素，正值向外偏移，负值向内偏移
   */
  icon?: IMarkSpec<ISymbolMarkSpec> & { offset?: number };
  /**
   * 事件标题图元配置
   * subTitleGap: 标题与副标题的间距，单位像素
   * offset: 标题相对于点的偏移距离，单位像素，正值向外偏移，负值向内偏移
   */
  title?: IMarkSpec<ITextMarkSpec> & { subTitleGap?: number; offset?: number };
  /**
   * 事件副标题图元配置
   */
  subTitle?: IMarkSpec<ITextMarkSpec>;
  /**
   * 事件线图元配置
   */
  line?: IMarkSpec<ILineMarkSpec>;
  /**
   * 箭头图元配置
   * thickness: 箭头的厚度，单位像素
   */
  arrow?: IMarkSpec<IPathMarkSpec> & { thickness?: number };
}
```

## 时间轴图示例

- [基础时间轴图](/vchart/demo/extension-chart/timeline-basic)
- [带图标的时间轴图](/vchart/demo/extension-chart/timeline-with-icon)

## 配置详解

### 布局方向

时间轴图支持两种布局方向：

- **水平布局** (`direction: 'horizontal'`): 时间从左到右展开，适合展示横向的时间进程
- **垂直布局** (`direction: 'vertical'`): 时间从上到下展开，适合展示纵向的发展历程

### 数据字段配置

时间轴图需要配置以下数据字段：

- `timeField`: 时间字段，用于确定事件在时间轴上的位置
- `eventField`: 事件名称字段，显示为标题
- `subTitleField`: 事件详情字段，显示为副标题（可选）
- `iconField`: 图标字段，用于显示图标或图片（可选）
- `seriesField`: 系列字段，用于分组展示多条时间轴（可选）

### 标签位置配置

通过 `labelPosition` 可以控制标题和副标题的显示位置：

**水平布局时：**

- `top`: 标题始终在时间轴上方
- `bottom`: 标题始终在时间轴下方
- `top-bottom`: 标题交替显示在上方和下方（第一个在上，第二个在下）
- `bottom-top`: 标题交替显示在下方和上方（第一个在下，第二个在上）

**垂直布局时：**

- `left`: 标题始终在时间轴左侧
- `right`: 标题始终在时间轴右侧
- `left-right`: 标题交替显示在左侧和右侧（第一个在左，第二个在右）
- `right-left`: 标题交替显示在右侧和左侧（第一个在右，第二个在左）

### 图标功能

时间轴图支持在事件节点上添加图标，图标会与标题关于时间轴对称显示：

- 水平布局：当标题在上方时，图标在下方；当标题在下方时，图标在上方
- 垂直布局：当标题在左侧时，图标在右侧；当标题在右侧时，图标在左侧

图标可以使用 VChart 内置的 symbol 形状（如 'star'、'diamond'、'triangleUp' 等）或图片 URL。

### 样式配置

#### 点标记样式

通过 `dot` 配置事件节点的点标记样式：

```js
dot: {
  style: {
    size: 12,
    fill: '#4A90E2',
    stroke: '#fff',
    lineWidth: 2
  }
}
```

#### 图标样式

通过 `icon` 配置图标的样式：

```js
icon: {
  style: {
    size: 24,
    fill: '#4A90E2',
    shape: 'star' // 或图片 URL
  }
}
```

#### 标题样式

通过 `title` 和 `subTitle` 分别配置标题和副标题的样式：

```js
title: {
  style: {
    fontSize: 14,
    fontWeight: 'bold',
    fill: '#333'
  }
},
subTitle: {
  style: {
    fontSize: 12,
    fill: '#666',
    lineHeight: 18
  }
}
```

#### 时间轴线样式

通过 `line` 配置时间轴线的样式：

```js
line: {
  style: {
    stroke: '#c0c3c7',
    lineWidth: 2
  }
}
```

#### 箭头样式

通过 `arrow` 配置连接箭头的样式：

```js
arrow: {
  visible: true,
  thickness: 16,
  style: {
    fill: '#4A90E2'
  }
}
```

### 分组展示

通过配置 `seriesField`，可以实现多条时间轴的分组展示，适合对比展示多个主题或类别的时间线。

### 交互功能

时间轴图支持以下交互功能：

- **Tooltip**: 鼠标悬停在点标记、图标或箭头上时，会显示事件的详细信息
- **点击事件**: 可以监听点标记的点击事件，实现自定义交互

## 应用场景

时间轴图适用于以下场景：

1. **项目管理**: 展示项目的里程碑和关键节点
2. **企业发展**: 展示公司的发展历程和重要事件
3. **产品迭代**: 展示产品版本的更新历史
4. **历史事件**: 展示历史事件的时间顺序
5. **个人简历**: 展示工作经历和教育背景

## 注意事项

1. 时间字段应该是数值或日期类型，以确保正确的排序
2. 当使用 `seriesField` 分组时，建议合理控制分组数量，避免图表过于拥挤
3. 标签位置的选择应该考虑内容长度和图表空间，避免文本重叠
4. 图标大小应该与整体布局协调，不宜过大或过小
