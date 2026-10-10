---
category: examples
group: word chart
title: 词云图随机角度
keywords: wordCloud,text,distribution
order: 14-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81700.png
option: wordCloudChart
---

# 词云图随机角度

文字的角度随机展示

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `rotateAngles` 属性声明为文字旋转角度的随机取范围, 即文字旋转角度从该数组中随机选取

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  rotateAngles: [0, 90],
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
