---
title: 99. How the word cloud fills the outer container display</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to display a word cloud on top of the outer container?</br>


## Description

We have a relatively small scene displaying word clouds, hoping to make the word cloud fill the entire container as much as possible. I tried the official website, but it seems that it cannot fill the container</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RQMobX6gHoBSMKxfBBbcxKrgnDd.gif' alt='' width='1004' height='444'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AG3KbAICyo6MVpx16vpcGW8YnSc.gif' alt='' width='2426' height='1248'>

## Solution

This is because in VChart, the word cloud is defaulted to use `'circle ' `circular markShape mask graphics, if you want to fill the container as much as possible, you can use `'rect' `shape.</br>
## Code example

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
## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AM81bUGvYoOMGFxDg7IcHL2CnUe.gif' alt='' width='800' height='600'>



## Related Documents

*  Tutorial: https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/WordCloud</br>
*  API：https://visactor.io/vchart/option/wordCloudChart#type</br>
*  Github：https://github.com/VisActor/VChart/</br>



