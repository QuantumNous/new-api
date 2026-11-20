---
title: 99. 词云如何顶满外层容器显示</br>
---
## 问题标题

词云如何顶满外层容器显示?</br>


## 问题描述

我们有一个比较小的展示词云的场景，希望能尽量让词云占满整个容器，试了下官方网站好像没法占满容器</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C5jRbsf2tokKkpx9W8XchaJqnFe.gif' alt='' width='1004' height='444'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V6x3bPTXioLTjTxGp6JcXSXmnyg.gif' alt='' width='2426' height='1248'>

## 解决方案 

这个因为在 VChart 中，词云默认是使用 `'circle'` 圆形做了 markShape 遮罩图形，如果想要尽可能铺满容器，可以使用 `'rect'` 形状。</br>
## 代码示例  

```

const spec = {
  type: 'wordCloud',
  nameField: 'Keyword',
  valueField: 'Score',
  data: {
    name: 'baseData',
    values: [ { "Keyword": "预期寿命", "Score": 0.8571 }, { "Keyword": "心率", "Score": 0.8571 }, { "Keyword": "疾病", "Score": 0.7597 }, { "Keyword": "心跳快慢", "Score": 0.5714 }, { "Keyword": "心跳", "Score": 0.5714 }, { "Keyword": "郭艺芳", "Score": 0.5624 }, { "Keyword": "陈清勇", "Score": 0.5624 }, { "Keyword": "风险因素", "Score": 0.4874 }, { "Keyword": "心动过速", "Score": 0.4874 }, { "Keyword": "寿命", "Score": 0.3849 }, { "Keyword": "快慢", "Score": 0.3844 }, { "Keyword": "生活习惯", "Score": 0.2857 }, { "Keyword": "河北省人民医院", "Score": 0.2857 }, { "Keyword": "四川大学华西医院", "Score": 0.2186 }, { "Keyword": "华西医院", "Score": 0.2121 }, { "Keyword": "阿尔茨海默病", "Score": 0.2067 }, { "Keyword": "人群", "Score": 0.1984 }, { "Keyword": "痴呆", "Score": 0.19 }, { "Keyword": "研究", "Score": 0.1761 }, { "Keyword": "健康", "Score": 0.1754 }, { "Keyword": "习惯", "Score": 0.1709 }, { "Keyword": "医院", "Score": 0.1664 }, { "Keyword": "风险", "Score": 0.1647 }, { "Keyword": "心内科", "Score": 0.16 }, { "Keyword": "生活", "Score": 0.158 }, { "Keyword": "工作", "Score": 0.1554 }, { "Keyword": "心血管疾病", "Score": 0.1299 }, { "Keyword": "咖啡", "Score": 0.0974 }, { "Keyword": "志飞", "Score": 0.0974 }, { "Keyword": "中国妇女报", "Score": 0.0974 }, { "Keyword": "人民医院", "Score": 0.0913 } ]
  },
  maskShape: 'rect',
  width: 400,
  height: 300,
  background: '#cccc',
  padding: 10
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EGuQbvlF1oVfi3xt3KccgkYqn6e.gif' alt='' width='800' height='600'>



## 相关文档

*  教程：https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/WordCloud</br>
*  API：https://visactor.io/vchart/option/wordCloudChart#type</br>
*  Github：https://github.com/VisActor/VChart/</br>



