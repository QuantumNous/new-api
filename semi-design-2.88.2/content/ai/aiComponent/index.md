---
localeCode: zh-CN
order: 99
category: Ai
title: AIComponent 能力介绍
icon: doc-aiComponent
width: 60%
brief: 整体介绍 AI 应用场景下的组件能力
showNew: true
---

Semi AI 组件是一套专为 AI 应用场景设计的创新组件库。面对 AI 正在成为产品主角的时代，传统的设计体系已难以支撑日益复杂的智能交互，Semi AI 组件以「人机智能协同」为核心理念，致力于让用户与 AI 系统协作更高效、可控、可感知、可信赖。Semi AI 组件库包含以下内容：AI Token、AI 基础组件以及 AI Chat 组件，用于服务智能问答与助手、多模态输入与多轮对话等场景。

- `AI Token`， 新增加 AI 场景下的基础 20 个颜色的基础 token
- `AI 基础组件`， 新增加 AI 场景下的 25 个 icon，以及对 `Button/Tag/FloatButton` 新增 AI 风格
- `AI Chat 组件`，新增加支持富文本输入、引用，上传、功能配置、及丰富自定义展示的 `AIChatInput`；以及会话展示、选择、编辑、提示、丰富自定义渲染、消息转换的 `AIChatDialogue`，对话组件默认支持 OpenAI 社区 [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) 格式标准，对 GPT-5、GPT-4o 系列模型的响应均支持开箱即用，详见[消息数据转换](/zh-CN/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2)（关于 `Chat` 组件和 `AI Chat` 组件如何选型见 [FAQ](/zh-CN/ai/aiComponent#FAQ)）

在未来，我们将支持更多 AI Chat 组件，比如结合 `AIChatInput` 和 `AIChatDialogue` 的一体化组件 `AIChatBox`，以及具备产物编辑、产物查看、引用资料展示等能力的多功能侧边栏组件 `SideBar`，用于满足复杂 AI 应用场景下的信息与结果管理需求。


### AI 基础组件

AI 基础组件包括 `AI Icon`、AI 风格的 `Button` / `Tag` / `FloatButton`， AI 基础组件的 AI 风格是在 `AI Token` 的基础上实现。

对于 `AI Token`，我们构建了一套以紫蓝渐变系为核心的品牌色板，在基础色中，新增加了 AI purple 和 AI general 两个色相，20 个颜色的色盘。

对于 `AI Icon`，支持 Icon 场景下的单色、双色、及多色 Icon，共 25 个图标。

对于 AI 风格的 `Button / Tag / FloatButton`，可通过组件的 `Colorful` 属性开启。

以下是 AI 基础组件的一些示例，更多示例及使用场景详见 [AI Token](/zh-CN/basic/tokens)、[AI Icon](zh-CN/basic/icon)、[AI Button](/zh-CN/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE)、[AI Tag](/zh-CN/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE)、[AI FloatButton](/zh-CN/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE)。
 

```jsx live=true dir="column"
import React from 'react';
import { Typography, Button, Tag, FloatButton } from '@douyinfe/semi-ui';
import { IconAIBellLevel1, IconAIEditLevel2, IconAIFileLevel3, IconAIFilledLevel3, IconAIImageLevel3, IconAISearchLevel3, IconAIStrokedLevel3, IconAIWandLevel3, IconAILoading, IconAIFilledLevel1, IconAIEditLevel1 } from '@douyinfe/semi-icons';

() => {
    return (<div style={{ display: 'flex', flexDirection: 'column', rowGap: 20 }}>
        <div key="AIToken" style={{ display: 'flex', flexDirection: 'column', rowGap: 10 }}>
            <Typography.Title heading={5}>AI Token</Typography.Title>
            <div style={{ display: 'flex', alignItems: 'center', columnGap: 10 }}>
                <span>Purple</span>
                <div style={{ display: 'inline-flex', columnGap: 4 }}>
                    {(new Array(10).fill(1).map((i, index) => (
                        <div key={index} style={{ width: 40, height: 40, backgroundColor: `rgba(var(--semi-ai-purple-${index}), 1)`, borderRadius: '50%' }} />
                    )))}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', columnGap: 10 }}>
                <span>General</span>
                <div style={{ display: 'inline-flex', columnGap: 4, }}>
                    {(new Array(10).fill(1).map((i, index) => (
                        <div key={index} style={{ width: 40, height: 40, background: `var(--semi-ai-general-${index})`, borderRadius: '50%' }} />
                    )))}
                </div>
            </div>
        </div>
        <div key="AIIcon" style={{ display: 'flex', flexDirection: 'column', rowGap: 10 }}>
            <Typography.Title heading={5} >AI Icon</Typography.Title>
            <div style={{ display: 'flex', columnGap: 10 }}>
                <IconAIBellLevel1 size="extra-large"/>
                <IconAIEditLevel2 size="extra-large"/>
                <IconAIFileLevel3 size="extra-large" />
                <IconAIFilledLevel3 size="extra-large" />
                <IconAIImageLevel3 size="extra-large" />
                <IconAISearchLevel3 size="extra-large" />
                <IconAIStrokedLevel3 size="extra-large" />
                <IconAIWandLevel3 fill={['var(--semi-color-danger)', 'var(--semi-color-success)', 'var(--semi-color-primary)', 'var(--semi-color-warning)']} size="extra-large"/>
                <IconAILoading size="extra-large"/>
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', rowGap: 10 }}>
            <Typography.Title heading={5}>AI Button</Typography.Title>
            <div style={{ display: 'flex', rowGap: 16, flexDirection: 'column' }}>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button colorful theme="solid" type="primary" icon={<IconAIFilledLevel1 />}>Colorful</Button>
                    <Button colorful theme="solid" type="primary" loading >Colorful</Button>
                    <Button colorful theme="solid" type="primary" icon={<IconAIFilledLevel1 />} disabled >Colorful</Button>
                </div>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button colorful theme="solid" type="tertiary" icon={<IconAIFilledLevel3 />}>Colorful</Button>
                    <Button colorful theme="solid" type="tertiary" loading >Colorful</Button>
                    <Button colorful theme="solid" type="tertiary" icon={<IconAIFilledLevel3 />} disabled >Colorful</Button>
                </div>
                <div style={{ display: 'flex', columnGap: 16 }}>
                    <Button colorful theme="solid" type="primary" icon={<IconAIFilledLevel1 />} />
                    <Button colorful theme="solid" type="primary" loading />
                    <Button colorful theme="solid" type="primary" icon={<IconAIFilledLevel1 />} disabled />
                    <Button colorful theme="solid" type="tertiary" icon={<IconAIFilledLevel3 />} />
                    <Button colorful theme="solid" type="tertiary" loading />
                    <Button colorful theme="solid" type="tertiary" icon={<IconAIFilledLevel3 />} />
                </div>
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', rowGap: 10 }}>
            <Typography.Title heading={5} style={{ marginTop: 10 }}>AI Tag</Typography.Title>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content' }}>
                <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="solid" shape='circle' gradient>AI</Tag>
                <Tag colorful prefixIcon={<IconAIFilledLevel3 size="small" />} type="light" shape='circle' gradient>AI</Tag>
                <Tag colorful prefixIcon={<IconAIFilledLevel3 size="small"/>} type="ghost" shape='circle' gradient >AI</Tag>
                <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="solid" shape='circle' >AI</Tag>
                <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small" />} type="light" shape='circle'>AI</Tag>
                <Tag colorful prefixIcon={<IconAIFilledLevel1 size="small"/>} type="ghost" shape='circle'>AI</Tag>
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', rowGap: 10 }}>
            <Typography.Title heading={5} style={{ marginTop: 10 }}>AI FloatButton</Typography.Title>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content' }}>
                <FloatButton 
                    icon={<IconAIEditLevel1 />}
                    colorful
                    size="large"
                    badge={{ count: 'VIP', type: "danger" }}
                    style={{ position: 'static' }} 
                />
            </div>
        </div>
    </div>);
};
```

### AI Chat 组件构建对话

本例中我们将联合使用 `AIChatInput` 和 `AIChatDialogue` 组件，构建一个适用于 `Multiple Agent` 场景的对话用例。
更多示例及使用场景详见 [AIChatInput](/zh-CN/ai/aiChatInput)、[AIChatDialogue](/zh-CN/ai/aiChatDialogue)。前后端组合使用用例可参考[semi-ai-chat-demo](https://github.com/YannLynn/semi-ai-chat-demo)

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue, AIChatInput, chatInputToMessage, Typography, Button } from '@douyinfe/semi-ui';
import { IconFixedStroked, IconFeishuLogo, IconBookOpenStroked, IconGit, IconFigma, IconWord, IconClose, IconTemplateStroked, IconSearch } from '@douyinfe/semi-icons';

const { Configure } = AIChatInput;

const simpleIsEqual = (a, b) => {
    if (a === b) {
        return true;
    }
    if (Number.isNaN(a) && Number.isNaN(b)) {
        return true;
    }
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return false;
    }
    const isArrayA = Array.isArray(a);
    const isArrayB = Array.isArray(b);
    if (isArrayA !== isArrayB) {
        return false; 
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
        return false;
    }
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) {
            return false;
        }
        if (!simpleIsEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
};


