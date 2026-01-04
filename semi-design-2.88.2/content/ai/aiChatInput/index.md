---
localeCode: zh-CN
order: 100
category: Ai
title: AIChatInput 聊天输入框
icon: doc-aiInput
width: 60%
brief: 用于 AI 聊天场景下的输入框
showNew: true
---

## 使用场景

在 AI 聊天场景下，用户可通过 `AIChatInput`实现富文本输入、上传、引用、建议、模版、功能配置、及丰富自定义展示等需求。

`AIChatInput` 的富文本输入是基于 [tiptap](https://tiptap.dev/docs/editor/getting-started/overview) 实现，`tiptap` 是一款现代的富文本编辑器开发框架，支持 React、Vue 前端框架，具备极强的可定制性和扩展性。其组件化能力优秀，性能优良，内置多种常用拓展，并支持用户自定义节点、命令、插件与菜单，使复杂 AI 场景下的富文本输入能力能够灵活适配和扩展。Semi 的 `AIChatInput` 组件对 tiptap 进行了封装，开发者可开箱即用或按需按业务扩展。

## 代码演示

### 如何引入

```jsx import
import { AIChatInput } from '@douyinfe/semi-ui';
```

### 基本用法

支持文本输入以及文件上传，使用时可按需配置以下参数：

- `uploadProps` 配置文件上传相关的参数，详见 [UploadProps](/zh-CN/plus/upload#API)
- `onUploadChange` 获取文件上传变化
- `placeholder` 输入框的占位符
- `defaultContent` 输入框的默认内容
- `onContentChange` 输入框内容变化时的回调函数，参数为当前输入框的内容

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };

function Basic() {
    const onContentChange = useCallback((content) => {
        console.log('onContentChange', content);
    }, []);

    const onUploadChange = useCallback((fileList) => {
        console.log('onUploadChange', fileList);
    }, []);
  
    return (
        <AIChatInput
            placeholder={'输入内容或者上传内容...'} 
            uploadProps={uploadProps}
            onContentChange={onContentChange}
            onUploadChange={onUploadChange}
            style={outerStyle} 
        />
    );
};

render(<Basic />);
```

### 消息发送

当输入框中有内容（包括输入文本，上传内容，[引用内容](/zh-CN/plus/aiChatInput#%E5%BC%95%E7%94%A8)），将允许发送消息。点击消息发送按钮，会触发 `onMessageSend` 回调函数，参数为当前输入框的内容，包括输入区域的文本，引用内容，上传文件，配置区域内容。

用户可在 `onMessageSend` 中根据判断是否设置 `generating` 表示消息正在处理中，如果 `generating` 为 `true`，则 AIChatInput 会在发送按钮位置显示停止生成按钮，并清空输入区的消息，以及上传文件，另外，引用内容需要用户自行清除。

点击停止生成按钮，会触发 `onStopGenerate` 回调函数，用户可在该回调函数中处理停止生成的逻辑， 如将 `generating` 设为 `false`。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { 
    action: "https://api.semi.design/upload",
    defaultFileList: [{
        uid: '1',
        name: 'dy.jpeg',
        status: 'success',
        size: '130kb',
        url:
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png',
    },
    {
        uid: '5',
        name: 'resso.jpeg',
        percent: 50,
        size: '222kb',
        url:
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png',
    }],
};
const outerStyle = { margin: 12 };

const reference = [
    {
        id: '1',
        type: 'text',
        content: '测试文本，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字,这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字',
    }
];

function SendMessageAndStopGenerate() {
    const [references, setReferences] = useState(reference);
    const [generating, setGenerating] = useState(false);
    const onContentChange = useCallback((content) => {
        console.log('onContentChange', content);
    }, []);

    const onUploadChange = useCallback((fileList) => {
        console.log('onUploadChange', fileList);
    }, []);

    const toggleGenerate = useCallback((props) => {
        setGenerating(value => !value);
    }, []);

    const onMessageSend = useCallback((content) => {
        toggleGenerate();
        setReferences([]);
    }, []);

     
    const handleReferenceDelete = useCallback((item) => {
        setReferences((references) => {
            const newReference = references.filter((ref) => ref.id !== item.id);
            return newReference;
        });
    }, []);
    
    return (
        <AIChatInput
            defaultContent={"点击发送按钮，观察上传内容、引用内容、输入框内容变化"}
            generating={generating}
            uploadProps={uploadProps}
            onContentChange={onContentChange}
            onUploadChange={onUploadChange}
            style={outerStyle}
            onMessageSend={onMessageSend}
            onStopGenerate={toggleGenerate}
            onReferenceDelete={handleReferenceDelete}
            references={references}
        />
    );
};

render(<SendMessageAndStopGenerate />);
```

### 富文本输入区

AIChatInput 使用 [tiptap](https://tiptap.dev/docs/editor/getting-started/overview) 作为富文本输入框的编辑器，用户可以在输入框中输入文本，使用 AIChatInput 内置的 extensions（包括 `input-slot`，`select-slot`，`skill-slot`）。用户也可以自定义 extensions 来扩展编辑器的功能。

- `input-slot` 支持用户输入文本，并支持 placeholder 占位符。
- `select-slot` 支持用户进行简单的选择，选项仅支持 string 类型。
- `skill-slot` 是用于技能展示的块，方便用户理解当前输入框中的技能。

可以通过 ref 方法 `setContent` 来设置输入框的内容，使用 `focusEditor` 方法可以将输入框的焦点设置到编辑器中。

```jsx live=true dir="column" noInline=true
import React, { useRef, useCallback } from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const temp = {
    'input-slot': '我是一个<input-slot placeholder="[职业]">程序员</input-slot>',
    'select-slot': `我是<select-slot value="前端开发" options='["设计","前端开发","后端开发"]'></select-slot>，帮我完成...`,
    'skill-slot': `<skill-slot data-label="AI Coding" data-value="AI Coding" data-template=false></skill-slot> 帮我完成...`,
};

function RichTextExample() {
    const [activeIndex, setActiveIndex] = useState(0);
    const ref = useRef();

    const setTemplate = useCallback((event) => {
        const index = Number(event.target.dataset.index);
        setActiveIndex(index);
        const content = Object.values(temp)[index];
        if (ref.current) {
            ref.current.setContent(content);
            ref.current.focusEditor();
        }
    }, [ref]);

    return (<>
        <div className="aiChatInput-radio">
            {Object.keys(temp).map((item, index) => {
                return <div 
                    className={`aiChatInput-radio-item ${index === activeIndex ? 'aiChatInput-radio-item-selected' : ''}` }
                    key={index} 
                    data-index={index} 
                    onClick={setTemplate}
                >{item}</div>;
            })}
        </div>
        <AIChatInput
            ref={ref}
            defaultContent={temp['input-slot']}
            placeholder={'输入内容或者上传内容'} 
            uploadProps={uploadProps}
            style={outerStyle} 
        />
    </>);
};

render(<RichTextExample />);
```

### 引用

用户可以 `references` 传入引用内容，引用内容会展示在输入框的顶部。

- `renderReference` 自定义单个引用内容的渲染。
- `onReferenceDelete` 处理引用内容的删除。
- `onReferenceClick` 处理引用内容的点击。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const referenceTemp = [
    {
        id: '1',
        type: 'text',
        content: '测试文本，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字,这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字',
    },
    {
        id: '2',
        name: '飞书文档.docx',
    },
    {
        id: '3',
        name: '飞书文档.pdf',
    },
    {
        id: '4',
        name: 'Music.mp4',
    },
    {
        id: '5',
        name: 'Image.jpeg',
        url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png'
    },
    {
        id: '6',
        name: 'code.json',
    }
];

function Reference() {
    const [references, setReferences] = useState(referenceTemp);
    const handleReferenceDelete = useCallback((item) => {
        const newReference = references.filter((ref) => ref.id !== item.id);
        setReferences(newReference);
    }, [references]);

    const handleReferenceClick = useCallback((item) => {
        console.log('点击了引用', item);
    }, []);
    
    return (
        <AIChatInput
            placeholder={'用于查看引用内容的用例'} 
            onReferenceDelete={handleReferenceDelete}
            onReferenceClick={handleReferenceClick}
            references={references} 
            uploadProps={uploadProps}
            style={outerStyle}
        />
    );
};

render(<Reference />);
```

### 配置区域

用户可以通过配置区域设置使用模型参数、联网搜索、深度思考等配置项，展示或者查看 MCP 工具。

可通过 `renderConfigureArea` API 自定义输入框的操作按钮。

使用 `Configure` 中的 `Select`、`Button`、`Mcp`、`RadioButton` 等组件可以自定义配置项。

`Configure` 将管理配置项的状态，用户可以通过 `onConfigureChange` API 监听配置项的变化。一定要配置 `field` 属性，用于标识配置项的唯一标识。如需设置初始值，可通过 `initValue` 属性设置。

如果用户有其他形式的配置需求，可以通过 `getConfigureItem` 将自定义组件扩展成 `Configure` 类型组件。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';
import { IconFixedStroked, IconBookOpenStroked, IconFeishuLogo, IconGit, IconFigma } from '@douyinfe/semi-icons';

const { Configure } = AIChatInput;
const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };

const modelOptions = [
    { value: 'GPT-5', label: 'GPT-5' },
    { value: 'GPT-4o', label: 'GPT-4o' },
    { value: 'Claude 3.5 Sonnet', label: 'Claude 3.5 Sonnet' },
];

const mcpOptions = [
    { icon: <IconFeishuLogo />, label: "飞书文档", value: "feishu" },
    { icon: <IconGit />, label: "Github Mcp", value: "github" },
    { icon: <IconFigma />, label: "IconFigma Mcp", value: "IconFigma" }
];

const radioButtonProps = [
    { label: '极速', value: 'fast' },
    { label: '思考', value: 'think' },
    { label: '超能', value: 'super' }
];


function ConfigureButton() {
    const onConfigureButtonClick = useCallback(() => {
        console.log('onConfigureButtonClick');
    }, []);

    const renderLeftMenu = useCallback(() => (<>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
        <Configure.Mcp options={mcpOptions} onConfigureButtonClick={onConfigureButtonClick}/>
        <Configure.RadioButton options={radioButtonProps} field="thinkType" initValue="fast"/>
    </>), []);

    const onConfigureChange = useCallback((value, changedValue) => {
        console.log('onConfigureChange', value, changedValue);
    }, []);
    
    return (
        <AIChatInput
            placeholder={'用于查看左下方配置项的用例'} 
            renderConfigureArea={renderLeftMenu} 
            onConfigureChange={onConfigureChange}
            uploadProps={uploadProps}
            style={outerStyle}
        />
    );
};

render(<ConfigureButton />);

```

使用 `getConfigureItem` 扩展自定义组件为 `Configure` 类型组件。

```ts
function getConfigureItem(
    component: React.ReactElement,
    opts: {
        // 指定需要接管的组件的 value 对应的 key，默认是 value
        valueKey?: string; 
        // 指定需要接管的组件的值变化对应的函数名，默认是 onChange
        onKeyChangeFnName?: string;
        // 指定需要接管的组件的值变化函数参数中 value 对应的路径，默认是 ''
        valuePath?: string;
        className?: string;
        defaultProps?: Record<string, any>
    }
)
```

使用示例如下：

```jsx live=true dir="column" noInline=true
import React, { useCallback } from 'react';
import { Cascader, AIChatInput, getConfigureItem } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const cascaderModalOptions = [
    {
        label: 'GPT',
        value: 'GPT',
        children: [
            { label: 'GPT-4o', value: 'GPT-4o' },
            { value: 'GPT-5', label: 'GPT-5' }
        ],
    },
    {
        label: 'Claude',
        value: 'Claude',
        children: [
            { label: 'Claude 3.5 Sonnet', value: 'Claude 3.5 Sonnet' }
        ],
    }
];

const myCascader = (props) => {
    return <Cascader {...props} />;
};

const CustomCascader = getConfigureItem(myCascader, { 
    className: 'aiChatInput-cascader-configure'
});

class CustomConfigure extends React.Component {

    constructor(props) {
        super(props);
        // Bind methods to the class instance
        this.renderLeftMenu = this.renderLeftMenu.bind(this);
        this.onConfigureChange = this.onConfigureChange.bind(this);
    }

    // Define methods without using arrow function syntax
    renderLeftMenu() {
        return <CustomCascader field="model" treeData={cascaderModalOptions} initValue={['GPT', 'GPT-4o']} />;
    }

    onConfigureChange(value, changedValue) {
        console.log('onConfigureChange', value, changedValue);
    }

    render() {
        return (<AIChatInput
            placeholder={'用于查看左下方配置项的用例'} 
            renderConfigureArea={this.renderLeftMenu} 
            onConfigureChange={this.onConfigureChange}
            uploadProps={uploadProps}
            style={outerStyle}
        />);
    };
}

render(<CustomConfigure />);
```

### 操作区域

输入框右下角为操作区域，用户可以通过 `renderActionArea` API 自定义操作区域，展示自定义的操作按钮。

```ts
interface ActionAreaProps {
    menuItem: ReactNode[];
    className: string
}
```

使用示例如下：

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput, Divider, Button } from '@douyinfe/semi-ui';
import { IconDeleteStroked } from '@douyinfe/semi-icons';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };

