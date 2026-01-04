---
category: Getting Started
title:  Design to Code
subTitle: Dark Mode
icon: doc-code
localeCode: en-US
order: 5
---

## Introduction

D2C is the abbreviation of Design to Code, which means converting design drafts into code. As an auxiliary tool for frontend engineers, it can effectively improve the efficiency of design draft restoration and reduce the cost of manual Html/CSS coding.

Thanks to the continuous enhancement of the native capabilities of the Figma platform ecosystem (such as Variant, DevMode, CodeConnect, etc.), the usability of D2C tools in the production environment has been greatly improved in recent years. They can support the access of complete design systems and achieve component - level identification and code output.  
At the same time, with the help of AI models, it is possible to effectively rewrite the template style code translated from Figma to supplement business logic.  
Semi D2C provides out-of-the-box design to code abilities: it supports one-click identification of layer layouts and design system components on Figma pages, achieves pixel perfect reproduction of design drafts, and translation into React JSX and CSS code. In addition, it also provides rich expansion capabilities. Based on a flexible plugin system, it can quickly create team specific design and R&D collaboration tools without starting from scratch.

With the help of D2C, you can delegate the UI restoration work to the tool and focus more on implementing business logic.

<DesignToCodeFeature /> 

## Invocation Methods

We provide multiple forms of invocation methods:  

**Figma Plugin**: Quickly launched through Figma DevMode. You can directly obtain the corresponding code by clicking on the layer, and it supports the output of different code formats. It also supports freely consuming the Abstract Syntax Tree (AST) through a custom plugin and customizing the code generation results.  

**OpenApi**: An open Http service that provides the ability to parse the corresponding code based on the Figma URL. It can be used to integrate D2C into business processes, such as LowCode building platforms and the construction of MCP services, etc. (Available internally in ByteDance. This capability is not yet provided in the community version.)  

**NodeSdk**: It has strong customization and can be used to encapsulate the team's private D2C capabilities, such as CLI/HTTP services/VS Code plugins (Available internally in ByteDance. This capability is not yet provided in the community version.)  

For more detailed usage instructions, you can visit <a href="/code" target="_blank"> the D2C Official Website</a> for reference.


## Examples

Here is a link to the Figma example mockup and its corresponding Codesandbox transpiled using the Semi Figma plugin.

| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Desciption                                                                                          | Codesandbox                                                                                  |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=5%3A2092' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/simple-demo-1.jpg' style={{ width:  400 }} /></a>                                               | A module with simple content without components                                                   | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/w1z9yx' target="_blank" rel="noreferrer noopener">Link</a> |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A275' target="_blank" rel="noreferrer noopener"><img src='https://lf3-files.qingfuwucdn.net/obj/inspirecloud-file/baas/tt38q7/2468f1c4f1756bc0_1676603194364.png' style={{ width:  400 }} /></a>                                                  | Modules that do not contain components, have more content, or have a slightly more complex layout | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/905ncn' target="_blank" rel="noreferrer noopener">Link</a> |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo%EF%BC%88Figma-Community%EF%BC%89?node-id=419%3A90854&t=PMnGQ3VQIoGQZZPl-4' target="_blank"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/semi-code-site/Simple Form.png' style={{ width:  400 }}/></a>    | Module with Semi Form Components                                                                  | Can be used to quickly restore the layout and content, and identify the Props of the Semi component | <a href='https://codesandbox.io/p/sandbox/simple-form-9gq7fw' target="_blank">Link</a>                           |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo%EF%BC%88Figma-Community%EF%BC%89?node-id=419%3A128959&t=PMnGQ3VQIoGQZZPl-4' target="_blank"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/semi-code-site/Simple Table.png' style={{ width:  400 }} /></a> | Module with Semi Table Components                                                                 | Can be used to quickly identify table columns, create Table                                         | <a href='https://codesandbox.io/s/happy-browser-dt34sr' target="_blank">Link</a>             |
| <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A276' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/d2c-landing-example.png' style={{ width:  400 }} /></a>                                          | Full landing page                                                                                 | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/cvhhqt' target="_blank" rel="noreferrer noopener">Link</a> |



## Differences from Other Technical Approaches
Generally speaking, in addition to relying on Figma To Code/Sketch To Code on specific design platforms for design to code conversion, there is also Image to Code. Code generation based on AI models can also be considered a variant of Image to Code.

- Image To Code:
    - The traditional Image To Code approach relies on methods such as YOLO to cut image elements and then identify them. This type of technical approach has poor recognition of similar elements (for example, when Select and TreeSelect have similar styles, the recognition may be confused). At the same time, it is difficult to further optimize the restoration degree of the design draft after it reaches a certain threshold.
    - After the emergence of large-scale language models (LLMs) in the field of AI, relying on vllm such as GPT-4V can also achieve the toCode restoration of simple design drafts. However, this path is still difficult to support a specific design system (or a derivative of a specific design system + theme customization) and restore it based on specific design specifications. At the same time, there are many minor differences in aspects such as spacing, alignment, and element recognition. For designers, the acceptance cost will increase significantly. For scenarios with high requirements for Pixel Perfect visual restoration effects, its practicality remains poor. The improvement costs for these cases are still high at present.

- Figma To Code:
    - In 2023/2024, mainstream D2C products in the industry are basically based on this technical approach. Since it belongs to the mutual conversion of structured information, it has a great advantage in recognition accuracy in cases where Image to Code cannot solve problems, such as design systems and similar elements. Semi's D2C is also based on this.
    - Different from other D2C solution providers, we are also the maintainers of the design system ourselves. We pay more attention to the connection with specific design systems. The D2C we provide natively supports component - level transcoding recognition of the Design System and also supports third - party design systems. Based on the Code To Design capability, it has been integrated with Figma's Variant. We also update various functions on the Figma platform more promptly.
    - We are combining the above two approaches, integrating their advantages to achieve generation closer to practical applications. First, generate basic code based on Figma To Code, and then combine image information. With the help of AI models, rewrite the basic code more reasonably. In the internal version of the D2C plugin of ByteDance, we provide a Quality mode. Based on Doubao/Deepseek, the following out - of - the - box capabilities are integrated: more intelligent sub - component splitting, implementation of list loop structures based on map render, semantic classname, and addition of jsx -> tsx type declarations.

**D2C + AI is the technical approach that can best balance the design restoration degree and the high availability of generated code at the current stage (D2C + AI = 🚀 Pixel Perfect + 🔩 highly maintainable code)** 