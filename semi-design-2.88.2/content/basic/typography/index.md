---
localeCode: zh-CN
order: 23
category: 基础
title:  Typography 版式
icon: doc-typography
brief: 文字，图片，段落，数值的基本格式。
---

## 使用场景
- 对文章、博客、日志等的文本内容进行展示时。
- 对文本进行复制和省略等基础操作时。

## 代码演示

### 如何引入

```jsx import
import { Typography } from '@douyinfe/semi-ui';
```
### 标题组件
通过设置 heading 可以展示不同级别的标题。
```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Title } = Typography;
    return (
        <div>
            <Title style={{ margin: '8px 0' }} >h1. Semi Design</Title>
            <Title heading={2} style={{ margin: '8px 0' }} >h2. Semi Design</Title>
            <Title heading={3} style={{ margin: '8px 0' }} >h3. Semi Design</Title>
            <Title heading={4} style={{ margin: '8px 0' }} >h4. Semi Design</Title>
            <Title heading={5} style={{ margin: '8px 0' }} >h5. Semi Design</Title>
            <Title heading={6} style={{ margin: '8px 0' }} >h6. Semi Design</Title>
        </div>
    );
}
```

### 文本组件
内置不同样式的文本。可以通过 `icon` 属性传入图标，这种方式传入的图标默认与文本有间距，同时在链接文本的情况不会出现下划线符合设计规范。
```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;
    return (
        <div>
            <Text>Text</Text>
            <br />
            <br />
            <Text type="secondary">Secondary</Text>
            <br />
            <br />
            <Text type="tertiary">{`Tertiary v>=1.2.0`}</Text>
            <br />
            <br />
            <Text type="quaternary">{`Quaternary v>=1.2.0`}</Text>
            <br />
            <br />
            <Text type="warning">Warning</Text>
            <br />
            <br />
            <Text type="danger">Danger</Text>
            <br />
            <br />
            <Text type="success">{`Success v>=1.7.0`}</Text>
            <br />
            <br />
            <Text disabled>Disabled</Text>
            <br />
            <br />
            <Text mark>Default Mark</Text>
            <br />
            <br />
            <Text code>Example Code</Text>
            <br />
            <br />
            <Text underline>Underline</Text>
            <br />
            <br />
            <Text delete>Deleted</Text>
            <br />
            <br />
            <Text strong>Strong</Text>
        </div>
    );
}
```
链接文本支持传入 `object`，将对应的属性挂在 `<a>` 标签上。  
**v>=1.0** 后默认不再有下划线，可以配合 underline 属性在 hover，active 态增加下划线的样式。
```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { IconLink } from '@douyinfe/semi-icons';

function Demo() {
    const { Text } = Typography;
    return (
        <div>
            <Text link={{ href: 'https://semi.design/' }}>链接文本</Text>
            <br />
            <br />
            <Text link={{ href: 'https://semi.design/' }}>打开网站</Text>
            <br />
            <br />
            <Text link icon={<IconLink />} underline>带下划线的网页链接</Text>
        </div>
    );
}
```

### 段落组件
段落组件拥有两种行距，可以通过设置 `spacing='extended'` 使用更宽松的行距。
```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Paragraph, Title } = Typography;
    return (
        <div>
            <Title heading={5}>默认行距</Title>
            <Paragraph>
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
            <br />
            <Title heading={5}>宽松行距</Title>
            <Paragraph spacing="extended">
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
        </div>
    );
}
```

### 数值组件

Numeral 组件在Text组件的基础上，添加了属性: `rule`, `precision`, `truncate`, `parser`, 以提供需要单独处理文本中数值的能力。
<Notice title='注意'>
    Numeral 组件会递归遍历 Children 检测其中所有的数字文本进行转换展示，请注意控制渲染结构层级；
    <br />
    对于 rule 为 percentage 的 Numeral 组件，数据处理规则有变化。在 <strong>v2.22.0-v2.29.0</strong> 中，对于绝对值大于等于 1 的 num，结果为 num%； 对于绝对值小于等于 1 的 num，结果为 (num*100)%。在 <strong>v2.30.0</strong> 版本及之后统一为 (num*100)%。
</Notice>