function ActionArea() {
    const renderActionArea = useCallback((props) => {
        return (
            <div className={props.className}>
                <div style={{ display: 'flex', alignItems: 'center' }} key="delete">
                    <Button type="tertiary" style={{ borderRadius: '50%' }} icon={<IconDeleteStroked />}/>
                    <Divider layout="vertical" style={{ marginLeft: 8 }}/>
                </div>
                {props.menuItem}
            </div>
        );
    }, []);
  
    return (
        <AIChatInput
            renderActionArea={renderActionArea}
            placeholder={'输入内容或者上传内容...'} 
            uploadProps={uploadProps}
            style={outerStyle} 
        />
    );
};

render(<ActionArea />);
```

### 底部按钮形状

用户可以通过 `round` API 配置底部按钮的形状，默认是 `true`，是圆角按钮， 可以设置为 `false` 来配置为方形按钮。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput, RadioGroup, Radio } from '@douyinfe/semi-ui';
import { IconFixedStroked, IconBookOpenStroked, IconFeishuLogo, IconGit, IconFigma } from '@douyinfe/semi-icons';

const { Configure } = AIChatInput;
const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const modelOptions = [
    { value: 'GPT-5', label: 'GPT-5' },
    { value: 'GPT-4o', label: 'GPT-4o' },
    { value: 'Claude 3.5 Sonnet', label: 'Claude 3.5 Sonnet' },
];

const mcpOptions = [
    { icon: <IconFeishuLogo />, label: "飞书文档", value: "feishu" },
    { icon: <IconGit />, label: "Github Mcp", value: "github" },
    { icon: <IconFigma />, label: "IconFigma Mcp", value: "IconFigma" }
];

const radioButtonProps = [
    { label: '极速', value: 'fast' },
    { label: '思考', value: 'think' },
    { label: '超能', value: 'super' }
];

function Shape() {
    const [round, setRound] = useState(false);
    const renderLeftMenu = useCallback(() => <>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
        <Configure.Mcp options={mcpOptions} />
        <Configure.RadioButton options={radioButtonProps} initValue="fast"/>
    </>);

    const onChange = useCallback((e) => {
        setRound(e.target.value);
    }, []);
    
    return (<>
        <RadioGroup onChange={onChange} value={round} aria-label="单选组合示例" name="demo-radio-group">
            <Radio value={true}>圆形</Radio>
            <Radio value={false}>方形</Radio>
        </RadioGroup>
        <AIChatInput
            placeholder={'下方按钮为方形的用例'} 
            round={round}
            renderConfigureArea={renderLeftMenu} 
            uploadProps={uploadProps}
            style={outerStyle}
        />
    </>);
};

render(<Shape />);
```

