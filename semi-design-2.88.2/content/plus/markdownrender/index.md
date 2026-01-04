---
localeCode: zh-CN
order: 29
category: Plus
title:  Markdown 渲染器
icon: doc-markdown
dir: column
brief: 在网页中即时渲染 Markdown 和 MDX
---

## 使用场景

Markdown 是一种文档标记语言，可以通过简单的标记实现例如标题，图片，表格，链接，加粗等基本常用富文本功能。
MDX 是在 Markdown 基础上，允许引入 JSX 实现更加复杂定制化的文档撰写与展示需求。

Semi 提供的 MarkdownRender 组件支持渲染 Markdown 和 MDX，无需特别配置，传入纯文本即可渲染出符合 Semi 样式规范的富文本内容。


通常用于下列场景：
- 文档站编写与渲染
- 服务端动态生成富文本内容时，前端渲染
- 偏内容展示的轻交互网站


**注意：Safari 16.3 之前的版本不支持正则环视断言，会导致上游依赖 mdxjs [报错]( https://github.com/syntax-tree/mdast-util-gfm-autolink-literal/issues/10)，可以传入 remarkGfm 为 false 关闭 gfm 语法解析（会导致table 等markdown 特性无法解析），并且在项目编译时使用 null-loader 或 alias 其他方式忽略掉 remark-gfm 这个包。**

## 代码演示

### 如何引入

MarkdownRender 从 v2.62.0 开始支持  
注意：MarkdownRender 组件 依赖 `jsx/run-time`，搭配使用 React 版本需 > 16.14.0  

```jsx
import { MarkdownRender } from '@douyinfe/semi-ui';
```


### 基本用法
导入 MarkdownRender 后，直接传入 Markdown 或 MDX 纯文本即可。

注意因为 `<` `{` 等符号是合法的 JSX 符号会被判定为代码，无法直接渲染，需要使用 `\` 转义，如果你只需要渲染纯 Markdown，参考下方仅渲染 Markdown 一节。

```jsx live=true dir="column"
import { MarkdownRender } from '@douyinfe/semi-ui';


function Demo(){
    return <MarkdownRender raw={`
## 

正文内容是普通的文本，也可以**加粗**~~删除线~~和<u>下划线</u> [超链接](https://semi.design) 等 Markdown 与 HTML 的基本语法所支持的富文本，也支持 emoji 🍰


部分符号需要转义 \\{\\} \\<\\> ...

<br/>
<br/>
---
#### Semi Design DSM
[Semi DSM](https://semi.design/dsm) 是 Semi Design 提供的设计系统管理工具（Design System Management），支持全局、组件级别的样式定制，并在 Figma 和前端代码之间保持同步  
适用于各种规模的团队，无论你是需要简化工作流程，提高团队协作，还是增加生产力，我们都有适合你的功能

##### 中大型企业
- 多达 3000+ Design Token，深入每一处细节的定制可能，色彩，阴影，边距，圆角，动效，渲染结构均可自由定制，告别 ~~CSS 硬编码~~
- 功能强大，经过抖音内部数千项目验证过的 UI lib，轻松应对各类复杂场景
- A11y 无障碍友好，国际化功能完备
- 面向社区建设，完全开源，无使用限制
- 从 designOps 到 devOps，自动化工作流，Figma UI Kit 一键刷入主题，生成 Style Guideline，研发一行 npm 代码配置接入

##### 初创企业
- 无需从 0 到 1 投入大量研发资源，快速复用开源社区优秀方案, 低成本快速定制具备品牌特色的设计系统。
- 一键支持暗色模式生成，支持根据品牌色快速生成包含 320 个全色阶、兼容深/浅两种模式的色彩系统，并支持动态切换
- 不断进化，DSM + Semi Design 组件由<u>抖音前端架构团队</u>专业维护，已稳定迭代五年+，值得信赖

##### 自由设计师/个人开发者
- 低成本快速创建风格各异的设计系统，更少时间，更快交付
- 研发接入友好，无需反复沟通，交付npm包产物，一键完成代码接入


![DSM](https://semi.design/dsm_manual/content/introduction/start/start-intro.png)

---

#### MarkdownRender 渲染列表语法
- 好好地吃饭
- 好好地睡觉
- 好好地游玩
- 好好地学习
- 好好地聊天
- 好好地吵架
- 过着平凡普通的每日 

| 支持 | Markdown 表格 |  c |  d  |
| - | :- | -: | :-: |
| 1 | 2 | 3 | 4 |
| 21 | 22 | 23 | 24 |
| 31 | 32 | 33 | 34 |
| 41 | 42 | 43 | 44 |

    `}/>
}

```

### 修改元素样式

你可以任意替换 Markdown 或 MDX 文档中的文档元素的显示效果，只需向 `components` props 中传入你的渲染组件覆盖即可

比如，现在需要将所有1号标题的颜色设置成主色

```jsx live=true dir="column"
import { MarkdownRender, Typography } from '@douyinfe/semi-ui';


function Demo() {
    const components = {}
    
    components['h2'] = ({children}) => <Typography.Title heading={2} style={{color:"var(--semi-color-text-2)"}}>{children}</Typography.Title>
    
    return <MarkdownRender raw={`## 从 Semi Design 到 Any Design  快速定义你的设计系统，并应用在设计稿和代码中`} components={components} />
}


```

可以覆盖的基本元素 tag 支持 `a blockquote br code em h1 h2 h3 h4 h5 hr img li ol p pre strong ul table`

### 仅纯 Markdown
当你渲染的 Markdown 仅仅是纯 markdown，不包含任何 JSX 代码时，可传入 `format="md"` 来开启仅 Markdown 模式，在这种模式下无需转义特殊字符

```jsx live=true
import { MarkdownRender, Typography } from '@douyinfe/semi-ui';


function Demo() {
    const components ={};
    
    components['h1'] = ({children}) => <Typography.Title heading={1} style={{color:"var(--semi-color-primary)"}}>{children}</Typography.Title>
    
    return <MarkdownRender raw={`无需转义的符号{}<> ...`} format="md" components={components} />
}

```

### 添加自定义组件

通过传入自定义组件到 `components` Props，能够实现在 Markdown 中直接书写 JSX，组件会被渲染到最终页面上，支持 JS 事件。
默认的 Markdown 组件可从 `MarkdownRender.defaultComponents` 中获取，可以用于二次封装。

<Notice type="primary" title="注意事项">
  <div>注意尽量确保被渲染的 Markdown 内 JSX 代码可信，防止 XSS。</div>
</Notice>


```jsx live=true
import { Button, MarkdownRender, Typography } from '@douyinfe/semi-ui';

function Demo() {
    const components = {};

    components['MyButton'] = ({ children,onClick }) => {
        return <Button type={"primary"} onClick={onClick} style={{marginBottom:"12px"}}> {children} </Button>
    }

    return <MarkdownRender 
        raw={`
#### 下面是一个渲染在 Markdown 中的按钮
<MyButton onClick={()=>alert("点击了 MyButton")}>MyButton 点我</MyButton>

直接在 Markdown 中书写 JSX 即可
        `}
        components={{...MarkdownRender.defaultComponents,...components}}
        />
}


```

# 添加插件

通过 `remarkPlugins` `rehypePlugins` 支持 MDXJS 的所有 RemarkPlugin 和 RehypePlugins 插件，详情请参考 [MDXJS](https://mdxjs.com/docs/extending-mdx/)



### API

| 属性         | 说明                                          | 类型                                   | 默认值   |
|------------|---------------------------------------------|--------------------------------------|-------|
| className | 类名                                          | string                               | -   |
| components | 用于覆盖 Markdown 元素，也可添加自定义组件                  | Record<string, JSXElementConstructor> | -     |
| format     | 传入的 raw 类型，是否是纯 Markdown                    | 'md'\|'mdx'                          | 'mdx' |
| raw        | Markdown 或 MDX 的纯文本                         | string                               | -     |
| remarkGfm | 是否开启 Github GFM 语法，safari 16.3 之前不支持环视断言会报错 | bool | true |
| remarkPlugins | 自定义 Remark Plugin                           | Remark Plugin Array                | - |
| rehypePlugins | 自定义 Rehype Plugin                           | Rehype Plugin Array               | - |
| style | 样式                                          | CSSProperties                        | - |

## 设计变量

<DesignToken/>

