# How to define the number of decimal places of a value displayed by a label in VChart?

## Question Description

When I use VChart charts, I find that if the decimal places of the numbers are longer, the display is very unattractive. Is there any way to control the length of the decimal places displayed by the labels?

![tooltip](/vchart/faq/44-0.png)

## Solution

VChart label formatting function can solve this problem. In addition, the format function can also be supported for custom numerical units.

## Code Example

```javascript
// two decimal places
spec.label.formatMethod = (value: number) => (+value).toFixed(2);

// numerical unit
spec.label.formatMethod = (value: number) => (+value / 1e3).toFixed(2) + 'k';
```

## Result

![demo](/vchart/faq/44-1.png)

Demo: [https://codesandbox.io/s/label-formatter-d34xrm?file=/src/index.ts](https://codesandbox.io/s/label-formatter-d34xrm?file=/src/index.ts)

## Quote

formatMethod option: [https://visactor.io/vchart/option/barChart#label.formatMethod](https://visactor.io/vchart/option/barChart#label.formatMethod)

label tutorials: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Label](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Label)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
