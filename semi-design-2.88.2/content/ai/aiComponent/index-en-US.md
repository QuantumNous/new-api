---
localeCode: en-US
order: 99
category: Ai
title: AI Ability Introduction
icon: doc-aiComponent
width: 60%
brief: Introducing components related to AI application scenarios
showNew: true
---

Semi AI Components is an innovative component library designed specifically for AI application scenarios. In an era where AI is becoming a key player in products, traditional design systems are struggling to support increasingly complex intelligent interactions. Semi AI Components, with "human-machine intelligent collaboration" as its core concept, aims to make user collaboration with AI systems more efficient, controllable, perceptible, and reliable. The Semi AI Components library includes the following: AI Token, basic AI components, and AI Chat components, used to serve scenarios such as intelligent question answering and assistants, multimodal input, and multi-turn dialogue.

- `AI Token`: Added 20 basic tokens in 20 colors for AI scenarios.

- `AI Basic Components`: Added 25 icons for AI scenarios, and added AI styles to `Button/Tag/FloatButton`.

- `AI Chat Components`: Added `AIChatInput`, which supports rich text input, quoting, uploading, function configuration, and rich custom display; and `AIChatDialogue`, which supports conversation display, selection, editing, prompts, rich custom rendering, and message transformation. The chat component supports the OpenAI community's [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) format standards by default, supporting GPT-5 and GPT-4o. All models in the series support out-of-the-box response; see [Message Data Conversion](/en-US/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2) for details. (For information on how to select the `Chat` and `AI Chat` components, see [FAQ](/en-US/ai/aiComponent#FAQ)).

In the future, we will support more AI Chat components, such as the integrated component `AIChatBox` combining `AIChatInput` and `AIChatDialogue`, and the multi-functional sidebar component `SideBar` with capabilities for product editing, product viewing, and displaying cited materials, to meet the information and result management needs in complex AI application scenarios.

### AI Basic Components

The AI ​​basic components include `AI Icon` and AI-style `Button`, `Tag`, and `FloatButton`. The AI ​​style of the basic AI components is implemented based on `AI Token`.

For `AI Token`, we have built a brand color palette with a purple-blue gradient as its core. Two new hues, AI purple and AI general, have been added to the base colors, resulting in a color wheel of 20 colors.

For `AI Icon`, single-color, dual-color, and multi-color icons are supported, totaling 25 icons.

For AI-style `Button`, `Tag`, and `FloatButton`, the `Colorful` property of the component can be enabled.

Below are some examples of basic AI components. For more examples and use cases, please see [AI Token](/en-US/basic/tokens), [AI Icon](en-US/basic/icon), [AI Button](/en-US/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE), [AI Tag](/en-US/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE), [AI FloatButton](/en-US/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE).

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

### Building a Conversation with the AI ​​Chat Component