### 建议

用户可通过 `suggestion` API 配置建议列表，功能类似于 AutoComplete 组件，用户可以根据输入的内容实现根据输入的内容动态展示建议列表。

使用鼠标上下按键切换建议列表的选项。按下 `ESC` 或者点击非建议列表，输入框区域，建议列表将关闭。

还可通过 `renderSuggestionItem` API 自定义建议列表的展示。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const suggestionTemplate = [ '天气如何', '空气质量', '工作进程', '日程安排'];


function Suggestion() {
    const [suggestion, setSuggestion] = useState([]);
    const onChange = useCallback((content) => {
        let value;
        if (content.length && content[0].text) {
            value = content[0].text;
        }
        if (value === undefined || value.includes('\n')) {
            if (suggestion === undefined || suggestion.length === 0) {
                return;
            } else {
                return setSuggestion([]);
            }
        }
        if (value.length === 0) {
            setSuggestion([]);
        } else if (value.length > 0 && value.length < 4) {
            const su = new Array(suggestionTemplate.length).fill(0).map((item, index) => {
                return `${value}，${suggestionTemplate[index]}`;
            });
            setSuggestion(su);
        } else if (value.length >= 4) {
            setSuggestion([]);
        }
    }, [suggestion]);
  
    return (
        <AIChatInput
            suggestions={suggestion} 
            onContentChange={onChange}
            uploadProps={uploadProps}
            style={outerStyle}
            placeholder={'输入内容，当内容长度小于 4个字符可以看到建议，使用上下按键可切换侯选项'} 
        />
    );
}

