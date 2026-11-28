---
category: examples
group: word chart
title: 词云图全局自适应画布
keywords: wordCloud,text,distribution
order: 14-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81703.png
option: wordCloudChart
---

# 词云图全局自适应画布

当单词数量较少时会对文字进行放大以适应画布宽高

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `wordCloudConfig.zoomToFit` 属性声明为词云的自适应缩放配置; `enlarge`: 开启时, 当单词数量较少时会对文字进行放大以适应画布宽高, 可通过`fontSizeLimitMax`来设置最大字号, 默认铺满画布

## 代码演示

```javascript livedemo
const spec = {
  type: 'wordCloud',
  nameField: 'name',
  valueField: 'value',
  wordCloudConfig: {
    zoomToFit: {
      enlarge: true,
      fontSizeLimitMax: 20
    }
  },
  data: {
    name: 'baseData',
    values: [
      {
        name: '螺蛳粉',
        value: 957
      },
      {
        name: '钵钵鸡',
        value: 942
      },
      {
        name: '板栗',
        value: 842
      },
      {
        name: '胡辣汤',
        value: 828
      },
      {
        name: '关东煮',
        value: 665
      },
      {
        name: '羊肉汤',
        value: 627
      },
      {
        name: '热干面',
        value: 574
      }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
