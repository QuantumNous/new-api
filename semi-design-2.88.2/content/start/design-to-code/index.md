---
category: 开始
title:  Design to Code 设计稿转代码
icon: doc-code
localeCode: zh-CN
order: 5
---

## 简介

D2C 为 Design to Code 的缩写，即设计稿转代码。作为前端工程师的辅助工具，能有效加速设计稿还原的效率，降低人工编写 Html / CSS 的成本。

得益于 Figma 平台生态原生能力（Variant 变体、DevMode、CodeConnect 等）的不断增强，D2C 类工具近些年在生产环境下的可用性已经有了非常大的提升，可以支撑完整的设计系统接入，做到组件级的识别与代码输出。
同时借助 AI 大模型，可以有效对 Figma 转译出的模板样式代码做进一步改写，实现业务逻辑补充。

Semi D2C 提供开箱即用的设计稿转代码：支持一键识别 Figma 页面中图层布局 + 设计系统组件，像素级还原设计稿，转译为 React JSX 和 CSS 代码。此外还提供了丰富的扩展能力，基于自定义插件系统快速打造团队专属的设计研发协作工具，无需从 0 开发，

借助 D2C，你可以将 UI 还原的工作交给工具，更专注于实现业务逻辑。

<DesignToCodeFeature /> 

## 调用方式

我们提供了多种形态的调用方式：

- Figma 插件：通过 Figma DevMode 快速启动，点击图层直接获取对应代码，支持不同代码格式 Output。支持通过自定义插件自由消费 AST，自定义出码结果
- OpenApi：开放式 Http 服务，提供基于 Figma URL 解析出对应代码的能力，可用于将 D2C 集成到业务流程，如 LowCode 搭建平台，构建 MCP 服务等（字节内部可用，社区版本暂未提供该能力）
- NodeSdk：定制性强，可用于封装团队私有的 D2C 能力，如 CLI/HTTP 服务/VS Code 插件（字节内部可用，社区版本暂未提供该能力）

更详细的使用说明，可访问 <a href="/code" target="_blank">D2C 官网</a> 查阅


## 示例

我们准备了一些 Figma 示例设计稿，以及使用 Semi Figma 插件实际转译的代码 Codesandbox 链接。   

在安装插件后，你可以基于这些现有设计稿，快速体验 / 评估 Semi D2C 的能力


| 截图 & Figma URL                                                                                                                                                                                                                                                                                                                               | 类型                                | 说明                                                | Codesandbox                                                                                  |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------|---------------------------------------------------|----------------------------------------------------------------------------------------------|
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=5%3A2092' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/simple-demo-1.jpg' style={{ width:  400 }} /></a>                                               | 不含组件，内容较简单的模块           | 可用于快速还原布局及内容                            | <a href='https://codesandbox.io/s/w1z9yx' target="_blank" rel="noreferrer noopener">Link</a> |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A275' target="_blank" rel="noreferrer noopener"><img src='https://lf3-files.qingfuwucdn.net/obj/inspirecloud-file/baas/tt38q7/2468f1c4f1756bc0_1676603194364.png' style={{ width:  400 }} /></a>                                                  | 不含组件，内容较多或布局稍复杂的模块 | 可用于快速还原布局及内容                            | <a href='https://codesandbox.io/s/905ncn' target="_blank" rel="noreferrer noopener">Link</a> |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo%EF%BC%88Figma-Community%EF%BC%89?node-id=419%3A90854&t=PMnGQ3VQIoGQZZPl-4' target="_blank"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/semi-code-site/Simple Form.png' style={{ width:  400 }}/></a>    | 含 Semi 表单组件的模块              | 可用于快速还原布局及内容，并识别出 Semi 组件的 Props | <a href='https://codesandbox.io/p/sandbox/simple-form-9gq7fw' target="_blank">Link</a>                           |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo%EF%BC%88Figma-Community%EF%BC%89?node-id=419%3A128959&t=PMnGQ3VQIoGQZZPl-4' target="_blank"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/semi-code-site/Simple Table.png' style={{ width:  400 }} /></a> | 含 Semi Table 组件                  | 可用于快速识别表格列、创建 Table                     | <a href='https://codesandbox.io/s/happy-browser-dt34sr' target="_blank">Link</a>             |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A276' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/d2c-landing-example.png' style={{ width:  400 }} /></a>                                          | 整页 Landing Page                   | 可用于快速还原布局及内容                            | <a href='https://codesandbox.io/s/cvhhqt' target="_blank" rel="noreferrer noopener">Link</a> |


## 与其他技术路线的差异
通常而言，设计转代码除了依赖于特定设计平台的 Figma To Code / Sketch To Code 外，还有 Image to Code，基于多模态 AI 大模型的 Code 生成 也可以认为是 Image to Code 的一种变体。

- Image to Code：
    - 传统的 ImageToCode 路线依赖 yolo 等手段对图片元素进行切割，然后识别。这类技术路线对相似元素的识别不佳（例如 Select 与 TreeSelect 在样式相似的情况下，识别可能会混淆），同时设计稿还原度在达到一定阈值后很难再优化
    - 大模型时代，依赖 LLM 多模态能力如 GPT-4V 等手段亦能做到对简单设计稿的 toCode 还原，但该路径目前依然很难承载一个特定的设计系统（或者一个特定设计系统 + 主题定制的衍生体），并基于特定的设计规范去还原。同时对于间距、对齐、元素识别等存在非常多边边角角的 diff，对设计师来说，验收成本会剧增，对于 Pixel Perfect 视觉还原效果要求高的场景而言，实用性依然不佳。针对这些 case 的改善成本，目前依然居高不下

- Figma to Code：  
    - 23/24年业界主流的 D2C 产品基本都是基于该技术路线，它由于属于结构化信息的互相转换，所以对设计系统，相似元素等 Image to Code 无法解决的 case 里，**识别精准度上会有非常大的优势**。Semi 的 D2C 亦基于此。
    - 与其他 D2C 方案提供者不同，我们本身亦是设计系统的维护者，会更注重与特定设计系统的联通，**提供的 D2C 原生支持 Design System 组件级转码识别，也支持第三方设计系统**，基于 Code To Design 能力 跟 Figma 的 Variant 做了打通。对 Figma 平台上各类功能的更新也更及时
    - 我们正在将上述两个路线做结合，结合两者优点去做更靠近实际应用的生成，先基于 Figma To Code 生成基础代码，再结合 Image 图像信息，借助多模态 AI 大模型将基础代码做更合理的改写，在字节跳动内部版本的 D2C 插件中，我们提供了 Quality 模式，基于 Doubao / Deepseek 集成以下开箱即用的能力：更智能的子组件拆分、列表循环结构基于 map render 实现、classname 语义化、jsx -> tsx 类型声明补充。  

**D2C + AI 是当下阶段能最好兼顾设计还原度 + 生成代码高可用性的技术路线（D2C + AI  =  🚀 Pixel Perfect + 🔩 高可维护代码）**


## 更多说明
更多关于 Figma 插件的安装，使用，标注自定义组件，Figma 设计变体的使用，D2C 的使用受限等细节信息，请查阅 https://semi.design/code