---
localeCode: en-US
order: 100
category: Ai
title: AIChatInput
icon: doc-aiInput
width: 60%
brief: Input box used in AI chat scenarios
showNew: true
---

## Usage Scenarios

In AI chat scenarios, users can use `AIChatInput` to achieve rich text input, uploading, quoting, suggestions, templates, feature configuration, and rich custom display.

`AIChatInput`'s rich text input is based on `tiptap` (https://tiptap.dev/docs/editor/getting-started/overview), a modern rich text editor development framework that supports mainstream front-end frameworks such as React and Vue, and boasts strong customizability and extensibility. Its componentization capabilities are excellent, performance is high, it has many built-in commonly used extensions, and it supports user-defined nodes, commands, plugins, and menus, enabling flexible adaptation and expansion of rich text input capabilities in complex AI scenarios. Semi's `AIChatInput` component encapsulates tiptap, allowing developers to use it out of the box or extend it as needed according to business requirements.

## Demos

### How to import

```jsx import
import { AIChatInput } from '@douyinfe/semi-ui';
```

### Basic Usage

Supports text input and file upload. You can configure the following parameters as needed:

- `uploadProps`: Configure parameters related to file upload. See [UploadProps](/en-US/plus/upload#API)
- `onUploadChange`: Callback when file upload changes
- `placeholder`: Placeholder for the input box
- `defaultContent`: Default content for the input box
- `onContentChange`: Callback when the content of the input box changes; the parameter is the current content

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
            placeholder={'Enter content or upload...'} 
            uploadProps={uploadProps}
            onContentChange={onContentChange}
            onUploadChange={onUploadChange}
            style={outerStyle} 
        />
    );
};

render(<Basic />);
```

### Message Sending

When there is content in the input box (including text entry, uploaded content, [reference content](/en-US/plus/aiChatInput#Reference)), sending messages is allowed. Clicking the send message button triggers the `onMessageSend` callback; the argument is the input content, including text, reference content, uploaded files, and configuration area content.

You can manage generating status with `generating`. If `generating` is `true`, AIChatInput will show a stop-generating button instead of the send button and clear the input area as well as uploaded files. References require manual handling.

Clicking the stop button triggers `onStopGenerate`, where you can handle logic such as setting `generating` to `false`.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { 
    action: "https://api.semi.design/upload",
    defaultFileList: [
        {
            uid: '1',
            name: 'dy.jpeg',
            status: 'success',
            size: '130kb',
            url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png',
        },
        {
            uid: '5',
            name: 'resso.jpeg',
            percent: 50,
            size: '222kb',
            url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png',
        }
    ],
};
const outerStyle = { margin: 12 };

const reference = [
    {
        id: '1',
        type: 'text',
        content: 'Test text: This is a long text repeated many times for demonstration purposes...'
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
            defaultContent={"Click Send to see changes in content, uploads, and references."}
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

### Rich Text Input

AIChatInput uses [tiptap](https://tiptap.dev/docs/editor/getting-started/overview) for its rich text editor. You can enter text, use built-in extensions (including `input-slot`, `select-slot`, `skill-slot`), or extend with your own.

- `input-slot`: Supports text input and placeholder display.
- `select-slot`: Supports in-box option selection with string options.
- `skill-slot`: For skill display blocks.

You can set input content with the `setContent` ref method and focus the editor with `focusEditor`.

```jsx live=true dir="column" noInline=true
import React, { useRef, useCallback } from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const temp = {
    'input-slot': 'I am an <input-slot placeholder="[Occupation]">engineer</input-slot>',
    'select-slot': 'I am a <select-slot value="Front-end Developer" options=\'["Designer","Front-end Developer","Back-end Developer"]\'></select-slot>, please help me complete...',
    'skill-slot': '<skill-slot data-value="AI Coding"></skill-slot> Please help me complete...'
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
            {Object.keys(temp).map((item, index) => (
                <div 
                    className={`aiChatInput-radio-item ${index === activeIndex ? 'aiChatInput-radio-item-selected' : ''}`}
                    key={index} 
                    data-index={index} 
                    onClick={setTemplate}
                >{item}</div>
            ))}
        </div>
        <AIChatInput
            ref={ref}
            defaultContent={temp['input-slot']}
            placeholder={'Enter content or upload'} 
            uploadProps={uploadProps}
            style={outerStyle} 
        />
    </>);
};

