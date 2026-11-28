---
title: 有了Trae 上下文doc功能 ，快速上手VisActor，再也不用提oncall了

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# 什么是Trae

Trae（中国区：  https://www.trae.com.cn/?utm_source=school&utm_medium=oncam&utm_campaign=visactor ，海外版：https://www.trae.ai/ ），致力于成为真正的 AI 工程师（The Real Al Engineer）。Trae 旗下的 AI IDE 产品，以智能生产力为核心，无缝融入你的开发流程，与你默契配合，更高质量、高效率完成每一个任务。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QO6tbhEcWoH2wUxkv9ocbHTDnih.gif' alt='' width='1000' height='auto'>

# 什么上下文Doc 功能

指定上下文可以让 AI 助手提供更精准的回答，但是大模型对一个组件的理解的实时程度是低于组件自己的官方文档的。如果我们在使用一个不熟悉的组件的时候，如果能将该组件的相关文档引入到上下文中，可以大大的提升智能化编程水平。



Trae 使用 “#” 来指定上下文。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DQbKbLavToRSlAxmjDwcZekwngd.gif' alt='' width='527' height='auto'>

输入“#Doc：”，可以索引文档集。 我们添加VisActor 的文档，进行测试。 目前Trae 还没有内置任何文档集，所以需要手动添加。

首先添加文档集：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DmbAbZxPboS7ZrxfgN9cyhFinpe.gif' alt='' width='563' height='auto'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GELxbtnzHoPwM8xKvGGcCd2hnDq.gif' alt='' width='388' height='auto'>

这里我们通过url的方式添加各组件的入口url：

*  VChart：https://www.visactor.io/vchart/

*  VTable：https://www.visactor.io/vtable

*  VMind：https://www.visactor.io/vmind

*  ....



整个过程略微缓慢，但是索引效果，明显好于 Cursor。



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XyVQbiHvio2MVWxdRhvctj4sndb.gif' alt='' width='878' height='auto'>

下面我们实地测试一下引用文档作为上下文是否会给编程带来实际的益处。

# 效果测试

## 创建测试项目

我们创建一个最简单web 项目

```
npm create vite@latest my-ts-web -- --template typescript
cd my-ts-web

```


# 实践验证

## 新增一个线图

我们要求Trae 生成一段代码，在当前文件中添加一个VChart 线图。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/F92CbqE1IoowQDx16mjcn6t3nkh.gif' alt='' width='946' height='auto'>

生成的结果还是有错误的。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FvE2b4jnZoS9JlxZaqbcIp9Kn6g.gif' alt='' width='1000' height='auto'>

我们下面引入文档，看看是不是会有所改变。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WIhobXL9ao6HJvx8OfXcjcIrnjc.gif' alt='' width='1000' height='auto'>

重新生成的代码修复了之前的api 错误调用。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ScgRbLL7yoNss4xB7DZcXSConPf.gif' alt='' width='1000' height='auto'>

生成了一个正确的线图。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/X4oYbGFK0oO5pExhEo5cMma0nmo.gif' alt='' width='1000' height='auto'>

## 加大难度

首先我们来修改数据，显示三条线。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VNj7bbdmToHz7LxQ3RLcf6DFn2b.gif' alt='' width='1000' height='auto'>

问题的分析和答案都比较靠谱：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KyEpbUotUoFUIexMfuVcGuFDnJh.gif' alt='' width='1000' height='auto'>



主要修改点：

1. 重构了数据结构，使用type字段来区分不同系列

1. 使用seriesField来指定系列的分类字段

1. 每个数据点包含year（x轴）、value（y轴）和type（系列）三个字段

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Z5sdbHMyWoghQpxs6OWcLVpXn4c.gif' alt='' width='1000' height='auto'>

修改入场动画效果：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GZI4bs4wtoG22XxTPPgcN50Inpe.gif' alt='' width='1000' height='auto'>



主要修改：

1. 添加了animation配置

1. appear设置入场动画为fadeIn（淡入淡出）

1. duration设置动画持续时间为1000毫秒

结果如下：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FVJmbjAmuo9UnSx442XcxupEn1e.gif' alt='' width='1000' height='auto'>



## 更多问答

因为有了官方文档，我们可以让Trae 回答更多类型的问题，不只是代码本身。

比如基本的图表概念：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PIICbYabsovm1lxFEivcBMecnth.gif' alt='' width='1000' height='auto'>

或者 具体用法：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ASlEb38xqopdwcxW5Lec2BJKn6d.gif' alt='' width='1000' height='auto'>

导航到更相关文档：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cm3rbgv8iospL5xcxLOcxIV5ntf.gif' alt='' width='1000' height='auto'>



# 简单总结

Trae 结合文档有如下好处：

1. 提升开发效率

- 快速访问：通过Marscode直接查阅VisActor API文档

- 智能提示：基于VisActor文档的精准代码补全

2. 增强开发体验

- 无缝集成：在开发环境中直接获取VTable使用指导

- 实时反馈：快速验证代码效果

3. 降低学习成本

- 文档辅助：随时查阅VisActor官方示例

- 代码生成：自动生成符合VisActor规范的代码

4. 提高代码质量

- 规范检查：确保代码符合VisActor最佳实践

- 性能优化：自动生成高性能表格配置

# 联系我们

github ：[github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor 微信订阅号留言（可以通过订阅号菜单加入微信群）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MYoibchDUoI721xknrcc1tK9nEf.gif' alt='' width='258' height='auto'>

VisActor 官网：[www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)  ； [www.visactor.](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)com

飞书群：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/N97UbjeACo2Rrjx70yUcgAOMnKg.gif' alt='' width='264' height='auto'>

discord：https://discord.com/invite/3wPyxVyH6m


---

The doc is contributed by [玄魂](https://github.com/xuanhun)
