---
category: examples
group: word chart
title: Word Cloud without Size Field Configuration
keywords: wordCloud, text, distribution
order: 14-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-no-valueField.png
---

# Word Cloud without Size Field Configuration

When the text size field is not configured, all text is the same size by default.

## Key option

- Set the `nameField` attribute to the text field
- Set the `valueField` attribute to the text size field; if not configured, all text sizes will be the same by default.

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
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

[Bar Chart](link)