render(<RichTextExample />);
```

### Reference

You can pass in references via the `references`, which will display at the top of the input box.

- `renderReference`: Custom renderer for an individual reference.
- `onReferenceDelete`: Callback for deleting a reference.
- `onReferenceClick`: Callback for clicking a reference.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const referenceTemp = [
    { id: '1', type: 'text', content: 'Sample text, repeated to demonstrate a long text.' },
    { id: '2', name: 'FeishuDoc.docx' },
    { id: '3', name: 'FeishuDoc.pdf' },
    { id: '4', name: 'Music.mp4' },
    { id: '5', name: 'Image.jpeg', url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png' },
    { id: '6', name: 'code.json' }
];

function Reference() {
    const [references, setReferences] = useState(referenceTemp);
    const handleReferenceDelete = useCallback((item) => {
        const newReference = references.filter((ref) => ref.id !== item.id);
        setReferences(newReference);
    }, [references]);

    const handleReferenceClick = useCallback((item) => {
        console.log('Clicked reference', item);
    }, []);
    
    return (
        <AIChatInput
            placeholder={'Demo for viewing reference content'} 
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

### Configuration Area

You can configure options such as model parameters, web search, and critical thinking through the configuration area, or display/view MCP tools.

- `renderConfigureArea`: Custom renderer for config area buttons.
- Use `Configure` components such as `Select`, `Button`, `Mcp`, `RadioButton`, etc.

The `Configure` component manages the state and provides a callback via `onConfigureChange` (make sure to set the unique `field`). For initial values, use `initValue`.

You can also use `getConfigureItem` to adapt your custom components.

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
    { icon: <IconFeishuLogo />, label: "FeishuDoc", value: "feishu" },
    { icon: <IconGit />, label: "Github Mcp", value: "github" },
    { icon: <IconFigma />, label: "IconFigma Mcp", value: "IconFigma" }
];

const radioButtonProps = [
    { label: 'Fast', value: 'fast' },
    { label: 'Think', value: 'think' },
    { label: 'Super', value: 'super' }
];

function ConfigureButton() {
    const onConfigureButtonClick = useCallback(() => {
        console.log('onConfigureButtonClick');
    }, []);

    const renderLeftMenu = useCallback(() => (<>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">Web search</Configure.Button>
        <Configure.Mcp options={mcpOptions} onConfigureButtonClick={onConfigureButtonClick}/>
        <Configure.RadioButton options={radioButtonProps} field="thinkType" initValue="fast"/>
    </>), []);

    const onConfigureChange = useCallback((value, changedValue) => {
        console.log('onConfigureChange', value, changedValue);
    }, []);
    
    return (
        <AIChatInput
            placeholder={'Demo for configuration area on the lower left'} 
            renderConfigureArea={renderLeftMenu} 
            onConfigureChange={onConfigureChange}
            uploadProps={uploadProps}
            style={outerStyle}
        />
    );
};

render(<ConfigureButton />);
```

You can extend any custom component for configuration using `getConfigureItem`.

```ts
function getConfigureItem(
    component: React.ReactElement,
    opts: {
        valueKey?: string; 
        onKeyChangeFnName?: string;
        valuePath?: string;
        className?: string;
        defaultProps?: Record<string, any>
    }
)
```

Demo:

```jsx live=true dir="column" noInline=true
import React, { useCallback } from 'react';
import { Cascader, AIChatInput, getConfigureItem } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const cascaderModalOptions = [
    { label: 'GPT', value: 'GPT', children: [{ label: 'GPT-4o', value: 'GPT-4o' }, { value: 'GPT-5', label: 'GPT-5' }] },
    { label: 'Claude', value: 'Claude', children: [{ label: 'Claude 3.5 Sonnet', value: 'Claude 3.5 Sonnet' }] }
];

const myCascader = (props) => <Cascader {...props} />;
const CustomCascader = getConfigureItem(myCascader, { 
    className: 'aiChatInput-cascader-configure'
});

class CustomConfigure extends React.Component {
    constructor(props) {
        super(props);
        this.renderLeftMenu = this.renderLeftMenu.bind(this);
        this.onConfigureChange = this.onConfigureChange.bind(this);
    }
    renderLeftMenu() {
        return <CustomCascader field="model" treeData={cascaderModalOptions} initValue={['GPT', 'GPT-4o']} />;
    }
    onConfigureChange(value, changedValue) {
        console.log('onConfigureChange', value, changedValue);
    }
    render() {
        return (<AIChatInput
            placeholder={'Demo for configuration on the lower left'} 
            renderConfigureArea={this.renderLeftMenu} 
            onConfigureChange={this.onConfigureChange}
            uploadProps={uploadProps}
            style={outerStyle}
        />);
    };
}

render(<CustomConfigure />);
```

