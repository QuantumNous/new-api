---
category: examples
group: word chart
title: Word Cloud Text Clipping
keywords: wordCloud,text,distribution
order: 14-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-clip.png
option: wordCloudChart
---

# Word Cloud Text Clipping

When there is extra-long text in the data, the part of the text that exceeds the canvas is clipped, rather than not displaying the entire text.

## Key Configuration

- `nameField` attribute declares the text field
- `valueField` attribute declares the text size field
- `wordCloudConfig.drawOutOfBound` attribute declares the handling method for extra-long text that exceeds the canvas; `clip`: draw the extra-long text, and the part that exceeds the canvas is clipped; `hidden`: do not draw the extra-long text

## Demo source

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