function AIChatInputWithDialogue() {
    const inputOuterStyle = { margin: '12px', minHeight: 150, maxHeight: 300, flexShrink: 0 };
    const editingInputOuterStyle = { margin: '12px 0px', maxHeight: 300, flexShrink: 0 };
    const dialogueOuterStyle = { flex: 1, overflow: 'auto' };
    const [sideBarVisible, setSideBarVisible] = useState(false);
    const [messages, setMessages] = useState(defaultMessages); 
    const [generating, setGenerating] = useState(false);
    const [references, setReferences] = useState([]); 
    const [sideBarContent, setSideBarContent] = useState({});

    const renderLeftMenu = useCallback(() => (<>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
        <Configure.Mcp options={mcpOptions} />
        <Configure.RadioButton options={radioButtonProps} field="thinkType" initValue="think"/>
    </>), []);

    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessages(chats);
    }, []);

    const onContentChange = useCallback((content) => {
        // console.log('onContentChange', content);
    }, []);


    const onReferenceClick = useCallback((item) => {
        setReferences((references) => [...references, { ...item, id: `reference-${Date.now()}` }]);
    }, []);

    const handleReferenceDelete = useCallback((item) => {
        const newReference = references.filter((ref) => ref.id !== item.id);
        setReferences(newReference);
    }, [references]);

    const onMessageSend = useCallback((props) => {
        setGenerating(true);
        // 模拟发送请求
        setMessages((messages) => [...messages, {
            id: `message-${Date.now()}`,
            ...chatInputToMessage(props),
        }]);
        setReferences([]);
        setTimeout(() => {
            setGenerating(false);
        }, 100);
        setTimeout(() => {
            // 模拟接口返回
            setMessages((messages) => {
                return [...messages, {
                    id: `message-${Date.now()}`,
                    role: 'assistant',
                    name: 'FE',
                    content: "这是一条 mock 回复信息",
                }];
            });
        }, 1000);
    }, []);

    const onEditMessageSend = useCallback((props) => {
        const index = messages.findIndex((message) => message.editing);
        const newMessages = [...messages.slice(0, index), {
            id: `message-${Date.now()}`,
            ...chatInputToMessage(props),
        }];
        setMessages(newMessages);
    }, [messages]);

    const handleEditingReferenceDelete = useCallback((item) => {
        const newMessages = messages.map((message) => {
            if (message.editing) {
                message.references = message.references.filter((ref) => ref.id !== item.id);
            }
            return message;
        });
        setMessages(newMessages);
    }, [messages]);

    const messageEditRender = useCallback((props) => {
        return (
            <AIChatInput 
                style={editingInputOuterStyle}
                generating={false}
                references={props.references}
                uploadProps={{ ...uploadProps, defaultFileList: props.attachments }}
                defaultContent={props.inputContents[0].text}
                renderConfigureArea={renderLeftMenu} 
                // onContentChange={onContentChange}
                onMessageSend={onEditMessageSend}
                onReferenceDelete={handleEditingReferenceDelete}
            />
        );
    }, [messages, handleEditingReferenceDelete]);

    const changeSideBarContent = useCallback((content) => {
        setSideBarContent((oldContent) => {
            if (!simpleIsEqual(content, oldContent)) {
                setSideBarVisible(true);
            } else {
                setSideBarVisible(v => !v);
            }
            return content;
        });
    });

    const onAnnotationClick = useCallback((annotations) => {
        changeSideBarContent({
            type: 'annotation',
            value: annotations
        });
    }, [changeSideBarContent]);

    const toggleSideBar = useCallback(() => {
        setSideBarVisible(v => !v);
    }, []);

    const renderSideBarTitle = useCallback((content) => {
        const { type, value } = content;
        return <div style={{ display: 'flex', alignItems: 'center ', justifyContent: 'space-between', padding: 12, color: 'var(--semi-color-text)' }}>
            {type === 'annotation' && <div style={{ fontSize: '16px', lineHeight: '22px', fontWeight: 600 }}>参考资料</div>}
            {type === 'resource' && <div style={{ fontSize: '16px', lineHeight: '22px', fontWeight: 600 }}>产物列表</div>}
            <Button onClick={toggleSideBar} theme="borderless" type="tertiary" icon={<IconClose />} style={{ padding: '0px', width: 24, height: 24 }} />
        </div>;
    }, [toggleSideBar]);

    const renderSideBarBody = useCallback((content) => {
        const { type, value = {} } = content;
        if (type === 'annotation') {
            return <div style={{ display: 'flex', flexDirection: 'column', rowGap: '12px', padding: '12px' }} >
                {value.map((item, index) => (<div key={index} style={{ display: 'flex', flexDirection: 'column', rowGap: '8px' }} >
                    <span style={{ display: 'flex', alignItems: 'center ', columnGap: 4 }}>
                        <img style={{ width: 20, height: 20, borderRadius: '50%' }} src={item.logo}/>
                        <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 600, color: 'var(--semi-color-text-0)' }}>{item.title}</span>
                    </span>
                    <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--semi-color-text-1)' }} >{item.detail}</Typography.Paragraph>
                </div>))}
            </div>;
        } else if (type === 'resource') {
            return <div style={{ display: 'flex', flexDirection: 'column', rowGap: '12px', padding: '12px' }} >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', }}>
                    <IconWord style={{ color: 'var(--semi-color-primary)' }} size='extra-large' /> {value.name}
                </div>
            </div>;
        }
        return <div>

        </div>;
    }, []);

    const customRender = {
        "resource": (item, message) => {
            return <div 
                style={{ 
                    display: 'flex', 
                    gap: 8, 
                    backgroundColor: 'var(--semi-color-fill-0)', 
                    padding: '12px 16px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '12px',
                    cursor: 'pointer'
                }}
                onClick={() => {
                    changeSideBarContent({
                        type: 'resource',
                        value: item
                    });
                }}
            >
                <IconWord style={{ color: 'var(--semi-color-primary)' }} />
                {item.name}
            </div>;
        },
    };

    return (
        <div style={{ display: 'flex', columnGap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 32px)', overflow: 'hidden', flexGrow: 1 }}>
                <AIChatDialogue 
                    style={dialogueOuterStyle}
                    roleConfig={roleConfig}
                    showReference={true}
                    align="leftRight"
                    mode="bubble"
                    chats={messages}
                    onChatsChange={onChatsChange}
                    onReferenceClick={onReferenceClick}
                    messageEditRender={messageEditRender}
                    onAnnotationClick={onAnnotationClick}
                    renderDialogueContentItem={customRender}
                />
                <AIChatInput 
                    style={inputOuterStyle}
                    placeholder={'输入内容或者上传内容'} 
                    defaultContent={'我是一名<input-slot placeholder="[职业]">程序员</input-slot>，帮我实现<input-slot placeholder="[需求描述]">Multi Agent 场景下的聊天应用</input-slot>需求'}
                    generating={generating}
                    references={references}
                    uploadProps={uploadProps}
                    renderConfigureArea={renderLeftMenu} 
                    onContentChange={onContentChange}
                    onMessageSend={onMessageSend}
                    onStopGenerate={() => setGenerating(false)}
                    onReferenceDelete={handleReferenceDelete}
                />
            </div>
            {sideBarVisible && <div 
                style={{ flexShrink: 0, width: 300, height: 'calc(100vh - 32px)', borderRadius: '12px', border: '1px solid var(--semi-color-border)', flexShrink: 0 }}
            >
                {renderSideBarTitle(sideBarContent)}
                {renderSideBarBody(sideBarContent)}
            </div>}
        </div>
    );
}