### Action Area

The lower right corner is the action area. Use `renderActionArea` to customize buttons (e.g. for deleting or other operations).

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput, Divider, Button } from '@douyinfe/semi-ui';
import { IconDeleteStroked } from '@douyinfe/semi-icons';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };

function ActionArea() {
    const renderActionArea = useCallback((props) => (
        <div className={props.className}>
            <div style={{ display: 'flex', alignItems: 'center' }} key="delete">
                <Button type="tertiary" style={{ borderRadius: '50%' }} icon={<IconDeleteStroked />}/>
                <Divider layout="vertical" style={{ marginLeft: 8 }}/>
            </div>
            {props.menuItem}
        </div>
    ), []);
  
    return (
        <AIChatInput
            renderActionArea={renderActionArea}
            placeholder={'Enter content or upload...'} 
            uploadProps={uploadProps}
            style={outerStyle} 
        />
    );
};

render(<ActionArea />);
```

### Button Shape

You can use the `round` API to configure the button shape at the bottom. The default is `true` (rounded). Set it to `false` for square buttons.

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
    { icon: <IconFeishuLogo />, label: "FeishuDoc", value: "feishu" },
    { icon: <IconGit />, label: "Github Mcp", value: "github" },
    { icon: <IconFigma />, label: "IconFigma Mcp", value: "IconFigma" }
];

const radioButtonProps = [
    { label: 'Fast', value: 'fast' },
    { label: 'Think', value: 'think' },
    { label: 'Super', value: 'super' }
];

function Shape() {
    const [round, setRound] = useState(false);
    const renderLeftMenu = useCallback(() => <>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">Web search</Configure.Button>
        <Configure.Mcp options={mcpOptions} />
        <Configure.RadioButton options={radioButtonProps} initValue="fast"/>
    </>);
    const onChange = useCallback((e) => {
        setRound(e.target.value);
    }, []);
    
    return (<>
        <RadioGroup onChange={onChange} value={round} aria-label="Radio group demo" name="demo-radio-group">
            <Radio value={true}>Rounded</Radio>
            <Radio value={false}>Square</Radio>
        </RadioGroup>
        <AIChatInput
            placeholder={'Square button demo'} 
            round={round}
            renderConfigureArea={renderLeftMenu} 
            uploadProps={uploadProps}
            style={outerStyle}
        />
    </>);
};

render(<Shape />);
```

### Suggestions

Configure suggestions with the `suggestion` API. This works similarly to the AutoComplete component. Users can dynamically show suggestions based on input.

Use up/down keys to navigate suggestions. Pressing `ESC` or clicking outside the suggestion/input area will close the suggestions. You can customize rendering using `renderSuggestionItem`.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { AIChatInput } from '@douyinfe/semi-ui';

const uploadProps = { action: "https://api.semi.design/upload" };
const outerStyle = { margin: 12 };
const suggestionTemplate = [ 'Weather', 'Air Quality', 'Work Progress', 'Schedule' ];