render(<Suggestion />);
```

### 技能及模版

用户可以通过 `skills` API 配置技能列表，使用 `skillHotKey` 配置技能的触发键。

`skills` 的格式如下

```ts
interface Skill {
    label?: string;
    value?: string;
    icon?: React.ReactNode;
    // 技能是否有模版，有模版的技能被选中后，将在输入框的底部展示模版按钮
    hasTemplate?: boolean;
}
```

由于模版的展示形式丰富，因此我们不提供默认的展示形式，用户可以通过 `renderTemplate`API 自定义模版的展示。模版面板的展示和关闭可通过点击模版按钮实现。

```ts
renderTemplate?: (
    skill: Skill, 
    // 模版点击回调，点击模版后，将模版的内容插入到输入框中
    onTemplateClick: (content: string) => void
) => ReactNode;
```

使用示例如下：

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';
import { IconTemplateStroked, IconSearch } from '@douyinfe/semi-icons';

const { Configure } = AIChatInput;
const modelOptions = [
    { value: 'GPT-5', label: 'GPT-5' },
    { value: 'GPT-4o', label: 'GPT-4o' },
    { value: 'Claude 3.5 Sonnet', label: 'Claude 3.5 Sonnet' },
];
const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const skills = [
    {
        icon: <IconTemplateStroked />,
        value: 'writing',
        label: '帮我写作',
        hasTemplate: true,
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程',
        label: 'AI coding'
    },
];

const template = [
    {
        groupKey: 'value',
        group: '工作',
        children: [
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: '总结汇报',
                desc: '凝练你的工作成效',
                content: `我的职业是<input-slot placeholder="[请输入职业]"></input-slot>，帮我写一份关于<input-slot placeholder="[输入目的：项目进展总结、团队工作成果或其他]</input-slot>的总结汇报`
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: '话术',
                desc: '满足不同场景表达需求',
                content: `我是一名<select-slot value="打工人" options='["打工人","学生"]'></select-slot> ，帮我写一段面向<input-slot placeholder="[输入对象]">陌生同事</input-slot>的话术内容`
            }
        ]
    },
    {
        groupKey: 'marketing',
        group: '商业营销',
        children: [
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: '宣传文案',
                desc: '撰写各平台的推广文案',
                content: '帮我写一篇面向<input-slot placeholder="[输入目标人群]"></input-slot>职场人士，关于<input-slot placeholder="[输入产品]"></input-slot>的宣传文案，需要直击痛点，吸引用户点击。'
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: '方案策划',
                desc: '量身定制各种方案',
                content: '我是一名<input-slot placeholder="[输入职业]"></input-slot>职业策划人 ，帮我写一个<input-slot placeholder="[方案类型：如线下读书会活动方案等]"></input-slot>线下读书会活动 的方案，需要包含但不限于策划目标、详细计划、所需资源和预算、效果评估、风险应对等。'
            }
        ]
    }
];

const TemplateContent = (props) => {
    const { onTemplateClick: onTemplateClickProps } = props;
    const [groupIndex, setGroupIndex] = useState(0);

    const onItemClick = useCallback((e) => {
        const index = e.target.dataset.index;
        setGroupIndex(Number(index));
    }, []);

    const onTemplateClick = useCallback((item) => {
        const { content } = item;
        onTemplateClickProps(content);
    }, [onTemplateClickProps]);

    return (<div className={'aiChatInput-template'} >
        {/* tabs */}
        <div className={'template-header'} >
            {(template ? template : []).map((item, index) => {
                return (<div
                    key={index}
                    data-index={index}
                    className={`template-header-item ${groupIndex === index ? 'template-header-item-active' : ''}`}
                    onClick={onItemClick}
                >
                    {item.group}
                </div>);
            })}
        </div>
        {/* content */}
        <div className='template-content'>
            {(((template ? template : [])[groupIndex] ? (template ? template : [])[groupIndex] : {}).children ? (template ? template : [])[groupIndex].children : []).map((item, index) => (<div
                key={index}
                className='template-content-item'
                onClick={() => onTemplateClick(item)}
            >
                <div className='template-content-item-icon' style={{ background: item.bg }}>{item.icon}</div>
                <div className='template-content-item-title'>{item.title}</div>
                <div className='template-content-item-desc'>{item.desc}</div>
            </div>))}
        </div>
    </div>);
};

function Template() {
    const ref = useRef();

    const setTemplate = useCallback((content) => {
        const element = ref.current;
        if (!element) {
            return;
        }
        element.setContentWhileSaveTool(content);
        element.focusEditor();
    }, [ref]);

    const renderTemplate = useCallback((skill = {}, e) => {
        if (skill.value === 'writing') {
            return <TemplateContent onTemplateClick={setTemplate}/>;
        }
    }, [setTemplate]);

    const renderLeftMenu = useCallback(() => <>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
    </>);

    return (
        <AIChatInput 
            placeholder='输入 / 唤起技能，选择技能后，点击模版按钮可查看模版，可通过鼠标上下按键切换侯选项'
            renderConfigureArea={renderLeftMenu} 
            ref={ref}
            uploadProps={uploadProps}
            skills={skills}
            skillHotKey='/'
            renderTemplate={renderTemplate}
            style={outerStyle}
        />
    );
};

