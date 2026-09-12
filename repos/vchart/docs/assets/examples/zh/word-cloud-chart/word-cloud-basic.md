---
category: examples
group: word chart
title: 基础词云图
keywords: wordCloud,text,distribution
order: 14-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-basis.png
option: wordCloudChart
---

# 基础词云图

词云是一种有效的文本数据可视化方法， 常用于展示大量文本数据。在词云中，一般来说，权重较高的词相比于权重低的词更容易被人所注意, 因此能够帮助用户对比文本的组成及其权重。

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
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
