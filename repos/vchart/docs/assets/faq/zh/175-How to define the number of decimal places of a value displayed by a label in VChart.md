# VChart 中如何定义 label 显示的数值小数位数？

## 问题描述

我使用 VChart 图表时，发现如果数字的小数位比较长时显示效果很不美观，有什么办法能控制标签显示的小数位长度吗？

![tooltip](/vchart/faq/44-0.png)

## 解决方案

通过 VChart 的标签格式化函数可以解决这个问题，此外格式函数还可以支持自定义数字单位等需求

## 代码示例

```javascript
// two decimal places
spec.label.formatMethod = (value: number) => (+value).toFixed(2);

// numerical unit
spec.label.formatMethod = (value: number) => (+value / 1e3).toFixed(2) + 'k';
```

## 结果展示

![demo](/vchart/faq/44-1.png)

Demo: [https://codesandbox.io/s/label-formatter-d34xrm?file=/src/index.ts](https://codesandbox.io/s/label-formatter-d34xrm?file=/src/index.ts)

## 相关文档

formatMethod option: [https://visactor.io/vchart/option/barChart#label.formatMethod](https://visactor.io/vchart/option/barChart#label.formatMethod)

label tutorials: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Label](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Label)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