render(<Template />);
```

### 自定义渲染顶部区域

用户可以通过 `renderTopSlot` API 自定义渲染顶部区域，可自行渲染引用，上传内容以及配置项。可结合 `showReference` 和 `showUploadFile` API 控制是否展示引用和上传文件。另外，可通过 `topSlotPosition` API 配置自定义渲染内容相对于引用区域，上传展示区域的相对位置。

```ts
interface TopSlotProps {
    // 引用
    references: Reference[];
    // 上传内容
    attachments: Attachment[];
    // 输入框消息
    content: Content[];
    handleUploadFileDelete: (attachment: Attachment) => void;
    handleReferenceDelete: (reference: Reference) => void
}
```

使用用例如下：

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';
import { IconClose, IconUpload, IconFile, IconFolder, IconBranch, IconTerminal, IconGlobeStroke, IconConnectionPoint2, IconTemplateStroked, IconSearch, IconGit, IconCode } from '@douyinfe/semi-icons';

const { Configure } = AIChatInput;
const radioButtonProps = [
    { label: <IconTemplateStroked />, value: 'fast' },
    { label: <IconSearch />, value: 'think' }
];
const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };

const customReferences = [
    {
        type: 'file',
        key: '1',
        name: 'horizontalScroller.tsx',
        path: 'packages/semi-ui/AIChatInput/horizontalScroller.tsx',
    },
    {
        type: 'folder',
        key: '2',
        name: 'AIChatInput',
        path: 'packages/semi-ui/AIChatInput',
    },
    {
        type: 'web',
        key: '3',
        name: 'web'
    },
    {
        type: 'change',
        key: '4',
        name: 'recentChange'
    },
    {
        type: 'branch',
        key: '5',
        name: 'Branch',
        detail: 'Diff with Main Branch',
        branch: 'feat/aichatinput',
        targetBranch: 'feat/targetBranch',
    },
    {
        type: 'terminal',
        key: '6',
        name: 'From 1-2',
        from: 1,
        to: 2,
    }
];

function getAttachmentType(item = {}) {
    const { type, name = '', fileInstance = {} } = item;
    if (type) {
        return type;
    }
    const suffix = name.split('.').pop();
    if (suffix) {
        return suffix;
    } else if (fileInstance.type && fileInstance.type) {
        const temp = fileInstance.type.split('/').pop();
        if (temp) {
            return temp;
        }
    }
    return 'UNKNOWN';
}

function isImageType(item = {}) {
    const PIC_PREFIX = 'image/';
    const PIC_SUFFIX_ARRAY = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
    const { name = '', fileInstance = {} } = item;
    const suffix = name.split('.').pop();
    let result = false;
    const { type = '' } = fileInstance;
    if (type.startsWith(PIC_PREFIX)) {
        result = true;
    } else if (PIC_SUFFIX_ARRAY.includes(suffix)) {
        result = true;
    }
    return result;
}

const refTypeToIconMap = new Map([
    ['file', <IconFile key={'file'} size="small" />],
    ['folder', <IconFolder key={'folder'} size="small" />],
    ['branch', <IconBranch key={'branch'} size="small" />],
    ['terminal', <IconTerminal key={'terminal'} size="small" /> ],
    ['web', <IconGlobeStroke key={'globalStroke'} size="small" />],
    ['change', <IconConnectionPoint2 key={'connectionPoint2'} size="small" />],
    ['git', <IconGit key="git" size="small" />],
    ['code', <IconCode key="code" size="small" />],
]);

function RenderTopSlot() {
    const ref = useRef();
    const [reference, setReference] = useState(customReferences);

    const renderLeftMenu = useCallback(() => <>
        <Configure.RadioButton options={radioButtonProps} initValue="fast" field="mode"/>
    </>);

    const renderTopSlot = useCallback((props) => {
        const { attachments = [], references = [] } = props;
        return <div className="ai-chat-input-topSlot">
            {references.map((item, index) => {
                const { type, name, detail, key, ...rest } = item;
                return (<div className="item" key={key}>
                    <span className='item-icon'>
                        {React.cloneElement(refTypeToIconMap.get(type), { className: 'item-left item-icon' })}
                        <IconClose size="small" className='item-icon-delete' onClick={() => {
                            const newReferences = [...references];
                            newReferences.splice(index, 1);
                            setReference(newReferences);
                        }}/>
                    </span>
                    <span className='item-content'>
                        {name}
                        {type === 'branch' && <span className='detail'>{detail}</span>}
                    </span>
                </div>);
            })}
            {attachments.map((item, index) => {
                const isImage = isImageType(item);
                const { uid, name, url, size, percent, status } = item;
                return (<div className="item" key={uid}>
                    <span className='item-icon'>
                        {isImage ? <img className='item-image item-left' src={item.url} alt={item.name} /> : <IconUpload size="small" className='item-left item-icon' />}
                        <IconClose size="small" className='item-icon-delete' onClick={() => {
                            ref.current && ref.current.deleteUploadFile(item);
                        }}/>
                    </span>
                    <span className='item-content'>{name}</span>
                </div>
                );
            })}
        </div>;
    }, []);
    
    return (
        <AIChatInput
            className='aiChatInput-customTopSlot'
            renderTopSlot={renderTopSlot}
            references={reference}
            showUploadFile={false}
            showReference={false}
            renderConfigureArea={renderLeftMenu} 
            ref={ref}
            uploadProps={uploadProps}
            style={outerStyle}
            placeholder="自定义渲染顶部内容，可用于渲染上传内容、引用内容"
        />
    );
}

render(<RenderTopSlot />);
```

### 自定义扩展

富文本区域可以自定义扩展，自定义扩展的实现可参考 [Tiptap 自定义扩展](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new)。通过 `extensions` API 可将自定义扩展添加到 `AIChatInput` 组件中。如果添加了自定义扩展，需要在 `transformer` 中添加对应的转换规则， 以保证在 `onContentChange` 中得到的该节点数据符合用户预期。

添加自定义扩展时有以下注意事项：
- 请在自定义扩展中添加 `isCustomSlot` 的属性，该属性和自定义扩展前后的光标高度有关
- 由于 `AIChatInput` 使用 `Enter` 作为发送热键，如果自定义扩展有使用 `Enter` 作为快捷操作，需要自行设置 `editor.storage` 中的 `AIChatInput.allowHotKeySend` 用于表示热键是否应该被 AIChatInput 用于发送，避免热键冲突

自定义扩展定义及注意事项的示例如下：

