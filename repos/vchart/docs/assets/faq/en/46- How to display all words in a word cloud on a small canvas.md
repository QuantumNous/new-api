---
title: 70. How to display all words in a small canvas using vchart word cloud?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Title

How to display all words in a small canvas using vchart word cloud?</br>
# Description

When the number of words in vchart word cloud is large and the canvas size is not large enough, only a part of the words can be displayed. How can we display all the words?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KzqTbOLL2otyqox9BUzcJzBLnNg.gif' alt='' width='1108' height='968'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/.gif' alt='' width='578' height='566'>

# Solution

The word cloud has a configuration `fontSizeRange` that controls the size range of words. The default value is `[20, 40]`. If you want the text to automatically adapt to the canvas size and fill the entire canvas, you can set it to `auto`.</br>
Reference: [VisActor](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FwordCloudChart%23fontWeightRange)</br>
# Code Example

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
# Result

After running the code, all the text is displayed (of course, the text has become smaller).</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WmUAbesf6oiKBBxZzZGcfRhBnoc.gif' alt='' width='578' height='566'>

Online demo: [https://codesandbox.io/p/sandbox/wordcloud-fontsizerange-x4cflw?file=%2Fsrc%2Findex.ts%3A12%2C3-12%2C16](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fwordcloud-fontsizerange-x4cflw%3Ffile%3D%252Fsrc%252Findex.ts%253A12%252C3-12%252C16)</br>
# Related Documents

*  VChart word cloud `fontSizeRange` configuration: [VisActor](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FwordCloudChart%23fontWeightRange)</br>
*  VChart github: [GitHub - VisActor/VChart: VChart, more than just a cross-platform charting library, but also an expressive data storyteller.](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>