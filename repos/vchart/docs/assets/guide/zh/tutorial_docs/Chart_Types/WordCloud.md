# 词云

[\[配置项手册\]](../../../option/wordCloudChart)

## 简介

词云，又称为标签云、文字云，是一种将文字数据以图片的形式表现出来的可视化方法。在词云中，一个词出现的频率越高，它在云中的显示字体就越大；反之，频率越低的字体越小。通过词云，用户可以直观地看到文字数据中出现频率较高的内容，从而快速获取数据的关键信息。

### 词云 和 形状词云:

在 VChart 中，"词云" 和 "形状词云"有着不同的布局算法逻辑，所以对应配置也会略有不同，不同配置在`wordCloudChart.wordCloudConfig` 和 `wordCloudChart.wordCloudShapeConfig`中有所体现。
那么如何知道自己配置的是"词云" 还是 "形状词云"呢？
当`wordCloudChart.maskShape`为配置或配置为内置形状时，视作"词云"，否则为"形状词云"。

## 图表构成

词云由文字图元、提示信息及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dfd203ff5e337abea49411b07.png)

文字图元为词云的基本要素，相关的绘制配置必不可少:

- `wordCloudChart.type`: 图表类型，词云的类型为`'wordCloud'`
- `wordCloudChart.data`: 图表绘制的数据源
- `wordCloudChart.nameField`: 文本字段，映射文字图元的文本
- `wordCloudChart.valueField`: 数值字段，映射文字图元的大小

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `wordCloudChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../option/wordCloudChart#tooltip)
- 更多组件配置见[VChart wordCloudChart 配置](../../option/wordCloudChart)

## 快速上手

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

### 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段

## 词云特性

### 数据

#### 数据结构

- 一个`离散` 字段，如: `name`，映射文字文本
- 一个`数值`字段，如: `value`，映射文字大小

一组产品类别和销售额的数据定义如下：

```ts
data: [
  {
    name: 'wordCloud',
    values: [
      {
        name: '数码产品',
        value: 20
      },
      {
        name: '日用品',
        value: 50
      },
      {
        name: '食品',
        value: 80
      }
    ]
  }
];
```

#### 特殊数据场景一: 文本过长

数据中有超长文本时, 超出画布的文本部分被裁剪, 而整个文本非不显示。
可以通过`wordCloudConfig.drawOutOfBound`属性声明超出画布的超长文本处理方式；`clip`: 绘制超长文本，超出画布的部分裁剪掉; `hidden`: 不绘制超长文本

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

#### 特殊数据场景二: 文字过少

当单词数量较少时会对文字进行放大以适应画布宽高

- `wordCloudConfig.zoomToFit` 属性声明为词云的自适应缩放配置; `enlarge`: 开启时, 当单词数量较少时会对文字进行放大以适应画布宽高, 可通过`fontSizeLimitMax`来设置最大字号, 默认铺满画布

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

#### 特殊数据场景三: 文字过多

`wordCloudConfig.zoomToFit` 属性声明为词云的自适应缩放配置; `shrink`: 开启时, 当单词放置不下时会对画布进行整体缩放以放置尽量多的单词, 可通过`fontSizeLimitMin`来设置最小字号，默认为 0，即放下所有单词

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

### 文本格式化

可以用自定义函数的方式修改文本显示内容。
`word.formatMethod` 属性声明为文字的自定义格式函数, 该配置可以修改词云文字的显示内容，不会修改原始数据，不会影响 tooltip 等原生交互与事件

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

### 文字随机角度

如果希望文字在布局时自带随机角度，可以通过`wordCloudChart.rotateAngles`进行配置，该数组中可以添加可选的随机角度。

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

### 布局模式

在 VChart 中提供三种布局方式，使用`wordCloudChart.wordCloudConfig.layoutMode`可进行配置。

- `'fast'`: 快速布局，布局速度快但不保证效果，用于小程序 & 小组件环境
- `'grid'`: 基于 grid 像素布局
- `'default'`: 基于像素布局

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

## 形状词云特性

### 数据

#### 数据结构

同[词云](../WordCloud#词云特性)

### 形状配置为 url 图片

通过`wordCloudChart.maskShape`可以配置词云的形状，支持图片 url 形式。

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

### 指定颜色映射

通过配置颜色列表自定义核心词和填充词的颜色映射。
在`wordCloudChart.colorList`和`wordCloudChart.wordCloudShapeConfig.fillingColorList`中分别可以指定核心词和填充词的随机颜色数组

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