```jsx live=true dir="column" noInline=true
import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, posToDOMRect, ReactRenderer } from '@tiptap/react';
import { computePosition, flip, shift } from '@floating-ui/dom';
import { IconFile, IconFolder, IconBranch, IconCode, IconGit, IconGlobeStroke, IconChevronRight, IconClose, IconUpload, IconTerminal, IconConnectionPoint2 } from '@douyinfe/semi-icons';
import { AIChatInput } from '@douyinfe/semi-ui';
import Mention from '@tiptap/extension-mention';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };

// 面板选项
const TestAction = {
    'Files & Folders': [
        {
            icon: <IconFile />,
            key: '1-1',
            type: 'file',
            name: 'TagInput.scss',
            path: 'package/semi-founctaion/TagInput.scss',
        },
        {
            icon: <IconFolder />,
            key: '1-2',
            type: 'folder',
            name: 'package',
            path: '/package',
        },
        {
            icon: <IconFolder />,
            key: '1-3',
            type: 'folder',
            name: 'semi-ui',
            path: '/package/semi-ui',
        },
    ],
    Git: [
        {
            icon: <IconBranch />,
            key: '2-1',
            type: 'branch',
            name: 'fix/tag',
        },
        {
            icon: <IconCode />,
            key: '2-2',
            type: 'code',
            name: 'v2.86.0',
            path: '/package',
        },
        {
            icon: <IconGit />,
            key: '2-3',
            type: 'git',
            name: 'chore: publish',
        },
    ],
};

// 第一级内容
const FirstLevel = Object.keys(TestAction);

// referSlot 的渲染组件
function ReferSlotComponent(props) {
    const { node, deleteNode } = props;
    const value = node.attrs.value ? node.attrs.value : '';
    const onRemove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNode && deleteNode();
    };
    return (
        <NodeViewWrapper className="ai-chat-input-refer-slot-wrapper">
            <span className='ai-chat-input-refer-slot'>
                {value}
            </span>
        </NodeViewWrapper>
    );
}

// 创建 ReferSlot 扩展
const ReferSlot = Node.create({
    name: 'referSlot',
    inline: true,
    group: 'inline',
    atom: true,
    selectable: false,
    addAttributes() {
        return {
            value: {
                default: '输入内容',
                parseHTML: (element) =>
                    element.getAttribute('data-value'),
                renderHTML: (attributes) => ({
                    'data-value': attributes.value,
                }),
            },
            info: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-info'),
                renderHTML: (attributes) => ({
                    'data-info': attributes.info,
                }),
            },
            type: {
                default: 'text',
                parseHTML: (element) =>
                    element.getAttribute('data-type'),
                renderHTML: (attributes) => ({
                    'data-type': attributes.type,
                }),
            },
            uniqueKey: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-unique-key'),
                renderHTML: (attributes) => ({
                    'data-unique-key': attributes.uniqueKey,
                }),
            },
            // !!! Very important, affects the cursor size before and after custom nodes
            // Please be sure to add this logic to custom nodes
            isCustomSlot: AIChatInput.getCustomSlotAttribute(),
        };
    },
    parseHTML() {
        return [{
            tag: 'refer-slot',
        }];
    },
    renderHTML({ HTMLAttributes }) {
        // 序列化时输出自定义标签，保留值到 data-value
        return ['refer-slot', mergeAttributes(HTMLAttributes)];
    },
    addNodeView() {
        return ReactNodeViewRenderer(ReferSlotComponent);
    },
});

// 更新位置用函数
const updatePosition = (editor, element) => {
    const virtualElement = {
        getBoundingClientRect: () => posToDOMRect(
            editor.view,
            editor.state.selection.from,
            editor.state.selection.to,
        ),
    };
    computePosition(virtualElement, element, {
        placement: 'bottom-start',
        strategy: 'absolute',
        middleware: [shift()],
    }).then(({ x, y, strategy }) => {
        element.style.width = 'max-content';
        element.style.position = strategy;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    });
};

// 建议
const suggestion = {
    items: () => FirstLevel,
    command: ({ editor, range, props }) => {
        const { item, allowHotKeySend } = props;
        if (typeof allowHotKeySend === 'boolean') {
            editor.storage.SemiAIChatInput.allowHotKeySend = allowHotKeySend;
        }
        item && editor.chain().focus().insertContentAt(range, {
            type: 'referSlot',
            attrs: {
                type: item.type,
                value: item.name || '',
                info: JSON.stringify({ path: item.path }),
                uniqueKey: item.key,
            },
        }).run();
    },
    render: () => {
        let component;
        return {
            onStart: (props) => {
                component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                });
                if (!props.clientRect) return;
                component.element.style.position = 'absolute';
                document.body.appendChild(component.element);
                updatePosition(props.editor, component.element);
            },
            onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                updatePosition(props.editor, component.element);
            },
            onKeyDown(props) {
                function onExit() {
                    component.destroy();
                }
                return component.ref.onKeyDown({ ...props, exitCb: onExit });
            },
            onExit() {
                component.element.remove();
                component.destroy();
            },
            focusEditor(props) {
                props.editor.commands.focus();
            },
        };
    },
};

const customReferences = [
    {
        type: 'file',
        key: '1',
        name: 'horizontalScroller.tsx',
        path: 'packages/semi-ui/AIChatInput/horizontalScroller.tsx',
    },
    {
        type: 'folder',
        key: '2',
        name: 'AIChatInput',
        path: 'packages/semi-ui/AIChatInput',
    },
    {
        type: 'web',
        key: '3',
        name: 'web'
    },
    {
        type: 'change',
        key: '4',
        name: 'recentChange'
    },
    {
        type: 'branch',
        key: '5',
        name: 'Branch',
        detail: 'Diff with Main Branch',
        branch: 'feat/aichatinput',
        targetBranch: 'feat/targetBranch',
    },
    {
        type: 'terminal',
        key: '6',
        name: 'From 1-2',
        from: 1,
        to: 2,
    }
];

class MentionList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectedIndex: 0,
            level: 1,
            options: FirstLevel,
            filterOptions: FirstLevel,
        };
        this.upHandler = this.upHandler.bind(this);
        this.downHandler = this.downHandler.bind(this);
        this.enterHandler = this.enterHandler.bind(this);
        this.selectItem = this.selectItem.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.renderItem = this.renderItem.bind(this);
        // 选项面板渲染，则 Enter 快捷键应该用于选项面板中，不能用于 AIChatInput 的发送，
        props.command({ allowHotKeySend: false });
    }
    componentWillUnmount() {
        // 选项面板卸载，则 Enter 快捷键应该用于 AIChatInput 的发送
        this.props.command({ allowHotKeySend: true });
    }
    upHandler() {
        const { selectedIndex, filterOptions } = this.state;
        this.setState({
            selectedIndex: (selectedIndex + filterOptions.length - 1) % filterOptions.length,
        });
    };
    downHandler() {
        const { selectedIndex, filterOptions } = this.state;
        this.setState({
            selectedIndex: (selectedIndex + 1) % filterOptions.length,
        });
    };
    enterHandler () {
        const { selectedIndex, level } = this.state;
        if (level === 1) {
            this.setState({
                level: 2,
                options: TestAction[FirstLevel[selectedIndex]],
                selectedIndex: 0,
            });
        } else {
            this.selectItem(selectedIndex);
        }
    };
    selectItem(id) {
        const { options } = this.state;
        const item = options[id];
        if (item) {
            this.props.command({ item });
        }
    };
    componentDidUpdate(prevProps, prevState) {
        if (prevProps.items !== this.props.items) {
            this.setState({ selectedIndex: 0 });
        }
        if ( prevState.options !== this.state.options ||
        prevProps.query !== this.props.query
        ) {
            // 手动 filter
            let filter = [];
            if (this.props.query && this.props.query.length) {
                filter = (this.state.options ? this.state.options : []).filter((item) => {
                    let name;
                    if (typeof item === 'string') {
                        name = item;
                    } else {
                        name = item.name;
                    }
                    return name.toLowerCase().includes(this.props.query.toLowerCase());
                });
            } else {
                filter = this.state.options ? this.state.options : [];
            }
            this.setState({ 
                filterOptions: filter, 
                selectedIndex: 0
            });
        }
    }
    componentDidMount() {
        if (this.props.innerRef) {
            this.props.innerRef.current = {
                onKeyDown: this.onKeyDown,
            };
        }
    }
    onKeyDown({ event, exitCb }) {
        if (event.key === 'ArrowUp') {
            this.upHandler();
            return true;
        }
        if (event.key === 'ArrowDown') {
            this.downHandler();
            return true;
        }
        if (event.key === 'Enter') {
            this.enterHandler();
            return true;
        }
        if (event.key === 'Escape') {
            if (this.state.level === 1) {
                exitCb && exitCb();
                return true;
            } else if (this.state.level === 2) {
                this.setState({ level: 1, options: FirstLevel });
                return true;
            }
        }
        return false;
    };

    // 明确参数类型
    renderItem(item) {
        return (
            <div className="level2Item">
                {item.icon}
                <span className="name">{item.name}</span>
                <span className="path">{item.path}</span>
            </div>
        );
    };
    render() {
        const { level, filterOptions, selectedIndex } = this.state;
        return (
            <div className="ai-chat-input-custom-extension-dropdown-menu" style={{ width: level === 1 ? 200 : 300 }}>
                {filterOptions.length ? (filterOptions.map(
                    (item, index ) => (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                        <div
                            key={index}
                            className={ index === selectedIndex ? 'is-selected optionItem' : 'optionItem '}
                            onClick={() => {
                                if (level === 1) {
                                    if (typeof item === 'string') {
                                        this.setState({ level: 2, options: TestAction[item] });
                                        this.props.editor.commands.focus();
                                    }
                                } else {
                                    if (typeof item !== 'string') {
                                        this.selectItem(index);
                                    }
                                }
                            }}
                            onMouseEnter={() => {
                                this.setState({ selectedIndex: index });
                            }}
                        >
                            {typeof item === 'string' ? <span>{item}</span> : this.renderItem(item)}
                            {level === 1 && <IconChevronRight className='option-item-arrow'/>}
                        </div>
                    ),
                )) : <div className="item">No result</div>}
            </div>
        );
    }
}

function getAttachmentType(item = {}) {
    const { type, name = '', fileInstance = {} } = item;
    if (type) {
        return type;
    }
    const suffix = name.split('.').pop();
    if (suffix) {
        return suffix;
    } else if (fileInstance.type && fileInstance.type) {
        const temp = fileInstance.type.split('/').pop();
        if (temp) {
            return temp;
        }
    }
    return 'UNKNOWN';
}

function isImageType(item = {}) {
    const PIC_PREFIX = 'image/';
    const PIC_SUFFIX_ARRAY = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
    const { name = '', fileInstance = {} } = item;
    const suffix = name.split('.').pop();
    let result = false;
    const { type = '' } = fileInstance;
    if (type.startsWith(PIC_PREFIX)) {
        result = true;
    } else if (PIC_SUFFIX_ARRAY.includes(suffix)) {
        result = true;
    }
    return result;
}

const refTypeToIconMap = new Map([
    ['file', <IconFile key={'file'} size="small" />],
    ['folder', <IconFolder key={'folder'} size="small" />],
    ['branch', <IconBranch key={'branch'} size="small" />],
    ['terminal', <IconTerminal key={'terminal'} size="small" /> ],
    ['web', <IconGlobeStroke key={'globalStroke'} size="small" />],
    ['change', <IconConnectionPoint2 key={'connectionPoint2'} size="small" />],
    ['git', <IconGit key="git" size="small" />],
    ['code', <IconCode key="code" size="small" />],
]);

function CustomRichTextExtension() {
    const ref = useRef();
    const [reference, setReference] = useState(customReferences);
    const extensions = useMemo(() => {
        // 使用 @ 触发
        return [
            ReferSlot,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion,
            }),
        ];
    }, []);
    const renderTopSlot = useCallback((props) => {
        const { attachments = [], references = [], content = [] } = props;
        const showContent = content.filter((item) => item.type !== 'text');
        return <div className="ai-chat-input-topSlot">
            {/* order: reference, rich text area content, attachments */}
            {showContent.map((item, index) => {
                const { type, value, name, key, detail, ...rest } = item;
                return (
                    <div className="item" key={key ? key : index}>
                        <span className='item-icon'>
                            {React.cloneElement(refTypeToIconMap.get(type), { className: 'item-left item-icon' })}
                            <IconClose size="small" className='item-icon-delete' onClick={() => {
                                if (ref.current && ref.current.deleteContent) {
                                    ref.current.deleteContent(item);
                                }
                            }}/>
                        </span>
                        <span className='item-content'>
                            {name ? name : value}
                            {type === 'branch' && <span className='detail'>{detail}</span>}
                        </span>
                    </div>
                );
            })}
            {references.map((item, index) => {
                const { type, name, detail, key, ...rest } = item;
                return (
                    <div className="item" key={key}>
                        <span className='item-icon'>
                            {React.cloneElement(refTypeToIconMap.get(type), { className: 'item-left item-icon' })}
                            <IconClose size="small" className='item-icon-delete' onClick={() => {
                                const newReferences = [...references];
                                newReferences.splice(index, 1);
                                setReference(newReferences);
                            }}/>
                        </span>
                        <span className='item-content'>
                            {name}
                            {type === 'branch' && <span className='detail'>{detail}</span>}
                        </span>
                    </div>
                );
            })}
            {attachments.map((item, index) => {
                const isImage = isImageType(item);
                const realType = getAttachmentType(item);
                const { uid, name, url, size, percent, status } = item;
                return (
                    <div className="item" key={uid}>
                        <span className='item-icon'>
                            {isImage ? <img className='item-image item-left' src={item.url} alt={item.name} /> : <IconUpload size="small" className='item-left item-icon' />}
                            <IconClose size="small" className='item-icon-delete' onClick={() => {
                                if (ref.current && ref.current.deleteUploadFile) {
                                    ref.current.deleteUploadFile(item);
                                }
                            }}/>
                        </span>
                        <span className='item-content'>{name}</span>
                    </div>
                );
            })}
        </div>;
    }, []);
    const onContentChange = useCallback((content) => {
        console.log('onContentChange', content);
    }, []);
    const transformer = useMemo(() => {
        return new Map([
            ['referSlot', (obj) => {
                const { attrs = {} } = obj;
                const { value, info, type = 'text', uniqueKey } = attrs;
                return {
                    type: type, 
                    value: value,
                    uniqueKey: uniqueKey,
                    ...JSON.parse(info),
                };
            }],
        ]);
    }, []);
    return (
        <>
            <AIChatInput
                className='aiChatInput-customTopSlot'
                renderTopSlot={renderTopSlot}
                extensions={extensions}
                references={reference}
                showUploadFile={false}
                showReference={false}
                onContentChange={onContentChange}
                ref={ref}
                transformer={transformer}
                uploadProps={uploadProps}
                style={outerStyle}
                placeholder="使用 @ 触发"
            />
        </>
    );
};

render(<CustomRichTextExtension />);
```

