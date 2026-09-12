---
category: examples
group: word chart
title: Basic Word Cloud Chart
keywords: wordCloud,text,distribution
order: 14-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-basis.png
option: wordCloudChart
---

# Basic Word Cloud Chart

Word cloud is an effective text data lake visualization method, which is often used to display large amounts of text data. In word cloud, in general, words with higher weight are more likely to be noticed than words with lower weight, so it can help users compare the composition of text and its weights.

## Key option

- `nameField` Property declared as text text field
- `valueField` Property declared as text size field

## Demo source

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[histogram](link)