`precision` 可以设置小数点后保留位数, 用于设置精度  
`truncate`  小数点后保留位截段取整方式，可选 `ceil`, `floor`, `round`，作用与  Math.ceil、Math.floor、Math.round 对齐  
`rule`  用于设置解析规则  
- 设为 `percentages` 会将数字自动转换为百分比形式展示
- 设为 `bytes-decimal` 会将数字自动换算为字节对应的单位展示， 1 KB 定义为等于 1000 字节，（B, KB, MB, GB, TB, PB, EB, ZB, YB）
- 设为 `bytes-binary` 会将数字自动换算为字节对应的单位展示，1 KiB 定义为等于 1024字节，（B, KiB, MiB, GiB, TiB, PiB, EiB, ZiB, YiB）
- 设为 `text`时，仅自动对数字进行取整，根据 `precision` 和 `truncate` 属性
- 设为 `numbers`时，会将非数字字符进行过滤，仅展示数字
- 设为 `exponential` 时,会将数字自动转换为科学计数法形式展示

```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Numeral } = Typography;
    return (
        <div>
            <Numeral precision={1}>
                <p>点赞量：1.6111e1 K</p>
            </Numeral>
            
            <p>
                播放量:
                <Numeral rule="numbers" precision={1}>
                    2.4444e2
                </Numeral>
                K
            </p>
            
            <Numeral rule="percentages" precision={2} style={{ marginBottom: 12 }}>
                <p>好评率: 0.915</p>
            </Numeral>

            <Numeral rule="percentages" style={{ marginBottom: 12 }}>
                这场比赛我的胜率是0.6，输的概率是0.4
            </Numeral>

            <Numeral rule="bytes-decimal" precision={2} truncate="floor">
                <p>已使用: 1000</p>
                <p>未使用: {1024*1000}</p> 
            </Numeral>
            
            <Numeral rule="bytes-binary" precision={2} truncate="floor">
                <p>已使用: 1024</p>
                <p>未使用: {2e12}</p>
            </Numeral>
        </div>
    );
}
```

可以通过 `parser` 自定义解析规则

```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Numeral } = Typography;

    function parserTCH(oldVal) {
        return oldVal.split(' ').map(item =>
            Number(item) ? `${item.replace(/(\d)(?=(?:\d{3})+(?:\.|$))/g, '$1,')}+` : item
        ).join(' ');
    }

    function Infos() {
        const data = [
            { type: 'Stars', min: '7100' },
            { type: 'Fork', min: '560' },
            { type: 'Downloads', min: '5000000' },
            { type: 'Contributors', min: '100' }
        ];
        return data.map(item =>
            <p key={item.min}>
                {item.type}：
                <b style={{ color: 'rgba(var(--semi-violet-5),1)' }}>
                    {item.min}
                </b>
            </p>
        );
    }

    return (
        <div>
            <Numeral parser={parserTCH} component="div">
                Semi Design 重视我们的用户，加入并助力我们不断完善
                {Infos}
            </Numeral>
            <br />
            <Numeral link={{ href: 'https://semi.design', target: '_blank' }} parser={parserTCH}>
                现已服务 {1e5} 用户，前往官网 &gt;&gt;
            </Numeral>
        </div>
    );
}
```

### 文本大小
段落组件和文本组件支持两种尺寸，`small`（12px） 和 `normal`（14px） 和 `inherit`，默认为`normal`。

当段落组件或者文本组件嵌套使用时候，设置内层组件的 `size` 属性为 `inherit`，内层组件的 size 将继承外层组件的尺寸设置。

```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Paragraph, Text } = Typography;
    return (
        <div>
            <Text>正常文本</Text>
            <Paragraph spacing="extended">
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
            <br />
            <Text size='small'>小文本</Text>
            <Paragraph size='small'>
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
            <br />
            <Text size="small">这是一段文本，样式为 small
                <Text link size="inherit">这是一段链接，设置 size 为 inherit 继承外部样式设置</Text>
            </Text>
        </div>
    );
}
```

### 可复制文本
可通过配置 copyable 属性支持文本的复制。  
当 copyable 配置为 true时，默认复制内容为 children 本身，注意，此时 children 只支持 string类型传入    
当 copyable 配置为 object 时，可通过 `copyable.content` 指定复制至粘贴板的内容，与 children 不再强关联， 此时 children 将不再限定类型，但 `copyable.content` 仍需要为 string    
可以通过 `copyable.render` 属性，自定义复制按钮的渲染逻辑