## API 参考

### AIChatInput

| 属性 | 说明 | 类型 | 默认值 |
|------|----|------|-------|
| canSend | 是否可以发送，未设置时，根据输入框内容，上传内容，引用内容决定是否可发送 | boolean | true |
| className | 自定义类名 | string | - |
| defaultContent | 输入框默认内容，支持 html string 以及 json 格式，同 Tiptap 的 Content | TiptapContent | - |
| dropdownMatchTriggerWidth | 下拉弹出层是否是否与输入框宽度一致 | boolean | true |
| extensions | 自定义扩展，类型同 tiptap 的 Extension 类型相同 | Extension[] | - |
| generating | 是否正在生成中 | boolean | false |
| onContentChange | 输入框内容变化时候的回调 | (content: <ApiType detail='{ type: string; [key: string]: any }'>OnContentChangeProps</ApiType>) => void | - |
| onMessageSend | 发送消息回调 | (content: <ApiType detail='{references?: Reference[]; attachments?: Attachment[]; inputContents?: Content[]; setup?: Setup}'>OnMessageSendProps</ApiType>) => void | - |
| onReferenceClick | 引用点击回调 | (reference: Reference) => void | - |
| onReferenceDelete | 引用删除回调 | (reference: Reference) => void | - |
| onSkillChange | 技能切换回调 | (skill: Skill) => void | - |
| onStopGenerate | 停止生成回调 | () => void | - |
| onSuggestClick | 建议点击回调 | (suggestion: Suggestion) => void | - |
| onTemplateVisibleChange | 模板弹出层可见性变化回调 | (visible: boolean) => void | - |
| onUploadChange | 上传文件相关回调 | (props: OnChangeProps) => void | - |
| popoverProps | 下拉弹出层的配置参数 | PopoverProps | - |
| placeholder | 输入框占位符 | string | - |
| references | 输入框引用列表 | Reference[] | - |
| renderActionArea | 自定义底部的操作区域 | () => React.ReactNode | - |
| renderConfigureArea | 自定义底部的配置区域 | () => React.ReactNode | - |
| renderReference | 自定义渲染引用 | (reference: Reference) => ReactNode | - |
| renderSkillItem | 自定义技能列表的 item 渲染 | (props: <ApiType detail='{skill: Skill; onClick: () => void; className: string, onMouseEnter: () => void}'>RenderSkillItemProps</ApiType>) => React.ReactNode | - |
| renderSuggestionItem | 自定义建议列表的 item 渲染 | (props: <ApiType detail='{ suggestion: Suggestion; onClick: () => void; className: string, onMouseEnter: () => void}'>RenderSkillItemProps</ApiType>) => React.ReactNode | - |
| renderTemplate | 自定义模板渲染 | (skill: Skill, onTemplateClick: (content: string) => void) => React.ReactNode | - |
| renderTopSlot | 自定义顶部 slot | () => React.ReactNode | - |
| round | 底部的配置区域和操作区域是否形状是否为全圆角 | boolean | true |
| onBlur | 富文本输入框失焦的回调 | (event: React.FocusEvent) => void | - |
| onConfigureChange | 配置区域发生变化的回调 | (value: LeftMenuChangeProps, changedValue: LeftMenuChangeProps) => void | - |
| onFocus | 富文本输入框聚焦的回调 | (event: React.FocusEvent) => void | - |
| showReference | 是否展示引用区域，用于配合 renderTopSlot 使用 | boolean | true |
| showTemplateButton | 是否展示模板按钮，未设置时，将根据当前选中技能中的 hasTemplate 决定是否展示模版按钮 | boolean | false |
| showUploadFile | 是否展示上传文件区域，用于配合 renderTopSlot 使用 | boolean | true |
| skillHotKey | 输入框中触发技能的热键 | string | - |
| skills | 技能列表 | Skill[] | - |
| style | 自定义样式 | React.CSSProperties | - |
| suggestions | 建议列表 | Suggestion[] | - |
| templatesCls| 模版的样式类名称| string | - |
| templatesStyle| 模版的样式| React.CSSProperties | - |
| topSlotPosition | 顶部 slot 位置，相对于引用内容，上传内容 | 'top' \| 'bottom' \| 'middle' | - |
| transformer | 自定义扩展的转换规则 | Map<string, (obj: any) => any> | |
| uploadProps | 上传文件相关配置 | UploadProps | - |
| uploadTipProps | 上传文件相关提示配置 | UploadTipProps | - |

## Methods

| 属性 | 说明 | 类型 | 默认值 |
|------|----|------|-------|
| changeTemplateVisible | 切换模板弹出层的可见性 | (visible: boolean) => void | - |
| deleteContent | 删除富文本中的某一项，删除逻辑依赖的是 content 中的 uniqueKey | (content: Content) => void | - |
| deleteUploadFile | 删除上传文件中的某一项 | (item: Attachment) => void | - |
| focusEditor | 聚焦输入框，默认聚焦到输入框的末尾 | (pos?: string) => void | - |
| getEditor | 获取当前的 tiptap 的 editor 实例 | () => Editor | - |
| setContent | 设置输入框内容 | (content: TiptapContent) => void | - |
| setContentWhileSaveTool | 保留技能项的同时设置输入框内容 | (content: TiptapContent) => void | - |



## 设计变量
<DesignToken/>


