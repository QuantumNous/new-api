{{ target: component-tooltip-position-callback }}

<!-- ITooltipPositionCallback -->

In addition to configurable values, this property also supports function callbacks, with the type:

```ts
(event: MouseEvent) => number;
```

where event stands for the original mouse event.