# How to customize the font size of words in Word Cloud Chart?

## Question Description

How to customize the text size in the word cloud, I want the text with more weight to be displayed larger. For example, in the example below, I want the largest text size to be 40px. How do I do that?
[wordcloud fontsize](/vchart/faq/10-0.png)

## Solution

You can set `wordCloudChart.fontSizeRange` to configure the font size range, which indicates the text size corresponding to the minimum and maximum values of the data respectively, in the example you gave, you can configure `wordCloudChart.fontSizeRange: [5, 40]` to achieve the desired effect.

## Code Example

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

## Quote

- [WordCloud Chart Demo](https://www.visactor.io/vchart/demo/word-cloud-chart/word-cloud-basic)
- [WordCloud Chart Tutorial](https://www.visactor.io/vchart/guide/chart/word-cloud)
- [Related api](https://www.visactor.io/vchart/option/wordCloudChart#fontSizeRange)
- [github](https://github.com/VisActor/VChart)
