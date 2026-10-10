---
category: examples
group: word chart
title: Word Cloud Text Scaling
keywords: wordCloud,text,distribution
order: 14-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-shrink.png
option: wordCloudChart
---

# Word Cloud Text Scaling

Canvases will be scaled overall to fit as many words as possible when words cannot be placed

## Key Configuration

- `nameField` attribute declares the text field for words
- `valueField` attribute declares the text size field
- `wordCloudConfig.zoomToFit` attribute declares the adaptive scaling configuration for the word cloud; `shrink`: when enabled, the canvas will be scaled overall to fit as many words as possible when words cannot be placed, and the minimum font size can be set through `fontSizeLimitMin`, which defaults to 0, meaning all words can be placed

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  wordCloudConfig: {
    zoomToFit: {
      shrink: true,
      fontSizeLimitMin: 5
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

[Bar Chart](link)
