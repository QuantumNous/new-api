---
category: examples
group: word chart
title: 词云图文字缩放
keywords: wordCloud,text,distribution
order: 14-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-shrink.png
option: wordCloudChart
---

# 词云图文字缩放

当单词放置不下时会对画布进行整体缩放以放置尽量多的单词

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `wordCloudConfig.zoomToFit` 属性声明为词云的自适应缩放配置; `shrink`: 开启时, 当单词放置不下时会对画布进行整体缩放以放置尽量多的单词, 可通过`fontSizeLimitMin`来设置最小字号，默认为 0，即放下所有单词

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  wordCloudConfig: {
    zoomToFit: {
      shrink: true,
      fontSizeLimitMin: 5
    }
  },
  data: {
    name: 'baseData',
    values: dataWordCloud
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
