{{ target: common-padding }}

<!-- Padding for the component -->

The ${componentName} inner padding, in pixels (px). You can use an array to specify the top, right, bottom, and left padding individually, a single number for uniform padding on all four sides, or an object to specify the top, right, bottom, and left padding individually.

Usage example:

```ts
// 数值类型，设置内边距为 5
padding: 5;
// 数值数组，设置上下的内边距为 5，左右的内边距为 10，用法同 CSS 盒模型
padding: [5, 10];
// 数值数组，分别设置四个方向的内边距
padding: [
  5, // 上
  10, // 右
  5, // 下
  10 // 左
];
// 对象类型
padding: {
  top: 5,
  right: 10,
  bottom: 5,
  left: 10
}
```