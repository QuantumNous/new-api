# Title 标题

图表标题主要用于负责展示图表的主题信息，VChart 的标题默认显示在图表顶部，由主标题和副标题组成，可选择显示副标题在其下方。本教程主要讲解 Title 的相关概念以及组成，关于 Title 更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## Title 的组成

标题组件的组成如下：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a2c7623458257d1562627090e.png" alt="title 组件的组成图示">
</div>

在 VChart 中，我们可以通过 `title` 属性进行配置标题，下面的代码示例展示了如何配置的图表的标题与副标题：

```ts
{
  title: {
    text: 'chart title',
    subtext: 'This is a subtext.'
  }
}
```

完整的配置详见 [title](../../../option/barChart#title)。
