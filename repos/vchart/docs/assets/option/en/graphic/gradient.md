{{ target: graphic-gradient }}

Gradient color configuration. Gradient colors can be configured on properties that support color configuration, such as `fill` and `stroke` in graphic element styles. Currently, three types of gradients are supported:

- Linear gradient

```ts
// 线性渐变，前四个参数分别是 x0, y0, x1, y1, 范围从 0 - 1，相当于在图形包围盒中的百分比
{
  gradient: 'linear',
  x0: 0,
  y0: 0,
  x1: 0,
  y1: 1,
  stops: [
    {
      offset: 0,
      color: 'red' // 0% 处的颜色
    },
    {
      offset: 1,
      color: 'blue' // 100% 处的颜色
    }
  ],
}
```

- Radial gradient

```ts
// 径向渐变，前五个参数分别是 x0, y0, r0, x1, y1, r1，其中 r0 r1 代表半径，取值同线性渐变
{
  gradient: 'radial',
  x0: 0.5,
  y0: 0,
  r0: 0,
  x1: 0.5,
  y1: 1,
  r1: 0.7,
  stops: [
    {
      offset: 0,
      color: 'rgba(255,255,255,0.5)' // 0% 处的颜色
    },
    {
      offset: 1,
      color: '#6690F2' // 100% 处的颜色
    }
  ]
}
```

- Conical gradient

```ts
// 锥形渐变，startAngle 代表起始弧度，endAngle 代表结束弧度，x, y 为坐标，取值范围 0 - 1
{
  gradient: 'conical',
  x: 0.5,
  y: 0.5,
  startAngle: 0,
  endAngle: 6.283185307179586,
  stops: [
    { offset: 0, color: 'red' },      // 0% 处的颜色
    { offset: 0.2, color: 'blue' },   // 20% 处的颜色
    { offset: 0.4, color: 'orange' }, // 40% 处的颜色
    { offset: 0.6, color: 'pink' },   // 60% 处的颜色
    { offset: 0.8, color: 'green' },  // 80% 处的颜色
    { offset: 1, color: 'purple' }    // 100% 处的颜色
  ],
}
```
