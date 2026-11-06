---
title: 19. 图表如何导出图片？</br>
---
## 问题标题

请问是否有图表导出图片的api？</br>


## 问题描述

图表能否直接转成高清度图片保存？是否有相关的api？</br>


## 解决方案 

您有2种方法可以将图表保存成图片：</br>
1. 在图表上直接右键保存或复制</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Mk3Ebs6gOoBE2exUx1XczYDinQ7.gif' alt='' width='1700' height='960'>

1. 如果您需要在软件项目中获取图片，我们针对不同代码环境有不同的接口</br>
### **getDataURL**



**异步方法**返回一个包含图片展示的 data URI。</br>


```
getDataURL: () => Promise<any>;</br>
```


### **exportImg**



**异步方法** 导出图表图片，只支持浏览器端，同时参数 `name` 可以为图片进行命名。</br>


```
/**
 * **异步方法** 导出图表图片，只支持浏览器端。
 * @param name 保存的图片名称
 * @returns
 */
exportImg: (name?: string) => Promise<void>;</br>
```


### **exportCanvas**



导出绘制有图表内容的 canvas ，只支持浏览器端。可以使用这个 canvas 进行二次处理，比如添加水印等。</br>


```
/**
 * 导出绘制了图表内容的 canvas
 * @returns HTMLCanvasElement
 * @since 1.5.2
 */
exportCanvas: () => HTMLCanvasElement | undefined;</br>
```


### **getImageBuffer**



目前仅支持 node 环境，用于 node 端的图片导出。</br>


```
 getImageBuffer: () => void;</br>
```


详情可见: https://www.visactor.io/vchart/api/API/vchart</br>
## 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 等待动画执行之后或关闭动画后, exportImg
setTimeout(() => {
  vchart.exportImg('vchart')
}, 1000)

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

在线效果参考：https://codesandbox.io/p/sandbox/exportimg-2zvg62?file=%2Fsrc%2Findex.ts%3A58%2C26</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H5l5bt13xoNWwRx9ytQcqxmxnVf.gif' alt='' width='2052' height='1010'>





## 相关文档

相关api：https://www.visactor.io/vchart/api/API/vchart</br>
github：https://github.com/VisActor/VChart</br>