In this example, we'll combine the AIChatInput and AIChatDialogue components to build a conversational use case suitable for a Multiple Agent scenario.
For more examples and usage scenarios, see [AIChatInput](/en-US/ai/aiChatInput) and [AIChatDialogue](/en-US/ai/aiChatDialogue). For examples of front-end and back-end combined use cases, please refer to [semi-ai-chat-demo](https://github.com/YannLynn/semi-ai-chat-demo).

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
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">Online search</Configure.Button>
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
                    content: "This is a mock reply message.",
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
            {type === 'annotation' && <div style={{ fontSize: '16px', lineHeight: '22px', fontWeight: 600 }}>References</div>}
            {type === 'resource' && <div style={{ fontSize: '16px', lineHeight: '22px', fontWeight: 600 }}>Product List</div>}
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
                    placeholder={'Enter content or upload content'} 
                    defaultContent={'I am a <input-slot placeholder="[Profession]">programmer</input-slot>，Please help me implement<input-slot placeholder="[Requirement Description]">a chat application in a Multi-Agent scenario</input-slot>'}
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
    content: 'I want to develop a chat application for a multi-agent scenario. Can you help me design it?',
    status: 'completed',
}, {
    id: '2',
    role: 'assistant',
    name: 'PM',
    content: [{
        type: 'message',
        content: [{
            type: 'input_text',
            text: 'Received. To ensure the feasibility of the solution, I will first clarify the goals and scope:\n\n- Goal: Support multi-agent collaborative replies, where users can choose an agent or the system can automatically assign one.\n- MVP Features:\n 1) Basic conversation (text/image/file)\n 2) Agent identification and avatar\n 3) Input in progress and streaming output\n 4) Display of cited sources and tool results\n- Constraints: Focus on single-session implementation first, without cloud persistence; prioritize mobile adaptation.\n\nNext, I will organize the PRD key points and share them with the design and front-end teams.',
            annotations: [
                {
                    title: 'Semi Design',
                    url: 'https://semi.design/en-US/start/getting-started',
                    detail: 'Semi Design is a design system designed, developed, and maintained by the Douyin front-end team and the MED product design team. As a comprehensive, user-friendly, and high-quality modern application UI solution, Semi Design is derived from the complex scenarios across ByteDance various business lines. It currently supports nearly a thousand platform products and serves over 100,000 internal and external users.',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                },
                {
                    title: 'Semi DSM',
                    url: 'https://semi.design/en-US/start/getting-started',
                    detail: 'Semi DSM supports global and component-level style customization and maintains synchronization between Figma and online code. Using DSM, Semi Design can be adapted to Any Design.',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
                },
                {
                    title: 'Semi D2C',
                    url: 'https://semi.design/en-US/start/getting-started',
                    detail: 'Semi D2C offers out-of-the-box design-to-code conversion: it supports one-click recognition of layer layouts and design system components in Figma pages, reproducing design drafts pixel-perfectly and translating them into React JSX and CSS code. Furthermore, it provides rich extensibility, allowing teams to quickly create their own custom design and development collaboration tools based on a custom plugin system.',
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
            text: 'The generated PRD is as follows. The designer will first use this summary to create the information architecture and key pages.',
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
                "text": "\nBased on the PRD provided by the product manager, I need to draw the key pages."
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
            "text": `The initial design draft is as follows:\n\n- Information Architecture: Dialogue Page (History List | Message Flow | Tool Card Area)\n- Visuals: The left side displays Agent avatars and name tags, with color blocks distinguishing roles\n- Interaction:\n- Input area supports quick switching and suggestion prompts using @Agent\n- During streaming output, a typing bubble and progress placeholder are displayed\n- Tool results are inserted in the form of cards/step bars, which can be expanded for details and copied\n\nI'll start with a low-fidelity wireframe; high-fidelity and animation details will be added later.`,
        }],
        status: "completed"
    }],
    status: 'completed',
}, {
    id: '5',
    role: 'assistant',
    name: 'FE',
    content: `Technical Solution Suggestions:\n\n- Technology Stack: React + Semi UI, backend using WebSocket or SSE to support streaming responses\n- Data Model: Messages include fields such as id, role, name, content, status, and references\n- Component Splitting: AIChatInput + AIChatDialogue; content rendered using Markdown, supporting image and file clicks\n- Performance: Virtual list and scroll-to-bottom; long text chunked rendering; lazy loading of images\n- Observability: Message tracking latency, error rate, and tool call time\n\nIf confirmed, I can first build the page skeleton and integrate mock data for integration testing.`,
}];

const roleConfig = {
    user: {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/img/user.png'
    },
    assistant: new Map([
        ['PM', {
            name: 'Product Manager',
            avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/PM.png'
        }],
        ['UI', {
            name: 'Designer',
            avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/22606991eh7uhfups/UI.png'
        }],
        ['FE', {
            name: 'Front-end programmer',
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
        label: "Lark Doc",
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
- **How should you choose between Chat components and AI Chat series components?**
   - If the scenario is relatively simple, requiring only plain text conversations and basic document/image displays, the Chat component is recommended.
        - [Chat](/en-US/plus/chat) component integrates input and message display by default. Its advantage is that it is easy to understand and can be quickly learned. Its disadvantage is that it is relatively difficult to customize complex input boxes or message display requirements, and the workload is large.
   - If the scenario is relatively complex, it is recommended to use the AIChatInput and AIChatDialogue components together, with the following advantages:
        - [AIChatInput](/en-US/ai/aiChatInput) supports more complex style customization
            1. Users can easily customize the [configuration area](/en-US/ai/aiChatInput#%E9%85%8D%E7%BD%AE%E5%8C%BA%E5%9F%9F) in the lower left corner and the [operation area](/en-US/ai/aiChatInput#%E6%93%8D%E4%BD%9C%E5%8C%BA%E5%9F%9F) in the lower right corner.
            2. Provides a [rich text input area](/en-US/ai/aiChatInput#%E5%AF%8C%E6%96%87%E6%9C%AC%E8%BE%93%E5%85%A5%E5%8C%BA)to display input templates;
            3. By default, it supports displaying [reference](/en-US/ai/aiChatInput#%E5%BC%95%E7%94%A8).
            4. Supports hotkey-activated [skill templates](/en-US/ai/aiChatInput#%E6%8A%80%E8%83%BD%E5%8F%8A%E6%A8%A1%E7%89%88);
            5. It supports custom [Input Extension](/en-US/ai/aiChatInput#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%89%A9%E5%B1%95) and [TopSlot](/en-US/ai/aiChatInput#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E9%A1%B6%E9%83%A8%E5%8C%BA%E5%9F%9F), making complex displays easy to achieve.
         - [AIChatDialogue](/en-US/ai/aiChatDialogue) message display is more flexible。
            1. The component supports OpenAI's [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) Object format standard by default. Calling the [internal message conversion function](/en-US/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2) can easily convert the results returned by OpenAI into the data structure required by the component.
            2. It provides an API for [customized display based on message type](/en-US/ai/aiChatDialogue#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E6%B6%88%E6%81%AF%E5%86%85%E5%AE%B9) to facilitate quick and easy message display.
            3. By default, message [reference](/en-US/ai/aiChatDialogue#%E5%BC%95%E7%94%A8) and [select](/en-US/ai/aiChatDialogue#%E9%80%89%E6%8B%A9) operations are supported.