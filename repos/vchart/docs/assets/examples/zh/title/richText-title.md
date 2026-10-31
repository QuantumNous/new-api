---
category: demo
group: title
title: 富文本标题
keywords: title
order: 24-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/title/richText-title.png
option: lineChart#title
---

# 富文本标题

标题支持使用富文本，用来配置更复杂的文本样式。

## 关键配置

- `textType` 属性声明富文本类型。
- `text` 属性配置富文本内容。可声明文本内容、文字大小、文字样式等。文本内容支持转义字符，例如换行 `\n` 。

## 代码演示

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
