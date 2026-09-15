---
category: examples
group: word chart
title: Word Cloud Text Formatting
keywords: wordCloud,text,distribution
order: 14-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-format.png
option: wordCloudChart
---

# Word Cloud Text Formatting

You can modify the text display content with a custom function.

## Key Configuration

- The `nameField` attribute is declared as the text field
- The `valueField` attribute is declared as the text size field
- The `word.formatMethod` attribute is the custom format function declared for the text. This configuration can modify the display content of the word cloud without changing the original data. It will not affect tooltips or other native interactions and events.

## Demo source

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials
