# Cursor+DeepSeek，快速上手属于你的 VChart 代码

在前面的章节中，我们已经大致了解了一份基础 spec 的组成部分以及基础图表的具体生成。然而 VChart 因为其功能的强大和 API 的多样性，想要使用 VChart 快速实现一个复杂的图表可能较为困难，那么有没有一种简单轻松的方式，可以快速上手，无需在 API 文档中苦苦寻找呢？

答案是肯定的！得益于当前 AI 技术的飞速发展，通过 AI 工具不仅可以快速理解和掌握 VChart 的使用方法，还能显著提升编码效率，让开发者专注于创造力和业务逻辑的实现。
这篇教程我们会通过配置`Cursor`和`DeepSeek`（可以是其他任何 AI,当然使用Cursor 默认的模型也是ok的，重点是自定义引入文档），快速快速上手属于你的 VChart 代码！

## 1. 前期准备

### 一个使用 vchart 的项目

例如我有一个通过`npx create-react-app my-app --template typescript` 初始化的一个简单项目，启动后如下所示：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepSeek+Cursor_1.PNG" alt="初始化项目">
</div>

### DeepSeek

注册 deepSeek，在[deepSeek api 官网](https://platform.deepseek.com/api_keys)上新建一个属于你的 api key

### Cursor

在[官网](https://www.cursor.com/)下载并注册，用`cursor`打开你的 VChart 项目，我们对`cursor`进行配置

### 配置 cursor

以`deepSeek-V3`为例，其模型名称为`deepseek-chat`，API 地址为 https://api.deepseek.com/v1 ，详见[api 使用官网](https://api-docs.deepseek.com/zh-cn/)
我们在 `model` 页面进行新建，设置对应的 `api` 地址和 `model` 名称.

_值得注意的是，目前`cursor`官方并不支持直接接入`deepSeek`，我们可以通过覆盖`openAPI`的接口地址达到接入`deepSeek`的目的。在设置过程中，需要先关闭其他模型，只接入`deepSeek`模型_

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_cursor_2.PNG" alt="cursor配置">
</div>

## 2. 实战使用

### 新增柱图

通过`cmd+i`命令唤起 ai 交互，直接让 ai 帮我们先生成一个简单的柱图代码，直接应用这个 spec，我们查看结果，一个简单的柱图就渲染完成了；可以发现`deepSeek`对`vchart`有着一定的认知，简单的图表可以直接添加，我们尝试下更复杂的场景。

<p style="text-align: center;">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deep_seek_3.PNG" alt="cursor结果" height="380">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_4.PNG" alt="渲染结果" height="380">
</p>

### 复杂场景，注入 docs

我们希望添加一条 y 轴的均值辅助线，查看结果，然而结果并不正确，仔细查看可以发现，`markLine`虽然写的像是这么回事，但是`spec`并不符合规范，而且均值线经过了计算，我们通过注入 docs 来解决这个问题。

<p style="text-align: center;">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_5.png" alt="markline_cursor" height="380">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_6.png" alt="markline_result" height="380">
</p>

### 设置 docs

进入`cursor`设置页面，选择`Features`，新增 docs，可以从以下 docs 地址中任选其一:

- https://visactor.com/vchart
- https://visactor.io/vchart

![配置docs](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deep_seek_6.gif)

你也可以直接在编辑页面通过`@Docs`进行新增

### 实验结果

通过将新加入的 docs，再次编辑，可以得到正确的结果！

<p style="text-align: center;">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_7.png" alt="markline_cursor" height="380">
 <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/deepseek_8.png" alt="markline_result" height="380">
</p>

通过本教程，您已经了如何通过`cursor+deepseek`来提升你的 VChart 编码效率，同时探索 VChart 的强大功能和灵活性，编绘出绚丽多彩的图表。祝您编码愉快！