```jsx live=true
import React from 'react';
import { Typography, TextArea, Button } from '@douyinfe/semi-ui';
import { IconSetting } from '@douyinfe/semi-icons';

function Demo() {
    const { Paragraph, Text, Numeral } = Typography;

    return (
        <div>
            <Paragraph copyable>点击右边的图标复制文本。</Paragraph>
            <Paragraph copyable={{ content: 'Hello, Semi Design!' }}>点击复制文本。</Paragraph>
            <Paragraph copyable={{ onCopy: () => Toast.success({ content: '复制文本成功' }) }}>点击右边的图标复制文本。</Paragraph>
            时间戳: <Numeral truncate="ceil" copyable underline>{new Date().getTime()/1000}s</Numeral>
            <Paragraph copyable={{ icon: <IconSetting style={{ color: 'var(--semi-color-link)' }}/> }}>自定义复制节点</Paragraph>
            <Paragraph copyable={{
                content: 'Custom render!',
                render: (copied, doCopy, config) => {
                    return (
                        <Button size="small" onClick={doCopy}>
                            <span>{copied ? '复制成功' : `点击复制:${config.content}`}</span>
                        </Button>
                    );
                }
            }}>
                自定义复制渲染
            </Paragraph>
            <br/>
            <br/>
            <Text type="secondary">粘贴区域：</Text>
            <br/>
            <TextArea autosize style={{ width: 320, marginTop: 4 }} rows={3} />
        </div>
    );
}
```

