---
category: examples
group: word chart
title: 词云图不配置大小字段
keywords: wordCloud,text,distribution
order: 14-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-no-valueField.png
option: wordCloudChart
---

# 词云图不配置大小字段

不配置文字大小字段时, 所有文字默认大小一致

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段; 若不配置, 则默认所有文字大小一致

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  seriesField: 'challenge_name',
  data: {
    name: 'baseData',
    values: dataWordCloud
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
