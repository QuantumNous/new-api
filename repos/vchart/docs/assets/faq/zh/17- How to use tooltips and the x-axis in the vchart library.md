---
title: 112. vchart 图表库中的 tooltip 和横坐标如何使用？</br>
---
# 问题标题

vchart 图表库中的 tooltip 和横坐标如何使用？</br>


# 问题描述

我正在使用 vchart 图表库制作图表，但在设置 tooltip 和横坐标时遇到了困难。我尝试对 tooltip 进行配置，但它并没有显示出来，即使我设置了 visible 也无法显示它。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QVIIbry4sodz3axF4LXcMQxRnYc.gif' alt='' width='674' height='692'>

此外，我还希望能够自定义 x 轴的内容。我不确定是我的使用方式不对还是有其他的问题。</br>


# 解决方案

首先，对于 tooltip 的配置问题，你的设置方式是正确的。</br>


然后，关于 tooltip 没有生效的问题，你需要检查你的 `content` 是否写错了位置。如果你想要自定义 tooltip 的内容，可以参考[vchart 的这个示例](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fdemo%2Ftooltip%2Fcustom-tooltip)。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OH4BbX2LPoFfLHxtvbhclGS2nrf.gif' alt='' width='3482' height='1592'>

最后，关于 x 轴的自定义内容，你可以通过在 `axes.label` 中设置样式来实现。你还可以使用 `formatMethod` 来自定义内容。具体实现方法可以参考[vchart 的这个示例](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fdemo%2Faxis%2Fgrid-style)。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/D2cMbBI6wo1ftYxEhbkc0E7Unie.gif' alt='' width='3526' height='1306'>





# 相关文档

*  [vchart Tooltip 使用指南](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FTooltip)</br>
*  [vchart Axis 样式设置示例](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fdemo%2Faxis%2Fstyle)</br>
*  [vchart 自定义 Tooltip 示例](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fdemo%2Ftooltip%2Fcustom-tooltip)</br>
*  [vchart Axis 网格样式示例](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fdemo%2Faxis%2Fgrid-style)</br>