const defaultMessages = [{
    id: '1',
    role: 'user',
    content: '我想开发一个 Multi Agent 场景下的聊天应用，你能帮我设计一下吗？',
    status: 'completed',
}, {
    id: '2',
    role: 'assistant',
    name: 'PM',
    content: [{
        type: 'message',
        content: [{
            type: 'input_text',
            text: '收到。为保证方案可落地，我先明确目标与范围：\n\n- 目标：支持多 Agent 协同回复，用户可选择 Agent 或由系统自动分配\n- MVP 功能：\n  1) 基础对话（文本/图片/文件）\n  2) Agent 身份标识与头像\n  3) 正在输入与流式输出\n  4) 引用来源与工具结果展示\n- 约束：先做单会话，不做云端持久化；优先移动端适配\n\n接下来我会整理 PRD 要点并同步给设计与前端。',
            annotations: [
                {
                    title: 'Semi Design',
                    url: 'https://semi.design/zh-CN/start/getting-started',
                    detail: 'Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统。作为一个全面、易用、优质的现代应用UI解决方案，Semi Design从字节跳动各业务线的复杂场景中提炼而来，目前已经支撑了近千个平台产品，服务了内外部超过10万用户',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                },
                {
                    title: 'Semi DSM',
                    url: 'https://semi.design/zh-CN/start/getting-started',
                    detail: 'Semi DSM 支持全局、组件级别的样式定制，并在 Figma 和线上代码之间保持同步。使用 DSM，将 Semi Design 适配为 Any Design',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                },
                {
                    title: 'Semi D2C',
                    url: 'https://semi.design/zh-CN/start/getting-started',
                    detail: 'Semi D2C 提供开箱即用的设计稿转代码：支持一键识别 Figma 页面中图层布局 + 设计系统组件，像素级还原设计稿，转译为 React JSX 和 CSS 代码。此外还提供了丰富的扩展能力，基于自定义插件系统快速打造团队专属的设计研发协作工具。',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                }
            ],
        }],
    }],
}, {
    id: '3',
    role: 'assistant',
    name: 'PM',
    content: [{
        type: 'message',
        content: [{
            type: 'input_text',
            text: '生成的PRD如下，设计师会先根据此摘要出信息架构与关键页面',
        }, {
            type: 'resource',
            name: 'PRD.doc',
            size: '100KB',
        }]
    }],
}, {
    id: '4',
    role: 'assistant',
    name: 'UI',
    content: [{
        id: "rs_02175871288540800000000000000000000ffffac1598778c9aa5",
        type: "reasoning",
        summary: [
            {
                "type": "summary_text",
                "text": "\n根据产品经理给的 PRD 绘制关键页面，我需要...."
            }
        ],
        status: "completed"
    }, {
        type: 'function_call',
        name: 'paint_key_pages',
        arguments: "{\"file\":\"PRD\"}",
        status: 'completed',
    }, {
        type: 'message',
        content: [{
            "type": "output_text",
            "text": `设计初稿如下：\n\n- 信息架构：对话页（历史列表 | 消息流 | 工具卡片区）\n- 视觉：左侧展示 Agent 头像与名称标签，色块区分角色\n- 交互：\n  - 输入区支持 @Agent 快速切换与建议提示\n  - 流式输出时展示打字气泡与进度占位\n  - 工具结果以卡片/步骤条形式插入，可展开详情与复制\n\n我先出低保真线框，稍后补高保真与动效说明。`,
        }],
        status: "completed"
    }],
    status: 'completed',
}, {
    id: '5',
    role: 'assistant',
    name: 'FE',
    content: `技术方案建议：\n\n- 技术栈：React + Semi UI，后端采用 WebSocket 或 SSE 支持流式响应\n- 数据模型：消息包含 id、role、name、content、status、references 等字段\n- 组件拆分：AIChatInput + AIChatDialogue；内容采用 Markdown 渲染，支持图片与文件点击\n- 性能：虚拟列表与滚动置底；长文本分块渲染；图片懒加载\n- 可观测性：埋点消息延迟、出错率、工具调用耗时\n\n若确认，我可先搭建页面骨架并接入 mock 数据进行联调。`,
}];

