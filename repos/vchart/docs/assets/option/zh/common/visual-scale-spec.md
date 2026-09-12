{{ target: common-visual-spec-scale }}

<!-- IVisualSpecScale -->

scale 比例尺，它是可视化中将**抽象数据**的维度映射到**视觉表示**的一种配置描述。通俗的说，scale 就是在描述一个函数。这个函数能够帮助我们将数据的值，变成图形的属性值。它有两种类型：

- 离散映射比例尺：`type: 'ordinal'`
- 连续映射比例尺：`type: 'linear'`

与函数类似，scale 也有 2 个重要的组成部分

- domain 类似函数的传入参数限制，它表示支持哪些值作为函数的入参，在比例尺中，它通常是数据的某个维度的可选值数组，或者是一个数值区间。
- range 类似函数的返回值，它表示支持什么值作为函数的返回值，在比例尺中，通常是图形的某种属性值

下面会详细介绍

{{ if: ${includeId} === true }}
#${prefix} id(string)

scale 的唯一 id 。必传，在其他模块中将通过这个 id 匹配全局 scale。
{{ /if }}

#${prefix} type(string)

type 支持 2 种配置 `ordinal | linear` 。这 2 种配置分别代表 2 种不同的映射方式，也就是 domain 与。下面逐一说明

#${prefix} type.ordinal

ordinal 表示离散映射，这个类型的 scale，通过 domain 与 range 的数组下标进行对应。

使用例子：

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

ordinal 表示连续映射，这个类型的 scale， domain 与 range 的值都需要是连续数据。比如数值，颜色。它的效果类似于 y = ax + b 这样的函数。

使用例子：

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

scale 中表示数据区间的配置。 如果 scale 是一个函数，domain 就是指这个函数的传入参数的可选内容。

我们在 scale 的配置中支持 2 中配置方式

- 直接配置值的数组：比如 ['a','b','c'] 或者 [0,100]

```ts
const scale = {
  type: 'ordinal',
  domain: ['a', 'b']
};
```

- 配置数据的维度信息

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

scale 的图形属性值，可以理解为函数的返回值区间设置。支持配置各种图形属性值

示例：

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

scale 的指定映射，如果配置了 specified ，那么会优先匹配 specified 的内容，并且直接返回匹配到的结果，否则会继续按照 scale 原本逻辑进行映射

目前只在 `type=ordinal` 时生效。

示例：

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

#${prefix} clamp(boolean)=false

如果 clamp 为 true，则 scale 的返回值总是处于 scale 的 range 范围内。

`1.13.6`版本开始支持，仅在 `type=linear` 时生效。

示例：

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
