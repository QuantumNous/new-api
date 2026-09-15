# 图表的轴标签如何做截断，换行等效果？

## 问题描述

类似[这样](https://www.visactor.io/vchart/demo/bar-chart/basic-bar)这样的条形图，

![bar chart](/vchart/faq/24-0.png)

当轴标签非常长的时候，怎么实现换行？截断相关效果

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，在 VChart 中只需要配置 axes 中对应轴的`label`相关配置：

- 通过`formatMethod`返回数组，可以实现自定义换行
- 通过`style.maxLineWidth`可以实现自动截断
- 通过`style.ellipsis`可以设置省略符

![code](/vchart/faq/24-1.png)

## 代码示例

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple https://www.apple.com/',
          value: 214480
        },
        {
          name: 'Google https://www.google.com.hk/',
          value: 155506
        },
        {
          name: 'Amazon https://www.amazon.com/',
          value: 100764
        },
        {
          name: 'Microsoft https://www.microsoft.com/',
          value: 92715
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
    },
    {
      orient: 'left',
      label: {
        formatMethod: (text, datum) => {
          return text.split(' ');
        },
        style: {
          maxLineWidth: 100,
          ellipsis: '~'
        }
      }
    }
  ],
  label: {
    visible: true
  }
};
```

## 结果展示

[在线效果参考](https://codesandbox.io/s/axis-label-auto-limit-pnsvzl)

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple https://www.apple.com/',
          value: 214480
        },
        {
          name: 'Google https://www.google.com.hk/',
          value: 155506
        },
        {
          name: 'Amazon https://www.amazon.com/',
          value: 100764
        },
        {
          name: 'Microsoft https://www.microsoft.com/',
          value: 92715
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
    },
    {
      orient: 'left',
      label: {
        formatMethod: (text, datum) => {
          return text.split(' ');
        },
        style: {
          maxLineWidth: 100,
          ellipsis: '~'
        }
      }
    }
  ],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 相关文档

- [坐标轴 demo](https://www.visactor.io/vchart/demo/axis/animation)
- [坐标轴教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [相关配置](https://www.visactor.io/vchart/option/barChart#axes-band.label.style.ellipsis)
- [github](https://github.com/VisActor/VChart)
