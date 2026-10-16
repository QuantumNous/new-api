# Word Cloud

[\[Options Manual\]](../../../option/wordCloudChart)

## Introduction

A word cloud, also known as a tag cloud or text cloud, is a visualization method that displays text data in the form of an image. In a word cloud, the larger the font of a word, the higher its frequency; conversely, the smaller the font, the lower the frequency. Through the word cloud, users can intuitively see the content with higher frequency in the text data, thus quickly obtaining key information.

### Word Cloud and Shape Word Cloud:

In VChart, "Word Cloud" and "Shape Word Cloud" have different layout algorithm logic, so the corresponding configurations are slightly different, with differences between `wordCloudChart.wordCloudConfig` and `wordCloudChart.wordCloudShapeConfig` configurations.
So how do you know if you've configured a "Word Cloud" or a "Shape Word Cloud"?
When `wordCloudChart.maskShape` is configured or set to a built-in shape, it is considered as "Word Cloud", otherwise it is "Shape Word Cloud".

## Chart Components

The word cloud consists of text elements, tooltips, and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dfd203ff5e337abea49411b07.png)

Text elements are the basic elements of a word cloud, and the following settings are essential:

- `wordCloudChart.type`: Chart type, the type of word cloud is `'wordCloud'`
- `wordCloudChart.data`: Data source for chart drawing
- `wordCloudChart.nameField`: Text field, mapping the text of text elements
- `wordCloudChart.valueField`: Value field, mapping the size of text elements

Tooltips and other components are optional, with default effects and functionalities:

- `wordCloudChart.tooltip`: Tooltip, displayed by default when interacting, for detailed configuration see [VChart Tooltip Component Configuration](../../option/wordCloudChart#tooltip)
- For more component configurations, see [VChart wordCloudChart Configuration](../../option/wordCloudChart)

## Quick Start

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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configurations

- `nameField` property declaration as text field
- `valueField` property declaration as size field

## Word Cloud Features

### Data

#### Data Structure

- A `discrete` field, such as: `name`, maps text content
- A `value` field, such as: `value`, maps text size

A set of product category and sales data is defined as follows:

```ts
data: [
  {
    name: 'wordCloud',
    values: [
      {
        name: 'Digital Products',
        value: 20
      },
      {
        name: 'Daily Necessities',
        value: 50
      },
      {
        name: 'Food',
        value: 80
      }
    ]
  }
];
```

#### Special Data Scenario 1: Long Text

When there is ultra-long text in the data, the part of the text exceeding the canvas will be clipped, and the entire text will not be displayed. It can be handled by the` wordCloudConfig.drawOutOfBound` property declaration for ultra-long text processing out of the canvas; `clip`: Draw ultra-long text, clip the part out of the canvas; `hidden`: Do not draw ultra-long text

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
    // drawOutOfBound: 'hidden'
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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Special Data Scenario 2: Too Few Words

When there are fewer words, the text will be magnified to adapt to the canvas width and height

- `wordCloudConfig.zoomToFit` property declaration for adaptive zoom configuration of the word cloud; `enlarge`: When enabled, the text will be magnified to adapt to the canvas width and height when there are fewer words, and the maximum font size can be set by `fontSizeLimitMax`, default is to fill the entire canvas

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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Special Data Scenario 3: Too Many Words

`wordCloudConfig.zoomToFit` property declaration for adaptive zoom configuration of the word cloud; `shrink`: When enabled, the entire canvas will be scaled down to fit as many words as possible when there is not enough space for words. The minimum font size can be set by `fontSizeLimitMin`, default is 0, i.e., fitting all words

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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Text Formatting

Custom functions can be used to modify the text display content.
`word.formatMethod` property declaration for custom text formatting function, this configuration can modify the display content of word cloud text, without modifying the original data, and without affecting tooltips and other built-in interactions and events

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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Random Text Angle

If you want the text to have a random angle during layout, you can configure `wordCloudChart.rotateAngles`, this array can include optional random angles.

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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Layout Modes

There are three layout modes available in VChart, configurable with `wordCloudChart.wordCloudConfig.layoutMode`.

- `'fast'`: Fast layout, fast layout speed without guaranteed effect, for Mini Program & App Environment
- `'grid'`: Grid-based pixel layout
- `'default'`: Pixel-based layout

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud.json');
const dataWordCloud = await response.json();

const spec = {
  type: 'wordCloud',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',

  wordCloudConfig: {
    layoutMode: 'fast',
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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Shape Word Cloud Features

### Data

#### Data Structure

Same as [Word Cloud](../WordCloud#Word_Cloud_Features)

### Shape Configuration for URL Image

The shape of the word cloud can be configured through `wordCloudChart.maskShape`, which supports image URL format.

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-wordcloud-shape.json');
const dataWordCloudShape = await response.json();

const spec = {
  type: 'wordCloud',
  maskShape: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/log.jpeg`,
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  data: [
    {
      name: 'data',
      values: dataWordCloudShape
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Custom Color Mapping

Configure color list to customize color mapping for core words and filling words.
The random color arrays of core words and filling words can be specified in `wordCloudChart.colorList` and `wordCloudChart.wordCloudShapeConfig.fillingColorList` respectively

```javascript livedemo
const spec = {
  type: 'wordCloud',
  maskShape: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/shape_logo.png`,
  colorList: ['#325AB4'],
  wordCloudShapeConfig: {
    fillingColorList: ['#5BB5BF', '#92C8C6']
  },
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  data: [
    {
      name: 'data',
      values: [
        {
          sum_count: '1458156.9184036255',
          challenge_name: '广东',
          fontStyle: 'normal',
          fontFamily: '报隶-简'
        },
        {
          sum_count: '409147.19856643677',
          challenge_name: '北京',
          hex: 'black',
          fontStyle: 'normal',
          fontFamily: '华文楷体'
        },
        {
          sum_count: '409147.19856643677',
          challenge_name: '北京',
          hex: 'black',
          fontWeight: '900',
          fontStyle: 'italic'
        },
        {
          sum_count: '835974.6672067642',
          challenge_name: '辽宁'
        },
        {
          sum_count: '108141.60027313232',
          challenge_name: '贵州'
        },
        {
          sum_count: '108141.60027313232',
          challenge_name: '贵州'
        },
        {
          sum_count: '1208457.0841751099',
          challenge_name: '黑龙江'
        },
        {
          sum_count: '628965.1919708252',
          challenge_name: '安徽'
        },
        {
          sum_count: '361761.9318008423',
          challenge_name: '重庆'
        },
        {
          sum_count: '627201.8465929031',
          challenge_name: '湖北'
        },
        {
          sum_count: '464225.63437461853',
          challenge_name: '浙江'
        },
        {
          sum_count: '457688.1689968109',
          challenge_name: '陕西'
        },
        {
          sum_count: '179270.02758216858',
          challenge_name: '甘肃'
        },
        {
          sum_count: '666791.6433677673',
          challenge_name: '吉林'
        },
        {
          sum_count: '582450.5663032532',
          challenge_name: '上海'
        },
        {
          sum_count: '723442.2084827423',
          challenge_name: '湖南'
        },
        {
          sum_count: '422328.201543808',
          challenge_name: '云南'
        },
        {
          sum_count: '546903.5310325623',
          challenge_name: '福建'
        },
        {
          sum_count: '273453.012925148',
          challenge_name: '内蒙古'
        },
        {
          sum_count: '1586782.9900550842',
          challenge_name: '山东'
        },
        {
          sum_count: '549906.6289558411',
          challenge_name: '天津'
        },
        {
          sum_count: '409147.19856643677',
          challenge_name: '北京'
        },
        {
          sum_count: '58121.000633239746',
          challenge_name: '宁夏'
        },
        {
          sum_count: '790915.4042472839',
          challenge_name: '河北'
        },
        {
          sum_count: '49863.379943847656',
          challenge_name: '青海'
        },
        {
          sum_count: '377653.828125',
          challenge_name: '广西'
        },
        {
          sum_count: '10015.179809570312',
          challenge_name: '西藏'
        },
        {
          sum_count: '237328.70012283325',
          challenge_name: '江西'
        },
        {
          sum_count: '423878.76944351196',
          challenge_name: '山西'
        },
        {
          sum_count: '107854.41070175171',
          challenge_name: '海南'
        },
        {
          sum_count: '400877.59553718567',
          challenge_name: '四川'
        },
        {
          sum_count: '853574.8028030396',
          challenge_name: '河南'
        },
        {
          sum_count: '653052.960445404',
          challenge_name: '江苏'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
