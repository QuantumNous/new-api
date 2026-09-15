---
category: examples
group: word chart
title: Word Cloud with Random Angle
keywords: wordCloud,text,distribution
order: 14-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81700.png
option: wordCloudChart
---

# Word Cloud with Random Angle

Text angle is displayed randomly.

## Key Configuration

- `nameField` attribute is declared as the text field for words
- `valueField` attribute is declared as the text size field
- `rotateAngles` attribute is declared as the random range for text rotation angles, i.e., the text rotation angle is randomly selected from this array

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();
const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  rotateAngles: [0, 90],
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
