# 如何根据数值设定词云里面单个词语的颜色和透明度？

## 问题描述

我是想按照数值来决定单词 opacity 的范围，比如数值越大，透明度越高；另外，我还想根据数值来设定颜色的色值，请问在 VChart 中可以如何配置？

## 解决方案

你可以通过回调函数的方式构建数据 datum 与文字颜色透明度`word.style.fillOpacity`或文字颜色`word.style.fill`之间的映射。
[wordcloud fill](/vchart/faq/9-0.png)

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
  word: {
    style: {
      fill: datum => {
        if (datum['sum_count'] > 100) {
          return 'red';
        } else {
          return 'blue';
        }
      },
      fillOpacity: datum => {
        return datum['sum_count'] / 100;
      }
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [词云 demo](https://www.visactor.io/vchart/demo/word-cloud-chart/word-cloud-basic)
- [词云教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/WordCloud)
- [相关 api](https://www.visactor.io/vchart/option/wordCloudChart#word.style)
- [github](https://github.com/VisActor/VChart)
