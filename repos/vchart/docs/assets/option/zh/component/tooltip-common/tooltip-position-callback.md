{{ target: component-tooltip-position-callback }}

<!-- ITooltipPositionCallback -->

除了可配置数值以外，该属性也支持函数回调，类型为：

```ts
(event: MouseEvent) => number;
```

其中 event 为鼠标原始事件。