### 省略文本
支持文本的省略，可以通过 `ellipsis` 配置相关参数，具体参考 [Ellipsis Config](#Ellipsis-Config)。

<Notice title='注意事项'>
    1. ellipsis 仅支持纯文本的截断，不支持 reactNode 等复杂类型，请确保 children 传入内容类型为 string <br/>
    2. ellipsis 要实现缩略，需要有明确的 width或 maxWidth 宽度限制做对比判断。若自身未设置宽度（例如纯依靠 flex 属性撑开），或 width为 100% 等不定数值，那么父级需要有明确的 width或 maxWidth <br/>
    3. ellipsis 需要获取 DOM 的宽高度等信息用以做基本判断，若自身或父级存在 display:none 样式会导致取值不正确，此时缩略会失效<br/>
    4. 省略文本的计算，分为CSS 截断和 JS 截断，强依赖 DOM 元素的相关状态获取。在结构复杂的页面，大量使用 Typography 可能会导致过多的 reflow 重排，建议选择合适的省略方式避免造成性能负担。更多信息见 <a href="#faq">FAQ</a> 
</Notice>


```jsx live=true
import React from 'react';
import { Typography, Tooltip } from '@douyinfe/semi-ui';

function Demo() {
    const { Paragraph, Title, Text } = Typography;
    const customRenderTooltip = useCallback((content, children) => {
        return <Tooltip content={content} style={{ backgroundColor: 'var(--semi-color-primary)' }}>{children}</Tooltip>;
    }, []);

    return (
        <div>
            <Title heading={5} ellipsis={{ showTooltip: true }} style={{ width: 250 }}>
                是一个很长很长很长很长5号标题
            </Title>
            <br />
            <Text 
                ellipsis={{ 
                    showTooltip: {
                        opts: { content: '这是自定义要展示的内容' }
                    }
                }}
                style={{ width: 150 }}
            >
                可以自定义浮层里的展示内容试试看吧
            </Text>
            <br/>
            {/* link还可以传入object，如link={{ href: 'https://semi.design/zh-CN/basic/typography', target: '_blank' }} */}
            <Text link ellipsis={{ showTooltip: true, pos: 'middle' }} style={{ width: 150 }}>
                是一个很长很长很长很长的链接
            </Text>
            <br/>
            <Paragraph ellipsis={{ suffix: '小尾巴' }} style={{ width: 300 }}>
                有后缀的情况：Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
            </Paragraph>
            <br/>
            <Paragraph ellipsis={{ rows: 3 }} style={{ width: 300 }}>
                这是一个多行截断的例子：Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
            <br/>
            <Paragraph ellipsis={{ rows: 3, showTooltip: { type: 'popover', opts: { style: { width: 300 } } } }} style={{ width: 300 }}>
                多行截断，展示 Popover：Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
            <br/>
            <Paragraph ellipsis={{ rows: 3, expandable: true, collapsible: true, collapseText: '折叠我吧', onExpand: (bool, e) => console.log(bool, e) }} style={{ width: 300 }}>
                支持展开和折叠：Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            </Paragraph>
            <br/>
            <Text 
                ellipsis={{ 
                    showTooltip: {
                        opts: { content: '全英文设置了word-break' }
                    },
                    pos: 'middle'
                }}
                style={{ width: 150, wordBreak: 'break-word' }}
            >
                sssssssssssssssssssssssss
            </Text>
            <br/><br/>
            <Title 
                heading={5} 
                ellipsis={{ 
                    showTooltip: {
                        renderTooltip: customRenderTooltip
                    }
                }} 
                style={{ width: 250 }}
            >
                这是一个自定义弹出层组件的省略文本，背景色是蓝色
            </Title>
        </div>
    );
}
```

<Notice type="primary" title="注意事项">
    <div>当发生超长文本在弹出的 tooltip 没有换行时，可通过手动设置一下 <a href="https://developer.mozilla.org/zh-CN/docs/Web/CSS/word-break" target="_blank" rel="noopener noreferrer">word-break</a> 或者 <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap" target= "_blank" rel="noopener noreferrer">word-wrap</a> 等换行相关属性进行调整, 更多细节可查看 Tooltip 的 FAQ 部分</div>
</Notice>

```jsx live=true
import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

function Demo() {
    const { Text } = Typography;

    return (
        <div>
            <Text 
                ellipsis={{ 
                    showTooltip: {
                        opts: { content: '架构|Semi-inf|graph.cheet.relation' }
                    }
                }}
                style={{ width: 150 }}
            >
                有问题的超长文本发生截断时可按需进行自定义配置
            </Text>
            <br />
            <Text 
                ellipsis={{ 
                    showTooltip: {
                        opts: { content: '架构|Semi-inf|graph.cheet.relation', className: 'components-typography-demo' }
                    }
                }}
                style={{ width: 150 }}
            >
                覆盖类名超长文本发生截断时可使用类名覆盖进行自定义配置
            </Text>
            <br />
            <Text 
                ellipsis={{
                    showTooltip: {
                        opts: { content: '架构|Semi-inf|graph.cheet.relation', style: { wordBreak: 'break-all' } }
                    }
                }}
                style={{ width: 150 }}
            >
                覆盖style超长文本发生截断时可使用style进行自定义配置
            </Text>
        </div>
    );
}
```

```scss
// 按需配置 word-break

.components-typography-demo {
    word-break: break-word;
    // 或
    word-break: break-all;
}
```

## API参考

### Typography.Text

| 属性      | 说明                                                                                                                                    | 类型                              | 默认值    | 版本   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------- | ------ |
| component | 自定义渲染元素                                                                                                                          | html element                      | span      |        |
| code      | 是否被 `code` 元素包裹                                                                                                                          | boolean                      | -      |        |
| copyable  | 是否可拷贝                                                                                                                              | boolean \| object:[Copyable Config](#Copyable-Config) | false     |  |
| delete    | 添加删除线样式                                                                                                                          | boolean                           | false     |  |
| disabled  | 禁用文本                                                                                                                                | boolean                           | false     |  |
| ellipsis  | 设置自动溢出省略                                                                                                                        | boolean\|object:Ellipsis Config   | false     |  |
| icon      | 前缀图标                                                                                                                                | ReactNode                         | -         |  |
| link      | 是否为链接，传object时，属性将透传给a标签                                                                                               | boolean\|object                   | false     |  |
| mark      | 添加标记样式                                                                                                                            | boolean                           | false     |  |
| size      | 文本大小，可选`normal`，`small`，`inherit`                                                                                                         | string                            | `normal`  |  |
| strong    | 是否加粗                                                                                                                                | boolean                           | false     |  |
| type      | 文本类型，可选 `primary`, `secondary`, `warning`, `danger`, `tertiary`(**v>=1.2.0**), `quaternary`(**v>=1.2.0**), `success`(**v>=1.7.0**) | string                            | `primary` |  |
| underline | 添加下划线样式                                                                                                                          | boolean                           | false     |  |
| weight | 设置字重  |  number                                        |  | 2.34.0 |


### Typography.Title

| 属性      | 说明                                                                                                                                      | 类型                                                    | 默认值  | 版本     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |-------------------------------------------------------| ------- |--------|
| component | 自定义渲染元素，默认由 heading 决定                                                                                                       | html element                                          | h1~h6   |        |
| copyable  | 是否可拷贝                                                                                                                                | boolean \| object:[Copyable Config](#Copyable-Config) | false   |  |
| delete    | 添加删除线样式                                                                                                                            | boolean                                               | false   |  |
| disabled  | 禁用文本                                                                                                                                  | boolean                                               | false   |  |
| ellipsis  | 设置自动溢出省略                                                                                                                          | boolean\|object:Ellipsis Config                       | false   |  |
| heading   | 标题级别，可选1， 2， 3，4，5，6，对应相应的标题                                                                                          | number                                                | 1       |  |
| link      | 是否为链接，传object时，属性将透传给a标签                                                                                                 | boolean\|object                                       | false   |  |
| mark      | 添加标记样式                                                                                                                              | boolean                                               | false   |  |
| type      | 文本类型，可选 `primary`, `secondary`, `warning`, `danger`, `tertiary`(**v>=1.2.0**), `quaternary`(**v>=1.2.0**), `success`(**v>=1.7.0**) | string                                                | `primary` |  |
| underline | 添加下划线样式                                                                                                                            | boolean                                               | false   |  |
| weight | 设置字重, 可选 `light`, `regular`, `medium`, `semibold`, `bold`, `default`  | string, number                                        |  | 2.34.0 |

### Typography.Paragraph

| 属性      | 说明                                                                                                                                      | 类型                              | 默认值    | 版本   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------- | ------ |
| component | 自定义渲染元素                                                                                                                            | html element                      | p         |        |
| copyable  | 是否可拷贝                                                                                                                                | boolean \| object:[Copyable Config](#Copyable-Config) | false     |  |
| delete    | 添加删除线样式                                                                                                                            | boolean                           | false     |  |
| disabled  | 禁用文本                                                                                                                                  | boolean                           | false     |  |
| ellipsis  | 设置自动溢出省略                                                                                                                          | boolean\|object:Ellipsis Config   | false     |  |
| link      | 是否为链接，传object时，属性将透传给a标签                                                                                                 | boolean\|object                   | false     |  |
| mark      | 添加标记样式                                                                                                                              | boolean                           | false     |  |
| size      | 文本大小，可选`normal`，`small`                                                                                                           | string                            | `normal`  |  |
| spacing   | 行距大小，可选`normal`，`extended`                                                                                                           | string                            | `normal`  |  |
| strong    | 是否加粗                                                                                                                                  | boolean                           | false     |  |
| type      | 文本类型，可选 `primary`, `secondary`, `warning`, `danger`, `tertiary`(**v>=1.2.0**), `quaternary`(**v>=1.2.0**), `success`(**v>=1.7.0**) | string                            | `primary` |  |
| underline | 添加下划线样式                                                                                                                            | boolean                           | false     |  |

### Typography.Numeral

| 属性        | 说明                                                                                                                             | 类型                        | 默认值                                        | 版本   |
|-----------|--------------------------------------------------------------------------------------------------------------------------------|---------------------------|--------------------------------------------| ------ |
| rule      | 解析规则，可选 `text`, `numbers`, `bytes-decimal`, `bytes-binary`, `percentages`, `exponential`                               | string                    | `text`                                     | 2.22.0       |
| precision  | 可以设置小数点后保留位数, 用于设置精度                                                                                                                       | number                    | 0                                          | 2.22.0       |
| truncate  | 小数点后保留位截段取整方式，可选 `ceil`, `floor`, `round`，作用与  Math.ceil、Math.floor、Math.round 对齐                                                                                      | string                    | `round`                                    | 2.22.0       |
| parser    | 自定义数值解析函数                                                                                                                      | (str: string) => string | -                                          | 2.22.0       |
| component | 自定义渲染元素                                                                                                                        | html element              | span                                       | 2.22.0       |
| code      | 是否被 `code` 元素包裹                                                                                                                | boolean                   | -                                          |  2.22.0      |
| copyable  | 是否可拷贝                                                                                                                          | boolean \| object:[Copyable Config](#Copyable-Config) | false     | 2.22.0 |
| delete    | 添加删除线样式                                                                                                                        | boolean                   | false                                      | 2.22.0 |
| disabled  | 禁用文本                                                                                                                           | boolean                   | false                                      | 2.22.0 |
| ellipsis  | 设置自动溢出省略                                                                                                                       | boolean\| object:Ellipsis Config                     | false     | 2.22.0 |
| icon      | 前缀图标                                                                                                                           | ReactNode                 | -                                          | 2.22.0 |
| link      | 是否为链接，传object时，属性将透传给a标签                                                                                                       | boolean\|object                                     | false     | 2.22.0 |
| mark      | 添加标记样式                                                                                                                         | boolean                   | false                                      | 2.22.0 |
| size      | 文本大小，可选`normal`，`small`                                                                                                        | string                    | `normal`                                   | 2.22.0 |
| strong    | 是否加粗                                                                                                                           | boolean                   | false                                      | 2.22.0 |
| type      | 文本类型，可选 `primary`, `secondary`, `warning`, `danger`, `tertiary`, `quaternary`, `success` | string                    | `primary`                                  | 2.22.0 |
| underline | 添加下划线样式                                                                                                                        | boolean                   | false                                      | 2.22.0 |


### Ellipsis Config

| 属性         | 说明                                                                                                              | 类型                                                | 默认值 |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| collapseText | 折叠的展示文本                                                                                                    | string                                              | `收起` |
| collapsible  | 是否支持折叠                                                                                                      | boolean                                             | false  |
| expandText   | 展开的展示文本                                                                                                    | string                                              | `展开` |
| expandable   | 是否支持展开                                                                                                      | boolean                                             | false  |
| pos          | 省略截断的位置，支持末尾和中间截断：`end`, `middle`                                                               | string                                              | `end`  |
| rows         | 省略溢出行数                                                                                                      | number                                              | 1      |
| showTooltip  | 是否展示 tooltip 及相关配置: type，浮层内容承载的组件，支持 Tooltip\| Popover；opts，其他需要透传给浮层组件的属性； renderTooltip，自定义渲染弹出层组件 | boolean\|{type: 'tooltip'\|'popover', opts: object, renderTooltip: (content: ReactNode, children: ReactNode) => ReactNode} | false  |
| suffix       | 始终展示的后缀                                                                                                    | string                                              | -      |
| onExpand     | 展开/收起的回调                                                                                                   | function(expanded: bool, Event: e)                  | -      |

### Copyable Config
| 属性       | 说明                        | 类型                                           | 默认值 | 版本   |
| ---------- | --------------------------- | ---------------------------------------------- | ------ | ------ |
| content    | 复制出的文本                | string                                         | -      |  |
| copyTip    | 复制图标的 tooltip 展示内容 | React.node                                     | -      |   |
| icon       | 自定义渲染复制节点       | React.node                                       | -      | 2.31.0 |
| onCopy     | 复制回调                    | Function(e:Event, content:string, res:boolean) | -      |  |
| render | 自定义渲染复制节点       | <ApiType detail='(copied: boolean, doCopy: (e: React.MouseEvent) => void, configs: CopyableConfig) => React.ReactNode'>function(copied, doCopy, configs)</ApiType> | -      | 2.65.0 |
| successTip | 复制成功的展示内容          | React.node                                     | -      |  |



## 文案规范
- Link
  - 文字链接需要清晰且可预测，用户应该能够预测他们点击链接时会发生什么
  - 切勿通过错误标记链接来误导用户
  - 避免使用“Click here”或“Here”作为独立链接

| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| No spaces yet? <PureA> Create space </PureA>| No spaces yet? <PureA>Click here</PureA> |

- 避免将整个句子作为可点击的文字链接，而是将描述具体去向的文字作为链接内容

| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| Views <PureA>user documentation</PureA> for details|<PureA>View user documentation for details</PureA> |

- 使用短术语或词作为链接文本会更有利于国际化，以避免由于不同的语言的语法和语序不同，而出现链接文字被拆分的问题

| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| Manage <PureA>notifications </PureA>to| <PureA>Manage notifications</PureA> to |

- 以文字链接结尾时，不需要跟随标点符号，除了问号“？”

| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| No spaces yet? <PureA> Create space </PureA> | No spaces yet? <PureA>Click here</PureA> |
| <PureA> Forgot password ？</PureA> |<PureA>Forgot password</PureA> |

- 链接文字不要包含冠词“the, a, an”

| ✅ 推荐用法 | ❌ 不推荐用法 |   
| --- | --- | 
| View <PureA> user documentation </PureA> for details| View the<PureA> user documentation</PureA> for details |

## 设计变量
<DesignToken/>

## FAQ

- **Typography 省略具体机制及注意事项?**

    Semi 截断有两种策略， CSS 截断和 JS 截断。当设置中间截断（pos='middle')、可展开（expandable)、有后缀（suffix 非空）、可复制（copyable），启用 JS 截断策略；非以上场景，启用 CSS 截断策略。

    通常来说，CSS 截断性能优于 JS 截断。在 children、 容器尺寸不变的情况下，CSS 截断只涉及 1~2 次计算，js 截断可能涉及多次计算。

    同时使用大量带有截断功能的 Typography 需注意性能消耗，如在 Table 中，可通过设置合理的页容量进行分页减少性能损耗。
