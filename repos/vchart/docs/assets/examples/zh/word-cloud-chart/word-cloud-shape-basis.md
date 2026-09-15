---
category: examples
group: word chart
title: 形状词云图
keywords: wordCloud,text,distribution
order: 14-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/word-cloud-chart/word-cloud-shape-basis.png
option: wordCloudChart
---

# 形状词云图

通过自定义词云轮廓的方式增强数据表现力。形状词云中的文本分为核心词和填充词, 核心词按照数据进行文本和文字大小的映射, 并放置在轮廓中的文字图元; 填充词是为了保持轮廓形状而补充的文字图元

## 关键配置

- `nameField` 属性声明为文字文本字段
- `valueField` 属性声明为文字大小字段
- `maskShape` 属性声明为形状轮廓, 支持图片 url 形式 及 形状字符串形式

## 代码演示

```javascript livedemo
const spec = {
  type: 'wordCloud',
  maskShape: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/log.jpeg',
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  data: [
    {
      name: 'data',
      values: [
        {
          challenge_name: '刘浩存',
          sum_count: 957
        },
        {
          challenge_name: '刘昊然',
          sum_count: 942
        },
        {
          challenge_name: '喜欢',
          sum_count: 842
        },
        {
          challenge_name: '真的',
          sum_count: 828
        },
        {
          challenge_name: '四海',
          sum_count: 665
        },
        {
          challenge_name: '好看',
          sum_count: 627
        },
        {
          challenge_name: '评论',
          sum_count: 574
        },
        {
          challenge_name: '好像',
          sum_count: 564
        },
        {
          challenge_name: '沈腾',
          sum_count: 554
        },
        {
          challenge_name: '不像',
          sum_count: 540
        },
        {
          challenge_name: '多少钱',
          sum_count: 513
        },
        {
          challenge_name: '韩寒',
          sum_count: 513
        },
        {
          challenge_name: '不知道',
          sum_count: 499
        },
        {
          challenge_name: '感觉',
          sum_count: 499
        },
        {
          challenge_name: '尹正',
          sum_count: 495
        },
        {
          challenge_name: '不看',
          sum_count: 487
        },
        {
          challenge_name: '奥特之父',
          sum_count: 484
        },
        {
          challenge_name: '阿姨',
          sum_count: 482
        },
        {
          challenge_name: '支持',
          sum_count: 482
        },
        {
          challenge_name: '父母',
          sum_count: 479
        },
        {
          challenge_name: '一条',
          sum_count: 462
        },
        {
          challenge_name: '女主',
          sum_count: 456
        },
        {
          challenge_name: '确实',
          sum_count: 456
        },
        {
          challenge_name: '票房',
          sum_count: 456
        },
        {
          challenge_name: '无语',
          sum_count: 443
        },
        {
          challenge_name: '干干净净',
          sum_count: 443
        },
        {
          challenge_name: '为啥',
          sum_count: 426
        },
        {
          challenge_name: '爱情',
          sum_count: 425
        },
        {
          challenge_name: '喜剧',
          sum_count: 422
        },
        {
          challenge_name: '春节',
          sum_count: 414
        },
        {
          challenge_name: '剧情',
          sum_count: 414
        },
        {
          challenge_name: '人生',
          sum_count: 409
        },
        {
          challenge_name: '风格',
          sum_count: 408
        },
        {
          challenge_name: '演员',
          sum_count: 403
        },
        {
          challenge_name: '成长',
          sum_count: 403
        },
        {
          challenge_name: '玩意',
          sum_count: 402
        },
        {
          challenge_name: '文学',
          sum_count: 397
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
