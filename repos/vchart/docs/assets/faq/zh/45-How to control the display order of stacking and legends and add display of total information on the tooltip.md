# 如何控制堆叠以及图例的显示顺序，同时在 tooltip 上添加总计信息的展示？

## 问题描述

![](/vchart/faq/85-0.png)

对于堆叠面积图，我想要控制堆叠的顺序，比如期望面积图从下到上，按照 "China", "USA", "EU", "Africa" 的顺序堆叠，然后图例的显示顺序也按照 "China", "USA", "EU", "Africa" 的顺序从左到右显示，同时 hover 上去的时候，tooltip 能够展示总计的信息，如下图所示：

![](/vchart/faq/85-1.png)

## 解决方案

这个在 [VChart](https://www.visactor.io/vchart/) 上可以非常简单得配置出来，只需要两步：

1.  通过在 `data.fields` 属性上为分组字段配置 `domain` 和 `sortIndex`来控制堆叠的顺序
    - `domain` 来声明顺序
    - `sortIndex` 声明为 0 表示按照 `domain` 顺序进行排序

![](/vchart/faq/85-2.png)

因为图例的顺序默认是按照字段 domain 声明的顺序展示的，所以图例这里不需要进行配置。

2.  通过为 `tooltip.dimension` 配置 `updateContent` 可以动态得为 tooltip 的内容添加需要的信息，而且也可以拿到当前 tooltip 展示的所有信息

![](/vchart/faq/85-3.png)

## 代码示例

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    fields: {
      country: {
        domain: ['China', 'USA', 'EU', 'Africa'],
        sortIndex: 0
      }
    },
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  tooltip: {
    dimension: {
      updateContent: data => {
        let sum = 0;
        data.forEach(datum => {
          sum += +datum.value;
        });
        data.push({
          hasShape: 'false',
          key: 'Total',
          value: sum
        });
        return data;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

在线效果参考：[https://codepen.io/Sima/pen/WNLxdyg](https://codepen.io/Sima/pen/WNLxdyg)

## 相关文档

堆积面积图 demo：[https://www.visactor.io/vchart/demo/area-chart/stacked-area](https://www.visactor.io/vchart/demo/area-chart/stacked-area)

面积图教程： [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Area](https://www.visactor.io/vchart/demo/area-chart/stacked-area)

数据配置教程：[https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Data/Data_Types_and_Interface](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Data/Data_Types_and_Interface)

Tooltip 配置教程：[https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)

数据字段配置：[https://www.visactor.io/vchart/option/areaChart#data(IDataType%7CIDataType%5B%5D).IDataValues.fields](<https://www.visactor.io/vchart/option/areaChart#data(IDataType%7CIDataType%5B%5D).IDataValues.fields>)

Tooltip 配置项：[https://www.visactor.io/vchart/option/areaChart#tooltip.visible](https://www.visactor.io/vchart/option/areaChart#tooltip.visible)

github：[https://github.com/VisActor/VChart](https://www.visactor.io/vchart/option/areaChart#tooltip.visible)
