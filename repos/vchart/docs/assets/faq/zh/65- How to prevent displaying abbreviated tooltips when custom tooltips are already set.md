---
title: 37. 如何禁止被缩略的 tooltip 展示，已经自定义 tooltip 不需要重复展示</br>
---
## 问题标题

如何禁止被缩略的 tooltip 展示，已经自定义 tooltip 不需要重复展示</br>


## 问题描述

如何禁止被缩略的 tooltip 展示，已经自定义 tooltip 不需要重复展示，如下所示：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/CTNDb8GJ8o1LgvxYCMgc519ynHg.gif' alt='' width='574' height='742'>

## 解决方案 

VChart 内会对超长的文本进行自动省略，同时会默认提供悬浮展示 poptip 显示完整文本的交互，如果想要关闭，可以在图表初始化的时候，在构造函数的参数中设置 poptip: false，如下：</br>


```
const vchart = new VChart(spec, { 
  // ...
  poptip: false, // 关闭省略文本的 poptip
});</br>
```


## 代码示例  

```
const spec = {
  type: 'bar',
  width: 300,
  height: 250,
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'AppleAppleAppleApple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    }
  ],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, poptip: false });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 相关文档

*  API：https://visactor.io/vchart/api/API/vchart#options</br>
*  Github：https://github.com/VisActor/VChart/</br>



