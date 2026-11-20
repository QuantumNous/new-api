---
title: 70.词云如何在小画布上显示所有词</br>
---
# 问题标题

词云如何在小画布上显示所有词</br>
# 问题描述

vchart词云在词的数量很多，而画布大小不够大的情况下，只能显示一部分词。如何让所有词都能显示出来呢？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Xhahbic4kolWO7xxGyJck5CZn6e.gif' alt='' width='1108' height='968'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/W3QGbVr7eoEYhkxJ9MOcskranUe.gif' alt='' width='578' height='566'>

# 解决方案

词云有一个配置`fontSizeRange`可以控制词的大小范围，默认值为`[20,40]`，如果希望文字自动适应画布大小并占满整个画布的话，可以将其配置为`auto`</br>
可以参考：https://visactor.io/vchart/option/wordCloudChart#fontWeightRange</br>
# 代码示例  

```
const spec = {
  width: 300,
  height: 300,
  type: 'wordCloud',
  nameField: 'name',
  valueField: 'value',
  maskShape: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/shape_motuo_mini.png',
  fontSizeRange: 'auto',
  data: [
    {
      name: 'source',
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
        },
        {
          name: '肠粉',
          value: 564
        },
        {
          name: '北京烤鸭',
          value: 554
        },
        {
          name: '龟苓膏',
          value: 540
        },
        {
          name: '米粉',
          value: 513
        },
        {
          name: '灌肠',
          value: 499
        },
        {
          name: '藕粉',
          value: 499
        },
        {
          name: '烤冷面',
          value: 495
        },
        {
          name: '炸酱面',
          value: 487
        },
        {
          name: '臭豆腐',
          value: 484
        },
        {
          name: '沙县小吃',
          value: 482
        },
        {
          name: '重庆小面',
          value: 482
        },
        {
          name: '冒菜',
          value: 479
        },
        {
          name: '醪糟',
          value: 462
        },
        {
          name: '肉夹馍',
          value: 456
        },
        {
          name: '酸辣粉',
          value: 456
        },
        {
          name: '驴打滚',
          value: 456
        },
        {
          name: '煎饼果子',
          value: 443
        },
        {
          name: '驴肉火烧',
          value: 443
        },
        {
          name: '小笼包',
          value: 426
        },
        {
          name: '烧麦',
          value: 425
        },
        {
          name: '卤煮',
          value: 422
        },
        {
          name: '油条',
          value: 414
        },
        {
          name: '桂林米粉',
          value: 414
        },
        {
          name: '兰州拉面',
          value: 409
        },
        {
          name: '双皮奶',
          value: 408
        },
        {
          name: '锅盔',
          value: 403
        },
        {
          name: '羊肉泡馍',
          value: 403
        },
        {
          name: '凉皮',
          value: 402
        },
        {
          name: '糍粑',
          value: 397
        },
        {
          name: '豆皮',
          value: 388
        },
        {
          name: '粘豆包',
          value: 388
        },
        {
          name: '过桥米线',
          value: 385
        },
        {
          name: '叉烧',
          value: 375
        },
        {
          name: '豆腐脑',
          value: 374
        },
        {
          name: '豆汁',
          value: 363
        },
        {
          name: '麻花',
          value: 363
        },
        {
          name: '春卷',
          value: 354
        },
        {
          name: '锅贴',
          value: 349
        },
        {
          name: '韭菜盒子',
          value: 349
        },
        {
          name: '面筋',
          value: 346
        },
        {
          name: '南瓜饼',
          value: 343
        },
        {
          name: '炒肝',
          value: 341
        },
        {
          name: '文昌鸡',
          value: 338
        }
      ]
    }
  ]
}; 
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# 结果展示

代码运行后，所有文字都显示出来了（当然文字也变小了）</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JGDYbsF7foyvalxousacnXginDg.gif' alt='' width='522' height='520'>

在线demo：https://codesandbox.io/p/sandbox/wordcloud-fontsizerange-x4cflw?file=%2Fsrc%2Findex.ts%3A12%2C3-12%2C16</br>
# 相关文档

*  VChart 词云的`fontSizeRange`配置：https://visactor.io/vchart/option/wordCloudChart#fontWeightRange</br>
*  VChart github：https://github.com/VisActor/VChart</br>