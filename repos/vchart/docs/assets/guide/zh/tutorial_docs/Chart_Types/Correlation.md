# 散点相关性图

[\[配置项\]](../../../option/correlationChart)

## 简介

散点相关性图是一种需求图谱, 表示不同节点之间的关系远近。
相关性基本上意味着两组或多组数据之间的相互联系，在统计学中，它基本上表示两个随机变量彼此相关的程度。
散点相关性图中的节点距离中心点越近，表示相关性越强。除此之外，也可以根据数值指定节点的大小，从而以此表示变量的数值大小差异。

### 图表构成

散点相关性图由节点和中心点两部分组成。
节点由两部分构成：节点图元（`nodePoint`），标签图元（`label`）。
中心点由三部分构成：中心点图元（`centerPoint`），水波纹图元（`ripplePoint`） ，中心点标签 （`centerLabel`）。
![](/vchart/preview/correlation_tutorial_1.5.1.png)

散点相关性图的数据字段及数据映射有如下配置：

- `correlationChart.type`: 图表类型，散点图的类型为`'correlation'`
- `correlationChart.data`: 图表绘制的数据源
- `correlationChart.categoryField` 属性声明为节点名称字段配置
- `correlationChart.valueField` 属性声明为相关性数据字段配置
- `correlationChart.sizeField` 属性声明为节点尺寸数据字段配置
- `correlationChart.sizeRange` 属性声明为节点尺寸映射范围

散点相关性图的布局相关有如下配置：

- `correlationChart.innerRadius`: 节点分布内半径，支持像素值和百分比两种格式，最小值为 `0` 或 `'0%'`
- `correlationChart.outerRadius`: 节点分布外半径，支持像素值和百分比两种格式，最大值为 `'100%'`
- `correlationChart.startAngle`: 图表起始角度，使用角度制，默认值为`-90`
- `correlationChart.endAngle`: 图表终止角度，使用角度制，默认值为`270`
- `correlationChart.centerX`: 图表中心点位置 X 坐标，默认值为视图窗口中心的 X 坐标
- `correlationChart.centerY`: 图表中心点位置 Y 坐标，默认值为视图窗口中心的 Y 坐标

散点相关性图的各个图元都可以自定义配置效果：

- `correlationChart.nodePoint` 属性声明为节点图元属性
- `correlationChart.label` 属性声明为节点标签属性
- `correlationChart.centerPoint` 属性声明为中心点图元属性
- `correlationChart.ripplePoint` 属性声明为水波纹图元属性
- `correlationChart.centerLabel` 属性声明为中心点 label 属性，关键词内容在`correlationChart.centerLabel.style.text`中进行配置
- 更多组件配置见[VChart correlationChart 配置](../../../option/correlationChart)

### 快速上手

