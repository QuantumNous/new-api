---
category: examples
group: word chart
title: 词云图文字格式化
keywords: wordCloud,text,distribution
order: 14-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-format.png
option: wordCloudChart
---

# 词云图文字格式化

可以用自定义函数的方式修改文本显示内容

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `word.formatMethod` 属性声明为文字的自定义格式函数, 该配置可以修改词云文字的显示内容，不会修改原始数据，不会影响 tooltip 等原生交互与事件

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  word: {
    formatMethod: datum => {
      return datum.challenge_name + '...';
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