function Suggestion() {
    const [suggestion, setSuggestion] = useState([]);
    const onChange = useCallback((content) => {
        let value;
        if (content.length && content[0].text) {
            value = content[0].text;
        }
        if (value === undefined) {
            if (suggestion === undefined || suggestion.length === 0) {
                return;
            } else {
                return setSuggestion([]);
            }
        }
        if (value.length === 0) {
            setSuggestion([]);
        } else if (value.length > 0 && value.length < 4) {
            const su = new Array(suggestionTemplate.length).fill(0).map((item, index) =>
                `${value}, ${suggestionTemplate[index]}`
            );
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
            placeholder={'When the length is less than 4, see suggestions. Use up/down to select.'} 
        />
    );
}

render(<Suggestion />);
```

### Skills & Templates

Configure a skill list with `skills`, and use `skillHotKey` to set the shortcut for skill panel.

- `skills` sample format:
```ts
interface Skill {
    label?: string;
    value?: string;
    icon?: React.ReactNode;
    // If this skill has a template, set hasTemplate to true, affects the display of template display buttons
    hasTemplate?: boolean;
}
```

Because templates can be displayed in a variety of ways, we don't provide a default display method. Users can customize the template display through the `renderTemplate` API. The template panel can be displayed and closed by clicking the template button.

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
        label: 'Writing',
        hasTemplate: true,
    },
    {
        icon: <IconSearch />,
        value: 'AI coding',
        label: 'AI coding'
    },
];

const template = [
    {
        groupKey: 'value',
        group: 'Work',
        children: [
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: 'Summary report',
                desc: 'Condensate your work results',
                content: `My occupation is <input-slot placeholder="[Please enter your occupation]"></input-slot>. Please help me write a summary report on <input-slot placeholder="[Purpose: Project Progress Summary, Team Work Results, or Other]</input-slot>`
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: 'Speech skills',
                desc: 'Meet the expression needs of different scenarios',
                content: `I am a <select-slot value="Worker" options='["Worker","Student"]'></select-slot>, please help me write a paragraph for <input-slot placeholder="[input object]">unfamiliar colleagues</input-slot>`
            }
        ]
    },
    {
        groupKey: 'marketing',
        group: 'Marketing',
        children: [
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: 'Promotional copy',
                desc: 'Write promotional copy for each platform',
                content: 'Please help me write a promotional copy for <input-slot placeholder="[Enter target group]"></input-slot> professionals about <input-slot placeholder="[Enter product]"></input-slot>. It needs to directly hit the pain points and attract users to click.'
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: 'Program planning',
                desc: 'Tailor-made solutions',
                content: 'I am a <input-slot placeholder="[Enter occupation]"></input-slot> professional planner. Please help me write a <input-slot placeholder="[Plan type: such as offline book club activity plan, etc.]"></input-slot> offline book club activity plan, which should include but not be limited to planning goals, detailed plans, required resources and budget, effect evaluation, risk response, etc.'
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
            placeholder='Input / invoke skills'
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

### Custom Top Slot

Users can customize the top rendering area using the `renderTopSlot` API, rendering references, uploaded content, and configuration items. This can be combined with the `showReference` and `showUploadFile` APIs to control whether references and uploaded files are displayed. Additionally, the `topSlotPosition` API allows you to configure the relative position of customized rendered content relative to the reference and upload display areas.

```ts
interface TopSlotProps {
    references: Reference[];
    attachments: Attachment[];
    // User input into the input box
    content: Content[];
    handleUploadFileDelete: (attachment: Attachment) => void;
    handleReferenceDelete: (reference: Reference) => void
}
```

Usage examples are as follows:

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
            placeholder="Customize the rendering of top content"
        />
    );
}

render(<RenderTopSlot />);
```

### Custom Extensions

Rich text areas support custom extensions. For implementation details, see [Tiptap Custom Extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new). Custom extensions can be added to the AIChatInput component using the `extensions` API. If you add a custom extension, you must configure the corresponding transformation rules in `transformer` to ensure that the data returned in `onContentChange` matches your expectations.

When adding a custom extension, please note the following:

- Please add the `isCustomSlot` property to your custom extension. This property is related to the cursor height before and after the custom extension.
- Since `AIChatInput` uses `Enter` as the send hotkey, if your custom extension uses `Enter` as a shortcut, you need to manually configure `AIChatInput.allowHotKeySend` in `editor.storage` to indicate whether the hotkey should be used by AIChatInput for sending, in order to avoid hotkey conflicts.

An example of a custom extension definition and related notes is as follows:

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

// Panel options
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

// First level content
const FirstLevel = Object.keys(TestAction);

// referSlot rendering component
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

// Creating a ReferSlot Extension
const ReferSlot = Node.create({
    name: 'referSlot',
    inline: true,
    group: 'inline',
    atom: true,
    selectable: false,
    addAttributes() {
        return {
            value: {
                default: 'Enter content',
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
        // Output custom tags when serializing and keep the value in data-value
        return ['refer-slot', mergeAttributes(HTMLAttributes)];
    },
    addNodeView() {
        return ReactNodeViewRenderer(ReferSlotComponent);
    },
});

// Update position function
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

// Rendering Panel for mention list
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
        // When the options panel is rendered, the Enter shortcut should be used in the options panel, not for sending with AIChatInput.
        props.command({ allowHotKeySend: false });
    }
    componentWillUnmount() {
        // If the options panel is unmounted, the Enter shortcut should be used to send AIChatInput.
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
            // Manual filter
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
        // Use @ to trigger
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
            {/* Order: reference, rich text area content, attachments */}
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
                placeholder="Use @ to trigger"
            />
        </>
    );
};

render(<CustomRichTextExtension />);
```

## API Reference

### AIChatInput

