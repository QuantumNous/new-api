---
category: examples
group: word chart
title: 词云图文本裁剪
keywords: wordCloud,text,distribution
order: 14-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-clip.png
option: wordCloudChart
---

# 词云图文本裁剪

数据中有超长文本时, 超出画布的文本部分被裁剪, 而整个文本非不显示

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `wordCloudConfig.drawOutOfBound` 属性声明为超出画布的超长文本处理方式; `clip`: 绘制超长文本，超出画布的部分裁剪掉; `hidden`: 不绘制超长文本

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  width: 500,
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  wordCloudConfig: {
    drawOutOfBound: 'clip'
  },
  data: {
    name: 'baseData',
    values: [
      ...dataWordCloud,
      {
        challenge_name: '这个单词特别特别特别特别特别特别特别长',
        sum_count: 150
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
