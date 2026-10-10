---
title: 41. How VChart line charts support emphasizing a certain point</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# **Title**

Does vchart support emphasizing a certain point in a line chart?</br>
# **Description**

I'm using vchart to create a line chart and I'm wondering if it's possible to emphasize a certain point in the chart.</br>
# **Solution**

Yes, it's possible to achieve this. You can use the `opacity` and `size` options to highlight a certain point based on its data. By setting the opacity and size of the point, it will stand out more.</br>
You can refer to the following link for more information on how to configure the mark function of a chart element: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark](https%3A%2F%2Fvisactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FSeries%2FMark)</br>
# **Code Example**

```
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  animationAppear: {
    duration: 1500,
    easing: 'linear'
  },
  point: {
    style: {
      opacity: (datum) => {
        return datum.type === 'Eyeliner' && datum.country === 'EU' ? 1 : 0.6
      },
      size: (datum) => {
        return datum.type === 'Eyeliner' && datum.country === 'EU' ? 10 : 6
      },
      stroke: false
    }
  },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();</br>
```
# **Result**

After running the code, the points in the Eyeliner dimension of the EU line segment are emphasized.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EqFfbkzosofFfbxh4DHcCh4VnEd.gif' alt='' width='1268' height='1054'>

Online demo: [https://codesandbox.io/p/sandbox/line-chart-single-selected-forked-4px87p?file=%2Fsrc%2Findex.ts%3A3%2C1](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Fline-chart-single-selected-forked-4px87p%3Ffile%3D%252Fsrc%252Findex.ts%253A3%252C1)</br>
# **Related Documents**

*  VChart mark function configuration: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark](https%3A%2F%2Fvisactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FSeries%2FMark)</br>
*  VChart Github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>