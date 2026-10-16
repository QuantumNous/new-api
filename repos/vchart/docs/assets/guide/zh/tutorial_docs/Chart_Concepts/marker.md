# Marker 数据标注

Marker 是为增强数据感知、辅助数据叙事而设计的图表辅助标注组件，常用于突出某个数据或展示多个数据的统计计算结果。**需要注意的是，该组件目前仅支持直角坐标系图表。**

本教程主要讲解 Marker 组件的相关概念以及组成，关于 Marker 组件更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 标注类型

在 VChart 中，根据标记的定位和形状，Marker 数据标注组件分为以下三种类型：

### MarkPoint 数据标注点

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a1b.png" alt="MarkPoint 图示">
</div>

MarkPoint 是数据标注点，可以表示某个具体数据在图表中的位置。通过使用 MarkPoint，用户可以对特定数据进行突出展示，使得读者更加直观地了解该数据点的详细数据。

MarkPoint 可通过 `markPoint` 属性进行配置:

```ts
{
  markPoint: {
    // 配置标注点的位置
    coordinate: {
      year: '2016',
      population: 899447
    },
    // 配置标注内容
    itemContent: {
      type: 'richText', //
    },
    itemLine: {
      type: 'type-do',
    }
  }
}
```

### MarkLine 数据标注线

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c619.png" alt="MarkLine 图示">
</div>

MarkLine 是数据标注线，可以表示某个特定数值在图表中的水平或垂直位置。通过使用 MarkLine，在图表中以线形式突出显示该数值附近的数据变化，有助于用户更快速地发现数据中的规律。

MarkLine 可通过 `markLine` 属性进行配置:

```ts
{
  markLine: {
    x: 50, // 标注目标：笛卡尔坐标系x坐标空间。 x轴上的标注线
    // 配置文本
    label: {
      text: '标注线',
    },
    line: {
      // 配置线样式
      style: {
        lineWidth: 2,
      }
    }
  }
}
```

通过这两个示例，你可以学会如何在 VChart 中使用 MarkPoint 和 MarkLine 进行数据注。欢迎尝试使用 VChart 来创建更多功能丰富且美观的图表。

### MarkArea 数据标注区域

![MarkArea 图示](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a21c.png)

MarkArea 是数据标注区域，可以对一段数据区间进行标注，以突出该区间的数据变化。通过使用 MarkArea，用户可以更加直观地了解数据的分布情况，以及数据的变化趋势。

MarkArea 可通过 `markArea` 属性进行配置:

```ts
{
  markArea: {
    // 声明构成标注区域的四个点的坐标
    coordinates: [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 0 },
    ],
    // 配置文本
    label: {
      text: '标注线',
    },
    area: {
      // 配置区域样式
      style: {
        lineWidth: 2,
      }
    }
  }
}
```

## 示例

更多 Marker 组件使用可以参考 [Marker 示例](../../../example)页面。
