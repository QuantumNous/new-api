# 漏斗图

[\[配置项\]](../../../option/funnelChart)

## 简介

漏斗图，形如“漏斗”，用于单流程分析，在开始和结束之间由 N 个流程环节组成，通常这 N 个流程环节，有逻辑上的顺序关系。

## 图表构成

漏斗图由具有层级关系的多边形图元（该多边形默认是梯形，也可以是矩形，视用户配置而定）、转化层、标签等基本元素及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/4d877ccaf041cff1618de3405.png)

多边形图元为漏斗图的基本要素，相关的绘制配置必不可少:

- `funnelChart.type`: 图表类型，漏斗图的类型为`'funnel'`
- `funnelChart.data`: 图表绘制的数据源
- `funnelChart.categoryField`: 分类字段，映射为不同图元
- `funnelChart.valueField`: 数值字段，映射为矩形图元的大小或梯形图元的顶边及底边的长度

转化层、标签等辅助元素，仅在特定配置下展示且在不同配置下展示形式略有不同：

- `funnelChart.label`: 漏斗图标签配置，'`visible: true'`时展示。
- `funnelChart.isTransform`: 是否展示转化层，该配置为'`true'`时展示。

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `funnelChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/funnelChart#tooltip)
- 更多组件配置见[VChart funnelChart 配置](../../../option/funnelChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `type: funnel` 指定图表类型为漏斗图
- `categoryField` 指定分类字段
- `valueField` 指定值字段

## 漏斗图特性

### 数据

- 一个`离散` 字段，如: `name` ，表示不同漏斗层
- 一个`数值`字段，如: `value` ，表示不同漏斗层代表的数值

需要注意的是，由于漏斗图表示不同流程的转化关系，所以理论上来说数据是有序的，彼此之间有逻辑上的顺序关系，阶段最好大于 3 个。

```ts
data: [
  {
    name: 'funnel',
    values: [
      {
        name: 'Step1',
        value: 100
      },
      {
        name: 'Step2',
        value: 80
      },
      {
        name: 'Step3',
        value: 60
      }
    ]
  }
];
```

### 漏斗图布局

#### 转化漏斗图

当配置`funnelChart.isTransform: true`时，漏斗图将在层与层之间新增转化层并自动计算转化率，转化率 = 下层数据 / 上层数据，它表示下一步骤相比上一步骤数值上的变化。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isTransform: true,
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 5676,
          name: 'Sent'
        },
        {
          value: 3872,
          name: 'Viewed'
        },
        {
          value: 1668,
          name: 'Clicked'
        },
        {
          value: 610,
          name: 'Add to Cart'
        },
        {
          value: 565,
          name: 'Purchased'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage of the customers have dropped from the sales process'
  },
  label: {
    visible: true
  },
  transformLabel: {
    visible: true
  },
  outerLabel: {
    position: 'right',
    visible: true
  },
  legends: {
    visible: true,
    orient: 'top',
    padding: {
      bottom: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 漏斗图对齐方式

可以通过`funnelChart.funnelAlign: 'left' | 'right' | 'center'`指定漏斗图朝向，默认值为`'center'`。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  funnelAlign: 'left',
  isTransform: true,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 漏斗图朝向

可以通过`funnelChart.funnelOrient: 'left' | 'right' | 'top' | 'bottom'`指定漏斗图朝向，默认值为`'top'`。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  funnelOrient: 'right',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图元及样式

#### 漏斗图元形状

漏斗图图元形状默认为梯形，即`funnelChart.shape`默认值为`'trapezoid'`。
在 VChart 中，漏斗图形状还可指定为矩形，即`funnelChart.shape: 'rect'`。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  shape: 'rect',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 漏斗下层尖角

当漏斗图形状为默认的梯形`'trapezoid'`时，可通过`funnelChart.isCone`指定最下层是否有尖角，默认为`true`。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 漏斗层像素间隔

可以通过`funnelChart.gap`指定漏斗层之间的像素间隔，默认值为`0`。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  gap: 10,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 漏斗最大最小宽度

可以通过`funnelChart.maxSize` 和 `funnelChart.minSize`指定漏斗层之间的像素间隔，支持配置像素值和百分比，默认值分别为`'80%'` 和 `0`。

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  maxSize: '60%',
  minSize: 30,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
