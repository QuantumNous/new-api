---
title: 19. How to export images from charts?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

Is there an api for exporting pictures from charts?</br>
## Description

Can charts be directly converted into high definition images and saved? Is there a relevant API?</br>


## Solution 

You have two ways to save a chart as an image:</br>
Right-click directly on the chart to save or copy</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Q37WbNuJioQHHpx7kZcckgTVnbc.gif' alt='' width='1280' height='722'>

2. If you need to get pictures in a software project, we have different interfaces for different code environments</br>
### **getDataURL**



**asynchronous method**Returns a data URI that contains the image display.</br>


```
getDataURL: () => Promise<any>;</br>
```


### **exportImg**



**asynchronous method** Export chart images, only support browser side, and parameters at the same time `name` Pictures can be named.</br>


```
/**
 * **Asynchronous method** Export chart pictures, only supports browser side.
 * @param name the saved image name
 * @returns
 */
exportImg: (name?: string) => Promise<void>;</br>
```


### **exportCanvas**



Exporting canvas with chart content is only supported on the browser side. You can use this canvas for secondary processing, such as adding watermarks, etc.</br>


```
/**
 * Export the canvas with the chart content drawn
 * @returns HTMLCanvasElement
 * @since 1.5.2
 */
exportCanvas: () => HTMLCanvasElement | undefined;</br>
```


### **getImageBuffer**



Currently only the node environment is supported for node-side image export.</br>


```
 getImageBuffer: () => void;</br>
```
## Code Example

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

// After waiting for the animation to execute or after closing the animation, exportImg
setTimeout(() => {
  vchart.exportImg('vchart')
}, 1000)

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results

Online demo：https://codesandbox.io/p/sandbox/exportimg-2zvg62?file=%2Fsrc%2Findex.ts%3A58%2C26</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UHqqbx16NowKsmx3JujcAtS3nfb.gif' alt='' width='2052' height='1010'>



## Related Documentation

Related api：https://www.visactor.io/vchart/api/API/vchart</br>
github：https://github.com/VisActor/VChart</br>



