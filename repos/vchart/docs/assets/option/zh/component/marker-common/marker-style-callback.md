{{ target: component-marker-style-callback }}

<!-- StyleCallback -->

${description}支持回调，回调函数的定义如下:

```ts
/**
 * @params markerData 标注组件聚合后的数据
 * @params context 组件上下文, 包括相对系列，起始相对系列，结束相对系列和图表实例, 1.13.0及以上版本支持
 * @return 返回对应的样式
 */
(markerData: DataView, context: IMarkerAttributeContext) => T;
```