const roleConfig = {
    user: {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/img/user.png'
    },
    assistant: new Map([
        ['PM', {
            name: '产品经理',
            avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/PM.png'
        }],
        ['UI', {
            name: '设计师',
            avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/UI.png'
        }],
        ['FE', {
            name: '前端开发',
            avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/FE.png'
        }],
    ]),
};

const uploadProps = {
    action: "https://api.semi.design/upload"
};

const modelOptions = [
    {
        value: 'GPT-5',
        label: 'GPT-5',
        type: 'gpt',
    },
    {
        value: 'GPT-4o',
        label: 'GPT-4o',
        type: 'gpt',
    },
    {
        value: 'Claude 3.5 Sonnet',
        label: 'Claude 3.5 Sonnet',
        type: 'claude',
    },
];

const mcpOptions = [
    {
        icon: <IconFeishuLogo />,
        label: "飞书文档",
        value: "feishu",
    },
    {
        icon: <IconGit />,
        label: "Github Mcp",
        value: "github",
    },
    {
        icon: <IconFigma />,
        label: "IconFigma Mcp",
        value: "IconFigma",
    }
];

const radioButtonProps = [
    { label: <IconTemplateStroked />, value: 'fast' },
    { label: <IconSearch />, value: 'think' }
];

render(AIChatInputWithDialogue);
```

### FAQ 
- **Chat 组件和 AI Chat 系列组件应该如何选型？**
   - 如果场景比较简单，仅需要普通文字对话和简单文件图片展示，推荐 Chat 组件。
        - [Chat](/zh-CN/plus/chat) 组件默认集成 input 输入和消息展示部分，优势是理解简单，能够快速上手；缺点是复杂的输入框或者消息展示需求定制相对困难，工作量大。
   - 如果场景相对复杂，推荐将 AIChatInput 和 AIChatDialogue 组件搭配使用，优势如下：
        - [AIChatInput](/zh-CN/ai/aiChatInput) 支持更复杂的样式定制。
            1. 用户可以非常方便地定制左下角的[配置区域](/zh-CN/ai/aiChatInput#%E9%85%8D%E7%BD%AE%E5%8C%BA%E5%9F%9F)和右下角的[操作区域](/zh-CN/ai/aiChatInput#%E6%93%8D%E4%BD%9C%E5%8C%BA%E5%9F%9F)；
            2. 提供[富文本输入区](/zh-CN/ai/aiChatInput#%E5%AF%8C%E6%96%87%E6%9C%AC%E8%BE%93%E5%85%A5%E5%8C%BA)展示输入模版；
            3. 默认支持[引用](/zh-CN/ai/aiChatInput#%E5%BC%95%E7%94%A8)展示；
            4. 支持热键唤起的[技能模版](/zh-CN/ai/aiChatInput#%E6%8A%80%E8%83%BD%E5%8F%8A%E6%A8%A1%E7%89%88)；
            5. 支持自定义[ Input 扩展](/zh-CN/ai/aiChatInput#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%89%A9%E5%B1%95)和[ TopSlot](/zh-CN/ai/aiChatInput#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E9%A1%B6%E9%83%A8%E5%8C%BA%E5%9F%9F)，复杂展示也能轻松实现。
        - [AIChatDialogue](/zh-CN/ai/aiChatDialogue) 消息展示的灵活性更高。
            1. 组件默认支持 OpenAI 的 [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) Object 格式标准，调用[内部消息转换函数](/zh-CN/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2)可轻松进行将 OpenAI 返回的结果转换为组件需要的数据结构。
            2. 提供[根据消息类型的定制展示](/zh-CN/ai/aiChatDialogue#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E6%B6%88%E6%81%AF%E5%86%85%E5%AE%B9)的 API，方便快速实现消息展示。
            3. 默认支持消息[引用](/zh-CN/ai/aiChatDialogue#%E5%BC%95%E7%94%A8)和[选择](/zh-CN/ai/aiChatDialogue#%E9%80%89%E6%8B%A9)操作。