```javascript livedemo
const spec = {
  type: 'correlation',
  data: [
    {
      values: [
        { word: '输入法哪个好用', pv: 15952, ratio: 94, sim: 3932 },
        { word: '谷歌拼音输入法', pv: 11032, ratio: 97, sim: 2799 },
        { word: '讯飞输入法', pv: 107908, ratio: 102, sim: 2645 },
        { word: 'QQ输入法', pv: 74912, ratio: 99, sim: 2189 },
        { word: '百度输入法', pv: 193624, ratio: 121, sim: 2100 },
        { word: '搜狗输入法', pv: 835168, ratio: 88, sim: 2050 },
        { word: '谷歌输入法', pv: 14140, ratio: 96, sim: 1953 },
        { word: '手心输入法', pv: 19236, ratio: 97, sim: 1870 },
        { word: '输入法不见了', pv: 1968, ratio: 109, sim: 1705 },
        { word: '输入法哪个最好用', pv: 812, ratio: 150, sim: 1567 },
        { word: '必应输入法', pv: 4602, ratio: 91, sim: 1522 },
        { word: '章鱼输入法', pv: 18262, ratio: 97, sim: 1486 },
        { word: '输入法下载', pv: 34186, ratio: 91, sim: 1278 },
        { word: '拼音输入法', pv: 7186, ratio: 86, sim: 1009 },
        { word: 'SHURUFA', pv: 13418, ratio: 102, sim: 924 },
        { word: '微软输入法', pv: 4680, ratio: 88, sim: 804 },
        { word: 'GOOGLE输入法', pv: 2206, ratio: 97, sim: 800 },
        { word: '输入法切换不出来', pv: 15112, ratio: 85, sim: 764 },
        { word: '章鱼输入法下载', pv: 8204, ratio: 135, sim: 754 },
        { word: '讯飞输入法下载', pv: 5590, ratio: 106, sim: 609 },
        { word: '输入法搜狗', pv: 352, ratio: 132, sim: 593 },
        { word: '输入法皮肤', pv: 2476, ratio: 103, sim: 540 },
        { word: '紫光输入法', pv: 1582, ratio: 86, sim: 538 },
        { word: '输入法设置', pv: 1298, ratio: 75, sim: 527 },
        { word: '搜狗输入法下载安装', pv: 126182, ratio: 102, sim: 521 },
        { word: '微软拼音输入法', pv: 3442, ratio: 88, sim: 510 },
        { word: 'QQ拼音输入法', pv: 24912, ratio: 98, sim: 478 },
        { word: '输入发', pv: 150, ratio: 125, sim: 465 },
        { word: 'SOUGOU输入法', pv: 264, ratio: 89, sim: 452 },
        { word: '微软拼音', pv: 2772, ratio: 93, sim: 443 }
      ]
    }
  ],

  categoryField: 'word',
  valueField: 'sim',

  sizeField: 'pv',
  sizeRange: [12, 30],

  innerRadius: '25%',
  outerRadius: '95%',

  nodePoint: {
    state: {
      hover: {
        lineWidth: 8,
        strokeOpacity: 0.2
      }
    }
  },

  centerPoint: {
    state: {
      hover: {
        lineWidth: 8,
        strokeOpacity: 0.2
      }
    }
  },

  centerLabel: {
    visible: true,
    position: 'center',
    style: {
      fill: 'white',
      text: '输入法'
    }
  },

  label: {
    visible: true,
    position: 'bottom',
    style: {
      fill: 'black'
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### 关键配置

- `categoryField` 属性声明为节点名称字段配置
- `valueField` 属性声明为相关性数据字段配置
- `sizeField` 属性声明为节点尺寸数据字段配置
- `sizeRange` 属性声明为节点尺寸映射范围
- `correlationChart.innerRadius`: 节点分布内半径
- `correlationChart.outerRadius`: 节点分布外半径

## 散点相关性图

### 数据

- 一个`离散`字段，如: `word`，映射节点图元 label 内容
- 一个`数值`字段，如: `sim` ，映射节点图元距离中心点距离

可选：

- 一个`数值`字段，如:`pv`，映射节点图元大小

一组输入法搜索相关性的数据定义如下：

```ts
data: [
  {
    values: [
      { word: '输入法哪个好用', pv: 15952, ratio: 94, sim: 3932 },
      { word: '谷歌拼音输入法', pv: 11032, ratio: 97, sim: 2799 },
      { word: '讯飞输入法', pv: 107908, ratio: 102, sim: 2645 },
      { word: 'QQ输入法', pv: 74912, ratio: 99, sim: 2189 },
      { word: '百度输入法', pv: 193624, ratio: 121, sim: 2100 },
      { word: '搜狗输入法', pv: 835168, ratio: 88, sim: 2050 },
      { word: '谷歌输入法', pv: 14140, ratio: 96, sim: 1953 },
      { word: '手心输入法', pv: 19236, ratio: 97, sim: 1870 },
      { word: '输入法不见了', pv: 1968, ratio: 109, sim: 1705 },
      { word: '输入法哪个最好用', pv: 812, ratio: 150, sim: 1567 },
      { word: '必应输入法', pv: 4602, ratio: 91, sim: 1522 },
      { word: '章鱼输入法', pv: 18262, ratio: 97, sim: 1486 },
      { word: '输入法下载', pv: 34186, ratio: 91, sim: 1278 },
      { word: '拼音输入法', pv: 7186, ratio: 86, sim: 1009 },
      { word: 'SHURUFA', pv: 13418, ratio: 102, sim: 924 },
      { word: '微软输入法', pv: 4680, ratio: 88, sim: 804 },
      { word: 'GOOGLE输入法', pv: 2206, ratio: 97, sim: 800 },
      { word: '输入法切换不出来', pv: 15112, ratio: 85, sim: 764 },
      { word: '章鱼输入法下载', pv: 8204, ratio: 135, sim: 754 },
      { word: '讯飞输入法下载', pv: 5590, ratio: 106, sim: 609 },
      { word: '输入法搜狗', pv: 352, ratio: 132, sim: 593 },
      { word: '输入法皮肤', pv: 2476, ratio: 103, sim: 540 },
      { word: '紫光输入法', pv: 1582, ratio: 86, sim: 538 },
      { word: '输入法设置', pv: 1298, ratio: 75, sim: 527 },
      { word: '搜狗输入法下载安装', pv: 126182, ratio: 102, sim: 521 },
      { word: '微软拼音输入法', pv: 3442, ratio: 88, sim: 510 },
      { word: 'QQ拼音输入法', pv: 24912, ratio: 98, sim: 478 },
      { word: '输入发', pv: 150, ratio: 125, sim: 465 },
      { word: 'SOUGOU输入法', pv: 264, ratio: 89, sim: 452 },
      { word: '微软拼音', pv: 2772, ratio: 93, sim: 443 }
    ]
  }
];
```
