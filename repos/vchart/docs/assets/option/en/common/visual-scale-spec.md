{{ target: common-visual-spec-scale }}

<!-- IVisualSpecScale -->

The scale, a configuration description that maps the **abstract data** dimensions to **visual representation** in visualization. In simple terms, a scale can be described as a function. This function helps us convert data values into graphical attribute values. There are two types of scales:

- Discrete mapping scale: `type: 'ordinal'`
- Continuous mapping scale: `type: 'linear'`

Similar to functions, a scale has 2 important components

- The domain is similar to the function's input parameter restrictions, which supports specific values ​​as function arguments. In the scale, it usually is an optional value array for a certain dimensional data, or a numerical range.
- The range is similar to the function's return value, which supports specific values ​​as function return values. In the scale, it generally corresponds to a kind of graphical property value.

More details are provided below.

{{ if: ${includeId} === true }}
#${prefix} id(string)

The unique ID of the scale. Required. Other modules will use this ID to match the global scale.
{{ /if }}

#${prefix} type(string)

The type supports 2 configurations: `ordinal | linear`. These 2 configurations represent 2 different mapping methods, which are related to the domain and ranges, as explained below.

#${prefix} type.ordinal

Ordinal refers to discrete mapping. This type of scale establishes a correspondence between the domain and range based on their array indexes.

Example of use:

```ts
const scale = {
  type: 'ordinal',
  domain: ['a','b','c','d'],
  range: ['red','blue','green']
}
// 效果如下
scale('a') => 'red';
scale('b') => 'blue';
scale('c') => 'green';
scale('d') => 'red';
```

#${prefix} type.linear

Ordinal refers to continuous mapping. This type of scale requires continuous data for both domain and range values, such as numbers or colors. Its effect is similar to functions like y = ax + b.

Example of use:

```ts
const scale = {
  type: 'linear',
  domain: [100,200],
  range: [0,50]
}
// 效果如下
scale(100) => 0;
scale(150) => 25;
scale(200) => 50;
scale(0) => -50;
```

#${prefix} domain(Array)

The data range configuration in the scale. If a scale is a function, the domain refers to the optional content of the function's input parameters.

There are 2 configuration methods supported in the scale configuration:

- Array of values directly configured: e.g., ['a','b','c'] or [0,100]

```ts
const scale = {
  type: 'ordinal',
  domain: ['a', 'b']
};
```

- Configuration of data dimension information

```ts
const chartSpec = {
  data: [
    {
      name: 'data1',
      values: [
        {x: '第一季度', y: 0, type: 'A类'}
        {x: '第一季度', y: 50, type: 'B类'}
        {x: '第二季度', y: 100, type: 'A类'}
        {x: '第二季度', y: 200, type: 'B类'}
      ]
    },
    {
      name: 'data2',
      values: [
        {x: '第一季度', y: 80, group: 'C类'}
        {x: '第一季度', y: -50, group: 'D类'}
        {x: '第二季度', y: 150, group: 'C类'}
        {x: '第二季度', y: 100, group: 'D类'}
      ]
    }
  ],
  scales: [
    {
      id: 'shapeScale'
      type: 'ordinal',
      domain: [{
            dataId: 'data1',
            fields: ['type']
      },{
            dataId: 'data2',
            fields: ['group']
      }],
      range: ['circle','rect']
    },
    {
      id: 'sizeScale'
      type: 'ordinal',
      domain: [{
            dataId: 'data1',
            fields: ['y']
      },{
            dataId: 'data2',
            fields: ['y']
      }],
      range: [4,20]
    },
  ]
}
// 最终 scale 的 domain 如下：
shapeScale.domain() === ['A类','B类','C类','D类'];
sizeScale.domain() === [-50,200];
```

#${prefix} range(Array)

The graphic attribute values of the scale, which can be understood as the settings for the return value range of the function. Supports configurations of various graphic attribute values.

Example:

```ts
const scale = {
  type: 'ordinal',
  domain: ['a', 'b'],
  range: ['red', 'blue'] // 颜色
};
const scale = {
  type: 'ordinal',
  domain: ['a', 'b'],
  range: ['circle', 'rect'] // 形状
};
const scale = {
  type: 'linear',
  domain: [1000, 2000],
  range: [4, 20] // 大小
};
const scale = {
  type: 'ordinal',
  domain: ['a', 'b'],
  // 线的 dash 其中数组第一项为实线 [1,0] 第二项为 4-4 的虚线 [4,4]
  range: [
    [1, 0],
    [4, 4]
  ]
};
```

#${prefix} specified(Object)

The specified mapping of scale, if specified is configured, the content of specified will be matched first, and the matching result will be returned directly, otherwise the mapping will continue according to the original logic of scale

Currently only works with `type=ordinal`.

Example:

```ts
const scale = {
  type: 'ordinal',
  domain: ['a', 'b'],
  range: ['red', 'blue'],
  specified: {
    a: 'black',
    d: 'red'
  }
};
//
// scale('a') => 'black'
// scale('b') => 'blue'
// scale('d') => 'red'
```

#${prefix} clamp(boolean)

If clamp is enabled, the return value of the scale is always within the scale’s range.

`1.13.6` version supported, only supported in `type=linear`.

Example:

```ts
const scale = {
  type: 'linear',
  domain: [100, 200],
  range: [0, 50],
  clamp: true
};
//
// scale(100) => 0
// scale(150) => 25
// scale(200) => 50
// scale(0) => 0
// scale(300) => 50
```
