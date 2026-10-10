# 词云图中如何自定义词语的字体大小？

## 问题描述

如何自定义词云中的文字大小，我希望权重较大的文字能显示的更大些，比如下面这个例子中我想让最大的文字大小达到 40px，我该怎么做呢？
[wordcloud fontsize](/vchart/faq/10-0.png)

## 解决方案

你可以设置`wordCloudChart.fontSizeRange`来配置字体大小范围，它表示数据最小值和最大值分别对应的文字大小，在你给出的例子中，可以配置`wordCloudChart.fontSizeRange: [5, 40]`来达到预期效果。

## 代码示例

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
  },
  fontSizeRange: [5, 40]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

window['vchart'] = vchart;
```

## 相关文档

- [词云 demo](https://www.visactor.io/vchart/demo/word-cloud-chart/word-cloud-basic)
- [词云教程](https://www.visactor.io/vchart/guide/chart/word-cloud)
- [相关 api](https://www.visactor.io/vchart/option/wordCloudChart#fontSizeRange)
- [github](https://github.com/VisActor/VChart)
