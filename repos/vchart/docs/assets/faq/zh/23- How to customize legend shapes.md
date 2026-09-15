---
title: 76. 如何自定义图例形状？</br>
---
## 问题标题

如何自定义图例形状？</br>


## 问题描述

我这里需要绘制一个包含图例的饼图，希望图例项对应的形状是扇形的，请问应该如何实现呢？另外再问一下应该如何设置图例的位置呀？</br>


## 解决方案

图例项对应的形状可以通过 `legends.item.shape.style.symbolType` 进行配置。symbolType 的内容可以是 vchart 内置的形状，例如 'rect'、'circle' 等，同时用户也可以设置自定义的 svg path 以实现任意的形状。</br>
```
  legends: {
    visible: true,
    item: {
      shape: {
        style: {
          symbolType: 'rect'
          // symbolType: 'M -1 1 L 0 0 L 1 1'
        }
      }
    }
  }</br>
```
图例的位置通过 `legends.orient` 进行配置，可选的位置包括：left、right、top、bottom：</br>
```
  legends: {
    visible: true,
    orient: 'right'
  }</br>
```


## 代码示例 

```
const data = [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
];
let totalValue = 0;
data.forEach(obj => (totalValue += obj.value));
const map = {};
data.forEach(obj => {
  map[obj.category] = `${((obj.value / totalValue) * 100).toFixed(2)}%`;
});

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  categoryField: 'category',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    item: {
      shape: {
        style: {
          symbolType: 'rect'
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TWpZbH5oboQV4Yx3mEWcsr2XnOd.gif' alt='' width='1712' height='1086'>



## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  Legend shape：https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#item.shape.style</br>
*  Legend orient：https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#orient</br>

