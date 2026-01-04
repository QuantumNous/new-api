---
category: 开始
title: Update 从 1.x 到 2.0
icon: doc-updateV2
localeCode: zh-CN
order: 16
---

### 升级准备

请将你当前所有已修改的代码提交，checkout 出单独的 git 分支，保证 git 工作区干净

### 开始升级

### 安装 Semi 2.0

```bash
npm i @douyinfe/semi-ui@latest
```

### 修改代码

对涉及到 breaking change 的代码进行修改，你可以手动对照下方[不兼容列表](/zh-CN/start/update-to-v2#2.0%20%E6%9C%89%E5%93%AA%E4%BA%9B%E4%B8%8D%E5%85%BC%E5%AE%B9%E7%9A%84%E5%8F%98%E5%8C%96)逐条检查代码进行修改。  
另外我们也提供了一个 codemod cli 工具以帮助你快速升级到 2.0 版本

##### 1.全局安装自动升级工具:

```bash
npm i @ies/semi-codemod-v2@latest -g # bnpm源
```

##### 2.使用 semi-codemod-v2 对项目代码进行扫描，并对 breaking change 进行自动修改
若你希望了解 codemod具体做的自动变更范围，可以查看[这篇文档](https://github.com/DouyinFE/semi-design/wiki/About-semi-codemod-v2)

```
semi-codemod-v2 <ProjectPath> [options]

//  options:
//    --dry,        Dry run (no changes are made to files)   是否只运行而不将实际修改写入文件
//    --force,      Whether ignore git status;               为 true 时将不检查 git 工作区是否干净
//    --verbose=2,  Log level, optional: 0/1/2, default: 0   日志级别
```

| 使用示例 | 需执行命令 |
| --- | --- |
| 当希望扫描并升级整个项目的所有文件时<br/>(项目路径为root/workspace/demo-project) | `semi-codemod-v2 root/workspace/demo-project` |
| 只希望扫描并升级单个文件时 | `semi-codemod-v2 root/workspace/demo-project/testFile.jsx` |
| 只希望扫描并升级单个文件时，但只希望将变更结果输出至 terminal，而不将实际修改写入文件时 | `semi-codemod-v2 root/workspace/demo-project/testFile.jsx --dry` |

<br/>

![codemod](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/codemod.gif)
```
// 命令行 Result 输出说明
Results:
  0 errors       // 运行该转换规则，但在执行替换过程发生了错误的文件个数
  13 unmodified  // 符合该条匹配规则，但没有进行修改（即使用了该组件，但没有涉及到相关废弃的API）的文件个数
  158 skipped    // 不符合该条匹配规则，已跳过的文件个数
  4 ok           // 共有4个文件符合替换规则，cli已进行了自动修改
Time elapsed: 5.398seconds
```

##### 3.对于可识别但无法自动修改的部分，codemod 会在命令行进行提示，抛出 warning，你需要建议按提示手动修改

![warning](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/waringDemo.png)
所有 warning 日志会在 ProjectPath 下 semi-codemod-log.log 文件进行输出，你可以按照log日志逐条检查修改

##### 4.更新 CSS Variable 的使用方式

若你在代码中使用了 Semi 的 CSS Variable，除了需要使用 semi-codemod-v2 外，你还需要使用我们提供的 style-lint 工具，对所有 CSS Variable 的使用进行自动更新

- 安装 Semi style-lint 包

```bash
# 需指定 npm 源为 bnpm
npm i -D @ies/stylelint-semi@2.0.0-alpha.1
```

- 创建或修改 `.stylelintrc.json` 文件

```json
{
  "plugins": ["@ies/stylelint-semi"],
  "rules": {
    "semi/css-token-migrate": [true, { "severity": "warning" }]
  }
}
```

- CSS Token 从 1.x 升级为 2.x

```bash
# "**/*.scss" 或者其他文件/目录，可以处理 JSX、TSX、CSS、SCSS、LESS 等格式的文件
npx stylelint "**/*.scss" --fix    // 处理scss中的 CSS 变量
npx stylelint "**/*.tsx" --fix     // 处理tsx中的内联style中的 CSS 变量
npx stylelint "**/*.jsx" --fix     // 处理jsx中的内联style中的 CSS 变量
```

> 自动替换依赖 stylelint，仅替换在样式文件或 style 属性里的颜色变量（引用的值不会替换），建议替换后全局搜索一下没有替换干净的地方

```
// replace '--amber-0' to '--semi-amber-0'
const searchReg = /--((amber|black|blue|cyan|green|grey|indigo|light|lime|orange|pink|purple|red|teal|violet|yellow|white|color|shadow|overlay|border|gray)(-[a-z\d]+)*)/;
const replaceReg = /--semi-$1/;
```

![VS Code token replace](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vscode-semi-token-replace.png)

##### 5.更新主题包

若你的项目中使用了自定义主题包，需要前往 [Semi DSM](https://semi.design/dsm) （即原 Semi 主题商店的升级版）进行 2.x 版本主题包的发布。并将新版主题 npm 包安装至项目内。
注意 Semi V1 的主题包 与 Semi V2 并不兼容，请务必重新发布。

##### 6. 运行你的项目，进行dev构建。对抛出error的代码段 进行修改

由于 codemod 依赖 AST语法树进行分析并替换，不排除有依靠 AST 分析无法检测的情况。且由于我们在2.x版本进行了 TS重构，相关类型定义会比1.x更加严格。可能存在部分类型检查在 1.x能通过，在2.x无法通过编译的情况。
这类case在构建阶段会直接暴露，因此你可以case by case直接进行对应修改。

##### 7.执行 git diff review 所有代码改动，回归相关页面

至此，你已完成所有升级步骤🥳  
尽管我们尽可能地考虑了用户的使用场景，但仍不能排除会有遗漏或依靠 AST 分析无法检测的情况（[当前已知的无法被检测或修改的Case](https://bytedance.feishu.cn/docs/doccnOIgRqiqeBkhYzro1Bmvd8e#)），codemod 的自动修改/检测可能不能覆盖所有场景。如果发现有 codemod未覆盖的case，可以拉起oncall进行反馈。  
请对所有涉及改动的页面进行回归测试。



## 2.0 有哪些不兼容的变化

### 🎁 包名的调整

v2.0 Semi 正式开源发布至公网 npm，包名需要调整，去除原有的 `@ies` 前缀，更新为 `@douyinfe` 前缀。

### 🔍 import 路径变化

#### 引入组件

```text
// before
import { Select, Input, Form } from '@ies/semi-ui-react';

// after
import { Select, Input, Form } from '@douyinfe/semi-ui';
```

#### 引入 interface（TypeScript 项目）

所有 Interface 的相关变更可查阅 [Semi 1.x -> 2.0 TS interface变更详细记录](https://bytedance.feishu.cn/docs/doccn5abrdIWvXO7No0Wkh8zo4b)
```text
// before
import { SelectProps } from '@ies/semi-ui-react/select';

// now
import { SelectProps } from '@douyinfe/semi-ui/lib/es/select';
```

#### 引入 locale 资源文件

```text
// before
import en_GB from '@ies/semi-ui-react/locale/source/en_GB';

// now
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';
```

### 🛠 API 相关的调整

-   Icon 相关
    -   Icon 组件不再支持 type=xxx 方式使用内置 icon
    -   自定义 svg 不再支持插件方式配置 srcSvgPaths
    -   Button icon 属性不再支持通过 string 传递内置 icon 或 iconType
    -   Dropdown 删除 iconType 属性，统一为 icon 属性
    -   Navigation
        -   Nav.item 组件, Nav.Sub 组件 props.icon 不再支持通过 string 方式传入，需要传入 ReactNode
        -   Nav 组件 props.items 中的 icon 也不再支持通过 string 方式传入，需要传入 ReactNode
    -   Notification icon 不再支持通过 string 方式传入，请统一使用 ReactNode
    -   Banner icon、closeIcon不再支持string，需要替换为对应的ReactNode
    -   Typography.Text的icon不再支持string，需要替换为对应的ReactNode
    -   Breadcrumb.Item的icon不再支持string，需要替换为对应的ReactNode
-   AutoComplete 正式废弃 onChangeWithObject 属性
-   Cascader triggerRender 的入参移除 onInputChange
-   Form 不再从 `semi-ui/index.js` 导出 Label 组件，如需使用请用 Form.Label
-   Tree onRightClick 更名为 onContextMenu
-   Upload dragable 更名为 draggable
-   Tooltip 不再支持 disabled 属性，依赖 Tooltip 的组件（如 Popover、Dropdown 等）透传给 Tooltip disabled 将失效
-   Table
    -   不再在 componentDidUpdate 时响应的 API
        -   defaultExpandAllRows，请用 expandAllRows 替换
        -   defaultExpandRowKeys，请用 expandRowKeys 替换
        -   defaultExpandAllGroupRows，请用 expandAllGroupRows 替换


### 🎨 样式上的不兼容

-   CSS 变量添加 semi 前缀，例如 --color-primary => --semi-color-primary
    -   使用了 Semi CSS Variable 来实现暗色模式等特性的用户，需要将自定义 CSS 中的 variable 统一进行更新
    -   未在自定义组件或页面的中使用 Semi CSS Variable 的用户无需关注，不受影响
-   在 2.x，统一将插画的宽高设置为 `200 * 200px`，如果想模拟 1.x 的宽高，可以给插画设置 `style={{ width: 300, height: 150 }}`。
-   Icon 组件的共有className 由 `semi-icons` 变更为 `semi-icon`，对齐组件命名
### 插件调整

如果你使用 Semi 插件，如 `@ies/semi-ui-plugin-webpack` 或 `@ies/semi-ui-plugin-eden` 等进行了高级配置，需要了解以下变更：

-   svg 相关
    -   2.x 不再支持 iconLazyLoad （因为已经支持Shaking）
    -   svgPaths、srcSvgPaths 配置不再支持，你可以通过使用 svgr webpack 插件作为替换，详细可参考 [Icon组件](/zh-CN/basic/icon#%E4%BD%BF%E7%94%A8svgr%E5%B0%86svg%E6%96%87%E4%BB%B6%E8%BD%AC%E6%88%90ReactComponent)

-   暗色模式相关
    -   2.x 默认已支持局部暗色模式、亮色模式，不再需要在插件配置 themeScope 属性。使用方式由添加 id #semi-always-xxx 更新为添加 class .semi-always-xxx。


### 其他调整

#### Icon/插画使用调整

在 0.x/1.x 版本的 Semi 中，我们强依赖 svg-sprite-loader 将 svg 文件转换为 svg symbol 并在运行时插入 body，使得我们可以仅通过 <Icon type='xxx' / > 以字符串的方式去使用 Icon 图标。在便捷使用的同时，也带来了一些问题：icon 默认全量引入，无法被 shaking；svg-sprite-loader 与 Webpack 强绑定，无法便捷地支持 Rollup、Vite 等其他构建方案。因此 2.0 中，我们去除了与 svg-sprite-loader 的强绑定，Icon 的消费方式需要变更：

Icon 使用调整：

```text
// 1.x 默认 iconLazyload 为 false 的情况
<Icon type="home" />;

// 1.x 当 iconLazyload 为 true 的情况
import homeSvg from '@ies/semi-icons/semi-icons-home.svg';
<Icon type={homeSvg.id} />;

// 2.x 统一使用如下方式使用
import { IconHome } from '@douyinfe/semi-icons';
<IconHome />;
```

插画使用调整：

```text
// 1.x
import { Empty } from '@ies/semi-ui-react';
import Construction from '@ies/semi-illustrations/construction.svg';
<Empty image={Construction} />;

// 2.x
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationConstruction } from '@douyinfe/semi-illustrations';
<Empty image={<IllustrationConstruction />} />;
```

#### Design Token 调整

| 组件 | Sass 变量 | 调整前 | 调整后 |
| --- | --- | --- | --- |
| Popconfirm | \$color-popconfirm_body-text | var(--semi-color-tertiary) | var(--semi-color-text-2) |
|  | \$color-popconfirm_header_alert-icon | #fa7500 | var(--semi-color-warning) |
| Progress | \$spacing-progress_line_text-marginLeft | 15px | \$spacing-base |
|  | \$spacing-progress_line_text-marginRight | 15px | \$spacing-base |
| Radio | \$spacing-radio_addon_buttonRadio_large-paddingY | 6px | \$spacing-base-tight / 2 |
|  | \$radius-radio_cardRadioGroup | 3px | var(--semi-border-radius-small) |


## FAQ

### 为什么引用路径发生了变化？

在 1.x 中，Semi 采用源码发布的方式，执行 npm publish 前不会执行预编译，组件库的 Scss、jsx/js 会跟随业务代码一同进行编译，2.0 中 npm publish 前进行了预编译，对于普通用户来说，预编译可以让 Semi 做到开箱即用：无需让用户编译 Semi 源文件，无需在使用时引入 Semi 插件。由于编译后的结果在 lib/es 下，因此接口和语言包的引用路径发生了变化，但对于组件引用，你无需改变原有的引用路径（因为 package.json main 属性指向 lib/es/index.js）。

### 项目希望升级至 2.0，但项目中使用了 Semi 物料，物料基于 1.x Semi，是否可同时使用？

不可以，semi2.x的css类名与semi1.x的相同，同时使用会导致样式冲突。如遇到类似问题，请在飞书群里发起oncall，会有专人对接处理。

### CSS 变量添加 semi 前缀的原因？

由于业务方微前端应用场景日渐增多，为避免与其他 library css variable 的命名冲突，规避样式互相影响问题。

### 为什么局部暗色/亮色模式由添加 id 改为添加 class？

id 具有语义上全局唯一的特点，class 则没有这个特点，使用 class 更符合规范。

### 为什么插画的尺寸有变化？

使用插画时，1.x 的插画宽高是 `300 * 150px`，是由于插画 svg 外层嵌套 svg 导致，这一状况导致，原有的插画左右多了空白，不太符合预期。

### 其他与字节内部框架的兼容问题？
字节跳动用户，请查阅对应[飞书文档](https://bytedance.feishu.cn/docx/doxcnkrOpKFwK9ugkkcfAsUJqYd)
 
## 遇到问题

我们列出了已知的所有不兼容变化和相关影响，但是有可能还是有一些场景我们没有考虑到。如果你在升级过程中遇到了问题，欢迎随时通过客服群进行反馈沟通
