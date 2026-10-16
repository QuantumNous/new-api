---
category: examples
group: word chart
title: 形状词云图随机旋转角
keywords: wordCloud,text,distribution
order: 14-9
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-shape-rotate.png
option: wordCloudChart
---

# 形状词云图随机旋转角

文字的角度随机展示

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `maskShape` 属性声明为形状轮廓
- `rotateAngles` 属性声明为核心词旋转角度的随机取范围, 即核心词旋转角度从该数组中随机选取
- `wordCloudShapeConfig.rotateAngles` 属性声明为填充词旋转角度的随机取范围, 即填充词旋转角度从该数组中随机选取

## 代码演示

```javascript livedemo
const spec = {
  type: 'wordCloud',
  nameField: 'name',
  valueField: 'value',
  maskShape: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/shape_motuo_mini.png',
  rotateAngles: [0, 90],
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
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
