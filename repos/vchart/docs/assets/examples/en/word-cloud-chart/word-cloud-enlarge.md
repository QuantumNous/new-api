---
category: examples
group: word chart
title: Word Cloud Auto-fit to Canvas
keywords: wordCloud,text,distribution
order: 14-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81703.png
option: wordCloudChart
---

# Word Cloud Auto-fit to Canvas

Enlarge the font size to fit the canvas width and height when there are fewer words.

## Key option

- The `nameField` property is set as the text field
- The `valueField` property is set as the font size field
- The `wordCloudConfig.zoomToFit` property is set for the adaptive scaling configuration of the word cloud; `enlarge`: when enabled, the font size will be enlarged to fit the canvas width and height when there are fewer words, and you can set the maximum font size with `fontSizeLimitMax`, which will be defaulted to fill the canvas

## Demo source

```javascript livedemo
const spec = {
  type: 'wordCloud',
  nameField: 'name',
  valueField: 'value',
  wordCloudConfig: {
    zoomToFit: {
      enlarge: true,
      fontSizeLimitMax: 20
    }
  },
  data: {
    name: 'baseData',
    values: [
      {
        name: '螺蛳粉',
        value: 957
      },
      {
        name: '钵钵鸡',
        value: 942
      },
      {
        name: '板栗',
        value: 842
      },
      {
        name: '胡辣汤',
        value: 828
      },
      {
        name: '关东煮',
        value: 665
      },
      {
        name: '羊肉汤',
        value: 627
      },
      {
        name: '热干面',
        value: 574
      }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorials

[Bar Chart](link)
