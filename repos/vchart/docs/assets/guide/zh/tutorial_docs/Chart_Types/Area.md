# 面积图

[\[配置项\]](../../../option/areaChart)

## 简介

面积图以图形方式显示定量数据。 它基于折线图。 通常用颜色，纹理和阴影线强调轴和线之间的区域。 通常，一个面积图会比较两个或多个数量。面积图适用于想要体现在连续自变量下，一组或多组数据的趋势变化以及相互之间的对比，同时也能够观察到数据总量的变化趋势。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523219.png)

## 图表构成

面积图由点图元、线图元、坐标轴及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a04.png)

点图元、线图元为面积图的基本要素，相关的绘制配置必不可少:

- `areaChart.type`: 图表类型，面积图的类型为`'area'`
- `areaChart.data`: 图表绘制的数据源
- `areaChart.xField`: 连续时间间隔或有序类别字段，映射图元的 x 坐标
- `areaChart.yField`: 数值字段，映射图元的 y 坐标

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `areaChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/areaChart#axes)
- `areaChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/areaChart#tooltip)
- 更多组件配置见[VChart areaChart 配置](../../../option/areaChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'area',
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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `type`: 图表类型，面积图的类型为`'area'`
- `xField` 属性声明为连续时间间隔或有序类别字段
- `yField` 属性声明数值字段

## 面积图特性

### 数据

- 一个`离散` 或 `时序` 字段，如: `month`  
  （`时序`字段中的数据仅支持时间戳格式，且在坐标轴中需要配置`axes.type: 'time'`）
- 一个`数值`字段，如: `temperature`

一组月份和温度的数据定义如下：

```ts
data: [
  {
    name: 'area',
    values: [
      {
        month: 'January',
        temperature: 8
      },
      {
        month: 'February',
        temperature: 9
      },
      {
        month: 'March',
        temperature: 11
      },
      {
        month: 'April',
        temperature: 14
      }
    ]
  }
];
```

### 图表布局

#### 堆叠面积图

与堆叠柱状图类似，堆叠面积图不仅能展现同一维度下不同类别的数据差异，还能展现同一维度下不同类别的总和差异。
在 VChart 中，如果需要展示堆叠面积图，需要配置`areaChart.stack: true`，并且为了区分同一维度下堆叠在一起的区域，需要指定`areaChart.seriedField`字段，该字段默认映射区域颜色

```javascript livedemo
const spec = {
  type: 'area',
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
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom', padding: { top: 30 } }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 百分比堆叠面积图

在百分比堆叠面积图中，每个堆叠部分的高度仅表示其占总高度的比例，而不是具体的数值。这使得用户更容易比较每个子类别或类别在总体数据中的相对权重和变化趋势。
在 VChart 中，如果需要展示百分比堆叠面积图，需要配置`areaChart.stack: true`和`areaChart.percent: true`，并且为了区分同一维度下堆叠在一起的区域，需要指定`areaChart.seriedField`字段，该字段默认映射区域颜色。

```javascript livedemo
const spec = {
  type: 'area',
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
  title: {
    visible: true,
    text: '100% stacked area chart of cosmetic products sales'
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom', padding: { top: 30 } }],
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
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图元及样式

#### 平滑面积图

在 `line.style` 属性中配置 `curveType: 'monotone'` 属性，默认 area 图元的 `style.curveType` 属性会自动同步，因此不需要再次配置

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  line: {
    style: {
      curveType: 'monotone'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 阶梯面积图

在 `line.style` 属性中配置 `curveType: 'step' | 'stepAfter' | 'stepBefore'` 属性

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'stepAfter'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
