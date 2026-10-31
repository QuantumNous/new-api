---
category: demo
group: title
title: Rich Text Title
keywords: title
order: 24-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/title/richText-title.png
option: lineChart#title
---

# Rich Text Title

Titles support rich text, which can be used to configure more complex text styles.

## Key Configuration

- `textType` property specifies text type is 'rich'.
- `text` property specifies the rich text configuration. You can declare text content, text size, text styles, etc. Text content supports escape characters, such as line breaks `\n`.

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  title: {
    visible: true,
    align: 'left',
    verticalAlign: 'top',
    orient: 'top',
    textType: 'rich',
    text: [
      {
        text: 'Chinese Character Test',
        fontSize: 30,
        textAlign: 'center',
        textDecoration: 'underline',
        stroke: '#0f51b5'
      }
    ],
    subtextType: 'rich',
    subtext: [
      {
        text: 'Mapbox',
        fontWeight: 'bold',
        fontSize: 30,
        fill: '#3f51b5'
      },
      {
        text: 'was established in 2010 with the goal of providing an alternative solution',
        fill: '#000'
      },
      {
        text: 'alternative solution',
        fontStyle: 'italic',
        fill: '#3f51b5'
      },
      {
        text: ' to Google Maps. At that time, Google Map',
        fill: '#000'
      },
      {
        text: 'Map',
        textDecoration: 'line-through',
        fill: '#000'
      },
      {
        text: '[1]',
        script: 'super',
        fill: '#000'
      },
      {
        text: 'almost monopolized the online mapping business. However, within Google Maps, there was hardly any possibility for customization, and there were no tools available for map creators to create maps according to their own vision',
        fill: '#000'
      },
      {
        text: '.\n',
        fill: '#30ff05'
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

Attach links to tutorials or API documentation related to this demo's configuration.

```

```
