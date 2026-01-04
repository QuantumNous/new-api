---
localeCode: en-US
order: 29
category: Plus
title:  Markdown Render
icon: doc-markdown
dir: column
brief: Instantly render Markdown and MDX in web pages
---

## When to use

Markdown is a document markup language that can implement basic common rich text functions such as titles, pictures, tables, links, bolding, etc. through simple tags.
MDX is based on Markdown and allows the introduction of JSX to achieve more complex and customized document writing and display requirements.

The `MarkdownRender` component provided by Semi supports rendering Markdown and MDX. No special configuration is required. By passing in plain text, rich text content that conforms to Semi style specifications can be rendered.


Usually used in the following scenarios:
- Document site writing and rendering
- Front-end rendering when the server dynamically generates rich text content
- A light interactive website that focuses on content display

**Note: Safari versions prior to 16.3 do not support regular lookaround assertions, which will cause upstream dependencies on mdxjs to [report errors](https://github.com/syntax-tree/mdast-util-gfm-autolink-literal/issues/10). You can pass remarkGfm as false to disable gfm syntax parsing (which will cause markdown features such as tables to fail to parse), and use null-loader or alias or other methods to ignore the remark-gfm package when compiling the project. **

## Demos

MarkdownRender supported from v2.62.0

### How to import

```jsx
import { MarkdownRender } from '@douyinfe/semi-ui';
import * as SemiMarkdownComponents from "@douyinfe/semi-ui/markdownRender/components"
```



### Basic usage
After importing MarkdownRender, just pass in Markdown or MDX plain text directly.

Introducing SemiMarkdownComponents and passing it into MarkdownRender, basic elements in the document such as text, titles, hyperlinks, pictures, tables, etc. will be rendered using Semi components. Not everyone needs these document elements, so in order to reduce the package size, they need to be introduced manually.

```jsx live=true dir="column"
import { MarkdownRender } from '@douyinfe/semi-ui';
import * as SemiMarkdownComponents from "@douyinfe/semi-ui/markdownRender/components"


function Demo(){
    return <MarkdownRender components={SemiMarkdownComponents}
                           raw={`
#### Semi Design DSM
[Semi DSM](https://semi.design/dsm) is a design system management tool provided by Semi Design. It supports global and component-level style customization and keeps synchronization between Figma and front-end code.
Suitable for teams of all sizes. Whether you need to simplify workflow, improve team collaboration, or increase productivity, we have features suitable for you.

##### Medium and large enterprises
- Up to 3000+ Design Tokens, in-depth customization of every detail, color, shadow, margin, rounded corners, dynamic effects, rendering structure can be customized freely, say goodbye to ~~CSS hard coding~~
- Powerful, UI lib verified by thousands of projects in Douyin, easy to deal with various complex scenarios
- A11y barrier-free and friendly, with complete international functions
- Community-oriented, completely open source, no usage restrictions
- From designOps to devOps, automated workflow, Figma UI Kit one-click brush into the theme, generate Style Guideline, develop a line of npm code configuration access

##### Startups
- No need to invest a lot of R&D resources from 0 to 1, quickly reuse excellent solutions from the open source community, and quickly customize a design system with brand characteristics at low cost.
- One-click support for dark mode generation, support for quickly generating a color system containing 320 full color levels and compatible with dark/light modes based on brand colors, and support dynamic switching
- Continuously evolving, DSM + Semi Design components are professionally maintained by the <u>TikTok front-end architecture team</u>, and have been stable for more than five years, and are trustworthy

##### Freelance designer/individual developer
- Quickly create design systems of different styles at low cost, less time, faster delivery
- Friendly R&D access, no need for repeated communication, deliver npm package products, and complete code access with one click

![DSM](https://semi.design/dsm_manual/content/introduction/start/start-intro.png)

| Support | Markdown tables | c | d |
| - | :- | -: | :-: |
| 1 | 2 | 3 | 4 |
| 21 | 22 | 23 | 24 |
| 31 | 32 | 33 | 34 |
| 41 | 42 | 43 | 44 |
    `}/>
}

```

### Modify element style

You can arbitrarily replace the display effect of document elements in Markdown or MDX documents. Just pass your rendering component override to the `components` props.

For example, now you need to set the color of all headings No. 1 to the main color

```jsx live=true dir="column"
import { MarkdownRender, Typography } from '@douyinfe/semi-ui';
import * as SemiMarkdownComponents from "@douyinfe/semi-ui/markdownRender/components"


function Demo() {
    const components ={...SemiMarkdownComponents};
    
    components['h2'] = ({children}) => <Typography.Title heading={2} style={{color:"var(--semi-color-primary)"}}>{children}</Typography.Title>
    
    return <MarkdownRender raw={`## From Semi Design to Any Design, quickly define your design system and apply it in design drafts and codes`} components={components} />
}


```

Basic element tag support that can be overridden `a blockquote br code em h1 h2 h3 h4 h5 hr img li ol p pre strong ul table`

### Simple Markdown
When the Markdown you render is just pure markdown without any JSX code, you can pass `format="md"` to enable Markdown-only mode. In this mode, you don't need to escape special characters.


```jsx live=true
import { MarkdownRender, Typography } from '@douyinfe/semi-ui';


function Demo() {
    const components ={};
    
    components['h1'] = ({children}) => <Typography.Title heading={1} style={{color:"var(--semi-color-primary)"}}>{children}</Typography.Title>
    
    return <MarkdownRender raw={`Symbols that do not need to be escaped{}<> ...`} format="md" components={components} />
}

```

### Add custom components

By passing in custom components to `components` Props, you can write JSX directly in Markdown, and the component will be rendered to the final page, supporting JS events.
The default Markdown components can be obtained from `MarkdownRender.defaultComponents` and can be used for secondary packaging.

<Notice type="primary" title="Note">
   <div>Try to ensure that the JSX code in the rendered Markdown is trustworthy to prevent XSS. </div>
</Notice>


```jsx live=true
import { Button, MarkdownRender, Typography } from '@douyinfe/semi-ui';
import * as SemiMarkdownComponents from "@douyinfe/semi-ui/markdownRender/components"


function Demo() {
    const components = { ...SemiMarkdownComponents };

    components['MyButton'] = ({ children,onClick }) => {
        return <Button type={"primary"} onClick={onClick} style={{marginBottom:"12px"}}> {children} </Button>
    }

    return <MarkdownRender 
        raw={`
#### Below is a button rendered in Markdown
<MyButton onClick={()=>alert("MyButton is clicked")}>MyButton click me</MyButton>

Just write JSX directly in Markdown
        `}
        components={{...MarkdownRender.defaultComponents,...components}} />
}


```

# Add plugins

Support all RemarkPlugin and RehypePlugins plugins of MDXJS through `remarkPlugins` `rehypePlugins`, please refer to [MDXJS](https://mdxjs.com/docs/extending-mdx/) for details


### API

| Properties | Description | Type | Default Value |
|------------|-----------------------------|------ ------------------------|-------|
| className | class name | string | - |
| components | Used to override Markdown elements and add custom components | Record<string, JSXElementConstructor> | - |
| format | The incoming raw type, whether it is pure Markdown | 'md'\|'mdx' | 'mdx' |
| raw | plain text in Markdown or MDX | string | - |
| remarkGfm | Whether to enable Github GFM syntax. Safari 16.3 and earlier does not support lookaround assertions and will report an error. | bool | true |
| remarkPlugins | custom Remark Plugin          | Remark Plugin Array                | - |
| rehypePlugins | custom Rehype Plugin          | Rehype Plugin Array               | - |
| style | style | CSSProperties | - |

## Design Token

<DesignToken/>

