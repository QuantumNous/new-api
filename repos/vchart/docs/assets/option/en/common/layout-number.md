{{ target: common-layout-number }}

<!-- ILayoutNumber -->

Supports direct configuration of values (unit px), percentages (`${number}%`) (percentage of chart viewport size), and callback configuration. The callback function is defined as follows:

```ts
interface ILayoutRect {
  width: number;
  height: number;
}

(layoutRect: ILayoutRect) => number;
```

Usage examples:

- Numeric value: `45` is in pixel value px
- Percentage: `'10%'` When in the horizontal direction, it is the percentage of the **chart view area** `width`; when in the vertical direction, it is the percentage of the **chart view area** `height`
- Callback: `({ width, height }) => width * 0.5` The returned value is treated as a pixel value px