| Prop | Description | Type | Default |
|------|-------------|------|---------|
| canSend | Whether sending is allowed. If not set, sending depends on input, uploads, and references | boolean | true |
| className | Custom class name | string | - |
| defaultContent | Default input content, supports html string or Tiptap content | TiptapContent | - |
| dropdownMatchTriggerWidth | Should dropdown width match input? | boolean | true |
| extensions | Custom editor extensions | Extension[] | - |
| generating | Is it generating? | boolean | false |
| onContentChange | Callback when input content changes | (content: <ApiType detail='{ type: string; [key: string]: any }'>OnContentChangeProps</ApiType>) => void | - |
| onMessageSend | Callback for sending message | (content: <ApiType detail='{references?: Reference[]; attachments?: Attachment[]; inputContents?: Content[]; setup?: Setup}'>OnMessageSendProps</ApiType>) => void | - |
| onReferenceClick | Callback for clicking a reference | (reference: Reference) => void | - |
| onReferenceDelete | Callback for deleting a reference | (reference: Reference) => void | - |
| onSkillChange | Callback for switching skills | (skill: Skill) => void | - |
| onStopGenerate | Callback for stop generate | () => void | - |
| onSuggestClick | Callback for clicking a suggestion | (suggestion: Suggestion) => void | - |
| onTemplateVisibleChange | Callback for template's visibility change | (visible: boolean) => void | - |
| onUploadChange | Callback for file upload | (props: OnChangeProps) => void | - |
| popoverProps | Popup configuration | PopoverProps | - |
| placeholder | Input placeholder | string | - |
| references | Reference list | Reference[] | - |
| renderActionArea | Custom bottom-right operation area | () => React.ReactNode | - |
| renderConfigureArea | Custom configuration area | () => React.ReactNode | - |
| renderReference | Custom render reference | (reference: Reference) => ReactNode | - |
| renderSkillItem | Custom skill list item renderer | (props: <ApiType detail='{skill: Skill; onClick: () => void; className: string, onMouseEnter: () => void}'>RenderSkillItemProps</ApiType>) => React.ReactNode | - |
| renderSuggestionItem | Custom suggestion item renderer | (props: <ApiType detail='{ suggestion: Suggestion; onClick: () => void; className: string, onMouseEnter: () => void}'>RenderSkillItemProps</ApiType>) => React.ReactNode | - |
| renderTemplate | Custom template renderer | (skill: Skill, onTemplateClick: (content: string) => void) => React.ReactNode | - |
| renderTopSlot | Custom top slot renderer | () => React.ReactNode | - |
| round | Whether config/action areas have rounded style | boolean | true |
| onBlur | Callback when input blurs | (event: React.FocusEvent) => void | - |
| onConfigureChange | Callback for configuration area changes | (value: LeftMenuChangeProps, changedValue: LeftMenuChangeProps) => void | - |
| onFocus | Callback when input focused | (event: React.FocusEvent) => void | - |
| showReference | Show reference area | boolean | true |
| showTemplateButton | Show template button | boolean | false |
| showUploadFile | Show upload file area | boolean | true |
| skillHotKey | Skill panel trigger shortcut | string | - |
| skills | Skill list | Skill[] | - |
| style | Custom style | React.CSSProperties | - |
| suggestions | Suggestions list | Suggestion[] | - |
| templatesCls| The template's style class name| string | - |
| templatesStyle| Template style| React.CSSProperties | - |
| topSlotPosition | Top slot position: relative to reference and uploads | 'top' \| 'bottom' \| 'middle' | - |
| transformer | Customizing the conversion rules for extensions | Map<string, (obj: any) => any> | |
| uploadProps | Upload configuration | UploadProps | - |
| uploadTipProps | Upload tip configuration | UploadTipProps | - |

## Methods

| Method | Description | Type | Default |
|--------|-------------|------|---------|
| changeTemplateVisible | Toggle visibility of the template popup | (visible: boolean) => void | - |
| deleteContent | Delete an item in the rich text. The deletion logic depends on the uniqueKey in the content. | (content: Content) => void | - |
| deleteUploadFile | Delete an item in the uploaded file | (item: Attachment) => void | - |
| focusEditor | Focus the input box. By default, the focus is on the end of the input box. | (pos?: string) => void | - |
| getEditor | Get the current tiptap editor instance | () => Editor | - |
| setContent | Set input box content | (content: TiptapContent) => void | - |
| setContentWhileSaveTool | Set the input box content while retaining the skill item | (content: TiptapContent) => void | - |

## Design Tokens

<DesignToken/>
