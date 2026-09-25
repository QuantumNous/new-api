# How to set the color and transparency of individual words inside the word cloud based on their values?

## Question Description

I am trying to determine the range of word opacity according to the value. For example, the higher the value, the higher the transparency. Additionally, I would like to set color values based on numerical values. How can I configure them in VChart?

## Solution

You can build the mapping between the datum and the text color transparency `word.style.fillOpacity` or text font color `word.style.fill` by way of a callback function.
[wordcloud fill](/vchart/faq/9-0.png)

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

## Quote

- [WordCloud Chart Demo](https://www.visactor.io/vchart/demo/word-cloud-chart/word-cloud-basic)
- [WordCloud Chart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/WordCloud)
- [Related api](https://www.visactor.io/vchart/option/wordCloudChart#word.style)
- [github](https://github.com/VisActor/VChart)
