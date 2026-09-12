# Correlation Chart

[\[Configuration item\]](../../../option/correlationChart)

## Introduction

A scatter correlation graph is a demand graph that represents the distance between different nodes.
Correlation basically means the correlation between two or more sets of data, and in statistics it basically represents the degree to which two random variables are related to each other.
The closer the node in the scatter correlation graph is to the center point, the stronger the correlation. In addition, the size of the node can also be specified according to the numerical value, so as to represent the difference in the numerical value of the variable.

### Chart composition

A scatter correlation graph consists of two parts: nodes and center points.
A node consists of two parts: the node primitive (`nodePoint`), label primitive (`label`).
The center point consists of three parts: the center point primitive (`centerPoint`), water ripple primitive (`ripplePoint`), center point label (`centerLabel`).
![](/vchart/preview/correlation_tutorial_1.5.1.png)

The data fields and data maps of the scatter correlation graph are configured as follows:

- `correlationChart.type`: Chart type, the type of scatter chart is`'correlation'`
- `correlationChart.data`: Data source for graphing
- `correlationChart.categoryField` Property declaration is configured for node name field
- `correlationChart.valueField` Property declaration for correlation data field configuration
- `correlationChart.sizeField` Property declaration for node size data field configuration
- `correlationChart.sizeRange` Property declared as node size mapping range

The layout correlation of the scatter correlation map has the following configuration:

- `correlationChart.innerRadius`: The inner radius of the node distribution, supports two formats of pixel value and percentage, the minimum value is `0` or `'0%'`
- `correlationChart.outerRadius`: The outer radius of the node distribution, supports two formats of pixel value and percentage, the maximum value is `'100%'`
- `correlationChart.startAngle`: The starting angle of the chart, using the angle system, the default value is`-90`
- `correlationChart.endAngle`: Chart termination angle, using the angle system, the default value is`270`
- `correlationChart.centerX`: The X coordinate of the position of the center point of the chart, the default value is the X coordinate of the center of the view window
- `correlationChart.centerY`: Y coordinate of the position of the center point of the chart, the default value is the Y coordinate of the center of the view window

Each primitive of the scatter correlation graph can be customized to configure the effect:

- `correlationChart.nodePoint` Properties are declared as node graph meta properties
- `correlationChart.label` Property declared as node label property
- `correlationChart.centerPoint` Attributes are declared as center point primitive attributes
- `correlationChart.ripplePoint` The property is declared as a water ripple primitive property
- `correlationChart.centerLabel` The attribute is declared as the center point label attribute, and the keyword content is in`correlationChart.centerLabel.style.text`Configure in
- For more component configurations, see[VChart correlationChart configuration](../../../option/correlationChart)

### Get started quickly

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

### critical configuration

- `categoryField` Property declaration is configured for node name field
- `valueField` Property declaration for correlation data field configuration
- `sizeField` Property declaration for node size data field configuration
- `sizeRange` Property declared as node size mapping range
- `correlationChart.innerRadius`: Node distribution inner radius
- `correlationChart.outerRadius`: Node distribution outer radius

## scatter correlation diagram

### data

- one `Discrete` Fields such as: `word`, map node meta label content
- one `Numerical` Fields such as: `sim` , map node primitive distance from center point distance

Optional:

- one `Numerical` Fields such as:`pv`, map node primitive size

A set of data for IME search relevance is defined as follows:

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
