---
localeCode: zh-CN
order: 27
category: Plus
title:  Chat 对话
icon: doc-chat
dir: column
brief: 用于快速搭建对话内容
---

## 使用场景

Chat 组件可用于普通会话，AI 会话等场景。

对话内容渲染基于 [MarkdownRender](/zh-CN/plus/markdownrender) 组件，支持 Markdown 和 MDX (注：Chat 中的 MarkdownRender 的默认 format 模式是 md，如果需要使用 MDX 格式，可通过 markdownRenderProps API 设置)，可实现图片，表格，链接，加粗，代码区等常用富文本功能。也可通过 JSX 实现更加复杂定制化的文档撰写与展示需求。


## 代码演示

### 如何引入

Chat 从 v2.63.0 版本开始支持。

```jsx
import { Chat } from '@douyinfe/semi-ui';
```

### 基本用法

通过设置 `chats` 和 `onChatsChange`，`onMessageSend` 实现基础对话显示和交互。

附件支持通过点击上传按钮，输入框粘贴，拖拽文件至 Chat 区域上传。通过 `uploadProps` 设置上传参数，详情参考 [Upload](/zh-CN/input/upload#API%20%E5%8F%82%E8%80%83)。

上传按钮的提示文案可通过 `uploadTipProps` 设置，详情参考 [Tooltip](/zh-CN/tooltip#API%20%E5%8F%82%E8%80%83)。

对话是多方参与，多轮交互的场景。可通过 `roleConfig` 传入角色信息（包括名称，头像等），具体参数细节 [RoleConfig](#roleConfig)。

使用 `align` 属性可以设置对话的布局，支持左右分布（`leftRight`， 默认）和左对齐（`leftAlign`）。

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat, Radio } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
    {
        role: 'user',
        id: '2',
        createAt: 1715676751919,
        content: "给一个 Semi Design 的 Button 组件的使用示例",
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: "以下是一个 Semi 代码的使用示例：\n\`\`\`jsx \nimport React from 'react';\nimport { Button } from '@douyinfe/semi-ui';\n\nconst MyComponent = () => {\n  return (\n    <Button>Click me</Button>\n );\n};\nexport default MyComponent;\n\`\`\`\n",
    }
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    margin: '8px 16px',
    height: 550,
}

let id = 0;
function getId() {
    return `id-${id++}`
}

const uploadProps = { action: 'https://api.semi.design/upload' }
const uploadTipProps = { content: '自定义上传按钮提示信息' }

function DefaultChat() {
    const [message, setMessage] = useState(defaultMessage);
    const [mode, setMode] = useState('bubble');
    const [align, setAlign] = useState('leftRight');

    const onAlignChange = useCallback((e) => {
        setAlign(e.target.value);
    }, []);

    const onModeChange = useCallback((e) => {
        setMode(e.target.value);
    }, []); 

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            createAt: Date.now(),
            content: "这是一条 mock 回复信息",
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageReset = useCallback((e) => {
        setTimeout(() => {
            setMessage((message) => {
                const lastMessage = message[message.length - 1];
                const newLastMessage = {
                    ...lastMessage,
                    status: 'complete',
                    content: 'This is a mock reset message.',
                }
                return [...message.slice(0, -1), newLastMessage]
            })
        }, 200);
    })

    return (
        <>
            <span style={{ display: 'flex', flexDirection: 'column', rowGap: '8px'}}>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    模式
                    <RadioGroup onChange={onModeChange} value={mode} type={"button"}>
                        <Radio value={'bubble'}>气泡</Radio>
                        <Radio value={'noBubble'}>非气泡</Radio>
                        <Radio value={'userBubble'}>用户会话气泡</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    会话布局方式
                    <RadioGroup onChange={onAlignChange} value={align} type={"button"}>
                        <Radio value={'leftRight'}>左右分布</Radio>
                        <Radio value={'leftAlign'}>左对齐</Radio>
                    </RadioGroup>
                </span>
            </span>
            <Chat 
                key={align + mode}
                align={align}
                mode={mode}
                uploadProps={uploadProps}
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                onChatsChange={onChatsChange}
                onMessageSend={onMessageSend}
                onMessageReset={onMessageReset}
                uploadTipProps={uploadTipProps}
            />
        </>
    )
}

render(DefaultChat);
```

### 消息状态

chats 类型为 `Message[]`， `Message` 包含对话的各种信息，如角色（role）、内容（content）、附件（attachment）、状态（status）
、唯一标识（id）、创建时间（createAt）等，具体见 [Message](#Message)。其中 status 不同，会话样式不同。

``` jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: "请求成功",   
    },
    {
        id: 'loading',
        role: 'assistant',
        status: 'loading'
    },
    {
        role: 'assistant',
        id: 'error',
        content: '请求错误',
        status: 'error'
    }
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 400,
}

let id = 0;
function getId() { return `id-${id++}` }
const uploadProps = { action: 'https://api.semi.design/upload' }

function MessageStatus() {
    const [message, setMessage] = useState(defaultMessage);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            createAt: Date.now(),
            content: "这是一条 mock 回复信息",
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    return (
        <Chat 
            style={commonOuterStyle}
            chats={message}
            roleConfig={roleInfo}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            uploadProps={uploadProps}
        />
    )
}

render(MessageStatus);
```

### 动态更新数据

对于后台返回 Serve Side Event 数据情况，可将获取到的数据用于更新 `chats`，对话内容将实时更新。

`showStopGenerate` 参数可用于设置是否展示停止生成按钮，默认为 `false`。 可以在 `onStopGenerator` 中处理停止生成逻辑。

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
    {
        role: 'user',
        id: '2',
        createAt: 1715676751919,
        content: "介绍一下 Semi design"
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: `
Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统。作为一个全面、易用、优质的现代应用UI解决方案，Semi Design从字节跳动各业务线的复杂场景中提炼而来，目前已经支撑了近千个平台产品，服务了内外部超过10万用户[[1]](https://semi.design/zh-CN/start/introduction)。

Semi Design的特点包括：

1. 设计简洁、现代化。
2. 提供主题方案，可深度样式定制。
3. 提供明暗色两套模式，切换方便。
4. 国际化，覆盖了简/繁体中文、英语、日语、韩语、葡萄牙语等20+种语言，日期时间组件提供全球时区支持，全部组件可自动适配阿拉伯文RTL布局。
5. 采用 Foundation 和 Adapter 跨框架技术方案，方便扩展。

---
Learn more:
1. [Introduction 介绍 - Semi Design](https://semi.design/zh-CN/start/introduction)
2. [Getting Started 快速开始 - Semi Design](https://semi.design/zh-CN/start/getting-started)
3. [Semi D2C 设计稿转代码的演进之路 - 知乎](https://zhuanlan.zhihu.com/p/667189184)
`,
    }
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 600,
}

let id = 0;
function getId() {
    return `id-${id++}`
}
const uploadProps = { action: 'https://api.semi.design/upload' }

function DynamicUpdateChat() {
    const [message, setMessage] = useState(defaultMessage);
    const intervalId = useRef();
    const onMessageSend = useCallback((content, attachment) => {
        setMessage((message) => {
            return [
                ...message,
                {
                    role: 'assistant',
                    status: 'loading',
                    createAt: Date.now(),
                    id: getId()
                }
            ]
        }); 
        generateMockResponse(content);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const generateMockResponse = useCallback((content) => {
        const id = setInterval(() => {
            setMessage((message) => {
                const lastMessage = message[message.length - 1];
                let newMessage = {...lastMessage};
                if (lastMessage.status === 'loading') {
                    newMessage = {
                        ...newMessage,
                        content:  `mock Response for ${content} \n`,
                        status: 'incomplete'
                    }
                } else if (lastMessage.status === 'incomplete') {
                    if (lastMessage.content.length > 200) {
                        clearInterval(id);
                        intervalId.current = null
                        newMessage = {
                            ...newMessage,
                            content: `${lastMessage.content} mock stream message`,
                            status: 'complete'
                        }
                    } else {
                        newMessage = {
                            ...newMessage,
                            content: `${lastMessage.content} mock stream message`
                        }
                    }  
                }
                return [ ...message.slice(0, -1), newMessage ]
            })
        }, 400);
        intervalId.current = id;
    }, []);

    const onStopGenerator = useCallback(() => {
        if (intervalId.current) {
            clearInterval(intervalId.current);
            setMessage((message) => {
                const lastMessage = message[message.length - 1];
                if (lastMessage.status && lastMessage.status !== 'complete') {
                    const lastMessage = message[message.length - 1];
                    let newMessage = {...lastMessage};
                    newMessage.status = 'complete';
                    return [
                        ...message.slice(0, -1),
                        newMessage
                    ]
                } else {
                    return message;
                }
            })
        }
    }, [intervalId]);

    return (
        <Chat 
            chats={message}
            showStopGenerate={true}
            style={commonOuterStyle}
            onStopGenerator={onStopGenerator}
            roleConfig={roleInfo}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            uploadProps={uploadProps}
        />
    )
}

render(DynamicUpdateChat);
```

### 清除上下文

通过 `showClearContext` 可以开启在输入框中显示清除上下文按钮，默认为 `false`。
也可以通过 ref 调用 `clearContext` 方法清除上下文。

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat, Radio } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
    {
        role: 'user',
        id: '2',
        createAt: 1715676751919,
        content: "介绍一下 semi design", 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: 'Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统',
    }
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    margin: '8px 16px',
    height: 550,
}

let id = 0;
function getId() {
    return `id-${id++}`
}

const uploadProps = { action: 'https://api.semi.design/upload' }
const uploadTipProps = { content: '自定义上传按钮提示信息' }

function DefaultChat() {
    const [message, setMessage] = useState(defaultMessage);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            createAt: Date.now(),
            content: "这是一条 mock 回复信息",
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageReset = useCallback((e) => {
        setTimeout(() => {
            setMessage((message) => {
                const lastMessage = message[message.length - 1];
                const newLastMessage = {
                    ...lastMessage,
                    status: 'complete',
                    content: 'This is a mock reset message.',
                }
                return [...message.slice(0, -1), newLastMessage]
            })
        }, 200);
    })

    return (
        <>
            <Chat
                uploadProps={uploadProps}
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                onChatsChange={onChatsChange}
                onMessageSend={onMessageSend}
                onMessageReset={onMessageReset}
                uploadTipProps={uploadTipProps}
                showClearContext
            />
        </>
    )
}

render(DefaultChat);
```

### 自定义渲染会话框

通过 `chatBoxRenderConfig` 传入自定义渲染配置, chatBoxRenderConfig 类型如下

```ts
export interface RenderTitleProps {
    message?: Message;
    role?: Metadata;
    defaultTitle?: ReactNode
}

export interface RenderAvatarProps {
    message?: Message; /* Supported in  2.69.0*/
    role?: Metadata, 
    defaultAvatar?: ReactNode
}

export interface RenderContentProps {
    message?: Message;
    role?: Metadata;
    defaultContent?: ReactNode | ReactNode[]; 
    className?: string;
}

export interface DefaultActionNodeObj {
    copyNode: ReactNode;
    likeNode: ReactNode;
    dislikeNode: ReactNode;
    resetNode: ReactNode;
    deleteNode: ReactNode;
}

export interface RenderActionProps {
    message?: Message;
    defaultActions?: ReactNode | ReactNode[];
    className: string;
    defaultActionsObj?: DefaultActionNodeObj; /* Supported in  2.69.0*/
};

export interface FullChatBoxNodes {
    avatar?: ReactNode;
    title?: ReactNode; 
    content?: ReactNode; 
    action?: ReactNode
}

export interface RenderFullChatBoxProps {
    message?: Message;
    role?: Metadata;
    defaultNodes?: FullChatBoxNodes;
    className: string;
}

export interface ChatBoxRenderConfig {
    /* 自定义渲染标题 */
    renderChatBoxTitle?: (props: RenderTitleProps) => ReactNode;
    /* 自定义渲染头像 */
    renderChatBoxAvatar?: (props: RenderAvatarProps) => ReactNode;
    /* 自定义渲染内容区域 */
    renderChatBoxContent?: (props: RenderContentProps) => ReactNode;
    /* 自定义渲染消息操作栏 */
    renderChatBoxAction?: (props: RenderActionProps) => ReactNode;
    /* 完全自定义渲染整个聊天框 */
    renderFullChatBox?: (props: RenderFullChatBoxProps) => ReactNode
}
```

自定义渲染头像和标题，可通过 `renderChatBoxAvatar` 和 `renderChatBoxTitle` 实现。

```jsx live=true noInline=true dir="column"

import React, {useState, useCallback} from 'react';
import { Chat, Avatar, Tag } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
    {
        role: 'user',
        id: '2',
        createAt: 1715676751919,
        content: [
            {
                type: 'text',
                text: '这张图片里有什么？'
            },
            {
                type: 'image_url',
                image_url: {
                    url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg'
                }
            }
        ], 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: '图片中是一个有卡通画像装饰的黄色背包。'
    },

];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 400,
}

let id = 0;
function getId() { return `id-${id++}`; }
const uploadProps = { action: 'https://api.semi.design/upload' }

function CustomRender() {
    const [title, setTitle] = useState('null');
    const [avatar, setAvatar] = useState('null');
    const [message, setMessage] = useState(defaultMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const customRenderAvatar = useMemo(()=> {
        switch(avatar) {
            case 'custom': return (props) => {
                    const { role, defaultAvatar } = props;
                    return <Avatar size="extra-small" shape="square" style={{ flexShrink: '0'}}>{role.name}</Avatar >
                }
            case 'null': return () => null
            case 'default': return undefined;
        }
    }, [avatar]);

    const customRenderTitle = useMemo(()=> {
        switch(title) {
            case 'custom': return (props) => {
                    const { role, defaultTitle, message } = props;
                    const date = new Date(message.createAt);
                    const hours = ('0' + date.getHours()).slice(-2);
                    const minutes = ('0' + date.getMinutes()).slice(-2);
                    const formatTime = `${hours}:${minutes}`;
                    return (<span className="title" >
                        {role.name}
                        <span className={'time'}>{formatTime}</span>
                    </span>)
            }
            case 'null': return () => null
            case 'default': return undefined;
        }
    }, [title]);;

    const onAvatarChange = useCallback((e) => { setAvatar(e.target.value) }, []);
    const onTitleChange = useCallback((e) => { setTitle(e.target.value) }, []);

     const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            content: `This is a mock response`
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    return (
        <>
            <span style={{ display: 'flex', flexDirection: 'column', rowGap: 8, marginBottom: 5}}>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: 10}}>
                    头像渲染模式
                    <RadioGroup onChange={onAvatarChange} value={avatar} type="button">
                    <Radio value={'default'}>默认头像</Radio>
                    <Radio value={'null'}>无头像</Radio>
                    <Radio value={'custom'}>自定义头像</Radio>
                </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: 10}}>
                    标题渲染模式
                    <RadioGroup onChange={onTitleChange} value={title} type="button">
                    <Radio value={'default'}>默认标题</Radio>
                    <Radio value={'null'}>无标题</Radio>
                    <Radio value={'custom'}>自定义标题</Radio>
                </RadioGroup>
                </span>
            </span>
            <Chat
                chatBoxRenderConfig={{
                    renderChatBoxTitle: customRenderTitle,
                    renderChatBoxAvatar: customRenderAvatar
                }} 
                key={`${avatar}${title}`}
                style={commonOuterStyle}
                className={'component-chat-demo-custom-render'}
                chats={message}
                onChatsChange={onChatsChange}
                onMessageSend={onMessageSend}
                roleConfig={roleInfo}
                uploadProps={uploadProps}
            />
        </>
    );
}

render(CustomRender);
```

鼠标移动到会话上，即可显示会话操作区，通过 `renderChatBoxAction` 自定义渲染操作区

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat, Dropdown } from '@douyinfe/semi-ui';
import { IconForward } from '@douyinfe/semi-icons';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
    {
        role: 'user',
        id: '2',
        createAt: 1715676751919,
        content: "介绍一下 semi design", 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: 'Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统',
    }
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 400,
}

let id = 0;
function getId() { return `id-${id++}`; }
const uploadProps = { action: 'https://api.semi.design/upload' }

const CustomActions = React.memo((props) => {
    const { role, message, defaultActions, className } = props;
    const myRef = useRef();
    const getContainer = useCallback(() => {
        if (myRef.current) {
            const element = myRef.current;
            let parentElement = element.parentElement;
            while (parentElement) {
                if (parentElement.classList.contains('semi-chat-chatBox-wrap')) {
                    return parentElement;
                }
                parentElement = parentElement.parentElement;
            }
        }
    }, [myRef]);

    return <span 
        className={className}
        ref={myRef}
    >
        {defaultActions}
        {<Dropdown
            key="dropdown"
            render={
                <Dropdown.Menu >
                    <Dropdown.Item icon={<IconForward />}>分享</Dropdown.Item>
                </Dropdown.Menu>
            }
            trigger="click"
            position="top"
            getPopupContainer={getContainer}
        >
            <Button 
                className='semi-chat-chatBox-action-btn'
                icon={<IconMoreStroked/>}
                theme='borderless'
                type='tertiary'
            />
        </Dropdown>}
    </span>
});

function CustomRender() {
    const [message, setMessage] = useState(defaultMessage);

    const customRenderAction = useCallback((props) => {
        return <CustomActions {...props} />
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            content: `This is a mock response`
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    return (
        <Chat
            chatBoxRenderConfig={{ 
                renderChatBoxAction: customRenderAction 
            }}
            style={commonOuterStyle}
            chats={message}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            roleConfig={roleInfo}
            uploadProps={uploadProps}
        />
    );
}

render(CustomRender);
```

通过 `renderChatBoxContent` 自定义操作区域

```jsx live=true noInline=true dir="column"
import React, { useState, useCallback, useRef} from 'react';
import { Chat, MarkdownRender } from '@douyinfe/semi-ui';

const defaultMessage = [
        {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: "Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。它作为全面、易用、优质的现代应用 UI 解决方案，从字节跳动各业务线的复杂场景提炼而来，支撑近千计平台产品，服务内外部 10 万+ 用户。",
        source: [
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/zh-CN/start/introduction',
                title: 'semi Design',
                subTitle: 'Semi design website',
                content: 'Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/dsm/landing',
                subTitle: 'Semi DSM website',
                title: 'Semi 设计系统',
                content: '从 Semi Design，到 Any Design 快速定义你的设计系统，并应用在设计稿和代码中'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/code/zh-CN/start/introduction',
                subTitle: 'Semi D2C website',
                title: '设计稿转代码',
                content: 'Semi 设计稿转代码（Semi Design to Code，或简称 Semi D2C），是由抖音前端 Semi Design 团队推出的全新的提效工具'
            },
        ]
    }];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 500,
}

let id = 0;
function getId() { return `id-${id++}` }
const uploadProps = { action: 'https://api.semi.design/upload' }

const SourceCard = (props) => {
    const [open, setOpen] = useState(true);
    const [show, setShow] = useState(false);
    const { source } = props;
    const spanRef = useRef();
    const onOpen = useCallback(() => {
        setOpen(false);
        setShow(true);
    }, []);

    const onClose = useCallback(() => {
        setOpen(true);
        setTimeout(() => {
            setShow(false);
        }, 350)
    }, []);

    return (<div style={{ 
            transition: open ? 'height 0.4s ease, width 0.4s ease': 'height 0.4s ease',
            height: open ? '30px' : '200px',
            width: open ? '190px': '100%', 
            background: 'var(--semi-color-tertiary-light-hover)', 
            borderRadius: 16,
            boxSizing: 'border-box',
            marginBottom: 10,
        }}
        >
        <span
            ref={spanRef} 
            style={{
                display: !open ? 'none' : 'flex',
                width: 'fit-content',
                columnGap: 10,
                background: 'var(--semi-color-tertiary-light-hover)', 
                borderRadius: '16px',
                padding: '5px 10px',
                point: 'cursor',
                fontSize: 14,
                color: 'var(--semi-color-text-1)',
            }}
            onClick={onOpen} 
        >
            <span>基于{source.length}个搜索来源</span>
            <AvatarGroup size="extra-extra-small" >
                {source.map((s, index) => (<Avatar key={index} src={s.avatar}></Avatar>))}        
            </AvatarGroup>
        </span>
        <span 
            style={{
                height: '100%',
                boxSizing: 'border-box',
                display: !open ? 'flex' : 'none',
                flexDirection: 'column',
                background: 'var(--semi-color-tertiary-light-hover)', borderRadius: '16px', padding: 12, boxSize: 'border-box'
            }}
            onClick={onClose}
            >
            <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 10px', columnGap: 10, color: 'var(--semi-color-text-1)'
            }}>
                <span style={{fontSize: 14, fontWeight: 500}}>Source</span>
                <IconChevronUp />
            </span>
            <span style={{display: 'flex', flexWrap: 'wrap', gap: 10,  overflow: 'scroll', padding: '5px 10px'}}>
                {source.map(s => (
                    <span style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        rowGap: 5, 
                        flexBasis: 150, 
                        flexGrow: 1,
                        border: "1px solid var(--semi-color-border)",
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 12
                    }}>
                        <span style={{display: 'flex', columnGap: 5, alignItems: 'center', }}>
                            <Avatar style={{width: 16, height: 16, flexShrink: 0 }} shape="square" src={s.avatar} />
                            <span style={{ color: 'var(--semi-color-text-2)', textOverflow: 'ellipsis'}}>{s.title}</span>
                        </span>
                        <span style={{
                            color: 'var(--semi-color-primary)',
                            fontSize: 12,
                        }}
                        >{s.subTitle}</span>
                        <span style={{
                            display: '-webkit-box',
                            "-webkit-box-orient": 'vertical',
                            WebkitLineClamp: '3', 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden',
                            color: 'var(--semi-color-text-2)',
                        }}>{s.content}</span>
                    </span>))}
                </span>
            </span>
        </div>
    )
}

function CustomRender() {
    const [message, setMessage] = useState(defaultMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

     const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            content: `This is a mock response`
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    const renderContent = useCallback((props) => {
        const { role, message, defaultNode, className } = props;
        return <div className={className}>
            {message.source && <SourceCard source={message.source} />}
            <MarkdownRender raw={message.content}/>
        </div>
    }, []);

    return (
        <Chat
            style={commonOuterStyle}
            chats={message}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{ renderChatBoxContent: renderContent }}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            uploadProps={uploadProps}
        />
    );
}

render(CustomRender);
```

使用 `renderFullChatBox` 自定义渲染整个会话框

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat, Avatar } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
    {
        role: 'user',
        id: '2',
        createAt: 1715676751919,
        content: "介绍一下 semi design", 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: 'Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统',
    }
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 400,
}

let id = 0;
function getId() { return `id-${id++}`; }
const uploadProps = { action: 'https://api.semi.design/upload' }

const titleStyle = { display:' flex', alignItems: 'center', justifyContent: 'center', columnGap: '10px', padding: '5px 0px', width: 'fit-content' };

function CustomFullRender() {
    const [message, setMessage] = useState(defaultMessage);

    const customRenderChatBox = useCallback((props) => {
        const { role, message, defaultNodes, className } = props;
        let titleNode = null;
        if (message.role !== 'user') {
            titleNode = (<span style={titleStyle}>
                <Avatar size="extra-small" shape="square" src={role.avatar} />
                {defaultNodes.title}
            </span>)
        }
        return <div className={className}>
            <div style={{ display: 'flex', flexDirection: 'column', rowGap: 4, alignItems: message.role === 'user' ? 'end' : ''}}>
                {titleNode}
                <div style={{ width: 'fit-content'}}>
                    {defaultNodes.content}
                </div>
                {defaultNodes.action}
            </div>
        </div>
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats)
    } ,[]);

     const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            content: `This is a mock response`
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);
    
    return ( <Chat
        chatBoxRenderConfig={{ renderFullChatBox: customRenderChatBox }}
        style={commonOuterStyle} 
        chats={message}
        onChatsChange={onChatsChange}
        onMessageSend={onMessageSend}
        roleConfig={roleInfo}
        uploadProps={uploadProps}
    />);
}

render(CustomFullRender)
```

### 自定义渲染输入框

可通过 `renderInputArea` 自定义渲染输入框，参数如下

``` ts
export interface RenderInputAreaProps {
    /* 默认节点 */
    defaultNode?: ReactNode;
    /* 如果自定义输入框，发送消息时需调用 */
    onSend?: (content?: string, attachment?: FileItem[]) => void;
    /* 如果自定义清除上下文按钮，点击清除上下文时需调用 */
    onClear?: (e?: any) => void;
    /* detailProps 自 2.69.0 版本开始支持 */
    detailProps: {
        /* 清除上下文按钮 */
        clearContextNode?: ReactNode;
        /* 上传按钮 */
        uploadNOde?: ReactNode;
        /* 文本输入框 */
        inputNode?: ReactNode;
        /* 发送按钮 */
        sendNode?: ReactNode;
        /* 点击触发聚焦文本输入框的处理函数*/
        onClick?: (e?: MouseEvent) => void;
    }
}
```

`detailProps` 的使用示例如下

```jsx
function CustomInputRender(props) {
     const { detailProps } = props;
    const { clearContextNode, uploadNode, inputNode, sendNode, onClick } = detailProps;
   
    return <div style={{margin: '8px 16px', display: 'flex', flexDirection:'row',
      alignItems: 'flex-end', borderRadius: 16,padding: 10, border: '1px solid var(--semi-color-border)'}}
      onClick={onClick} 
    >
        {uploadNode}
        {inputNode}
        {sendNode}
    </div>
}
```

其他使用示例如下

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Form, Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'system',
        id: '1',
        createAt: 1715676751919,
        content: "Hello, I'm your AI assistant.",   
    },
];

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 500,
};

let id = 0;
function getId() {
    return `id-${id++}`
}
const uploadProps = { action: 'https://api.semi.design/upload' }

const inputStyle = {   
    display: 'flex', 
    flexDirection: 'column', 
    border: '1px solid var(--semi-color-border)',
    margin: '8px 16px',
    borderRadius: 8,
    padding: 8
}

function CustomInputRender(props) {
    const { defaultNode, onClear, onSend } = props;
    const api = useRef();
    const onSubmit = useCallback(() => {
        if (api.current) {
            const values = api.current.getValues();
            if ((values.name && values.name.length !== 0) || (values.file && values.file.length !== 0)) {
                onSend(values.name, values.file);
                api.current.reset();
            } 
        }
    }, []);

    return (<div style={inputStyle}>
        <Form
            getFormApi={formApi => api.current = formApi}
        >
            <strong>输入信息</strong>
            <Form.Input
                field="name"
                label="名称（Input）"
                style={{ width: 250 }}
                trigger='blur'
            />
            <Form.Upload
                field='file'
                label='文档'
                action='https://api.semi.design/upload'
            >
                <Button icon={<IconUpload />} theme="light">
                    点击上传
                </Button>
            </Form.Upload>
        </Form>
        <Button style={{ width: 'fit-content' }} onClick={onSubmit}>提交</Button>
    </div>);
}

function CustomRenderInputArea() {
    const [message, setMessage] = useState(defaultMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            content: `This is a mock response`
        } 
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    const renderInputArea = useCallback((props) => {
        return (<CustomInputRender {...props} />)
    }, []);    

    return (
        <Chat
            renderInputArea={renderInputArea}
            style={commonOuterStyle}
            chats={message}
            roleConfig={roleInfo}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            uploadProps={uploadProps}
        />
    )
}
render(CustomRenderInputArea);
```

### 提示信息

通过 `hints` 可设置提示区域内容, 点击提示内容后，提示内容将成为新的用户输入内容，并触发 `onHintClick` 回调。

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: 'Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统，你可以向我提问任何关于 Semi 的问题。',
    }
];

const hintsExample = [
    "告诉我更多",
    "Semi Design 的组件有哪些？",
    "我能够通过 DSM 定制自己的主题吗？",
]

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 400,
};

let id = 0;
function getId() {
    return `id-${id++}`
}
const uploadProps = { action: 'https://api.semi.design/upload' }

function DefaultChat() {
    const [message, setMessage] = useState(defaultMessage);
    const [hints, setHints] = useState(hintsExample);

    const onHintClick = useCallback(() => {
        setHints([]);
    }, [])

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            createAt: Date.now(),
            content: "这是一条 mock 回复信息",
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    onClear = useCallback(() => {
        setHints([]);
    }, [])

    return (
        <Chat 
            hints={hints}
            onHintClick={onHintClick}
            style={commonOuterStyle}
            chats={message}
            roleConfig={roleInfo}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            onClear={onClear}
            uploadProps={uploadProps}
        />
    )
}

render(DefaultChat);
```

### 自定义提示信息渲染

通过 `renderHintBox` 自定义提示区域内容， 参数如下

```ts
type renderHintBox = (props: {content: string; index: number,onHintClick: () => void}) => React.ReactNode;
```

使用示例如下：

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: 'Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统，你可以向我提问任何关于 Semi 的问题。',
    }
];

const hintsExample = [
    "告诉我更多",
    "Semi Design 的组件有哪些？",
    "我能够通过 DSM 定制自己的主题吗？",
]

const roleInfo = {
    user:  {
        name: 'User',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
    },
    assistant: {
        name: 'Assistant',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    },
    system: {
        name: 'System',
        avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
    }
}

const commonOuterStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: '16px',
    height: 400,
};

let id = 0;
function getId() {
    return `id-${id++}`
}
const uploadProps = { action: 'https://api.semi.design/upload' }

function DefaultChat() {
    const [message, setMessage] = useState(defaultMessage);
    const [hints, setHints] = useState(hintsExample);

    const onHintClick = useCallback(() => {
        setHints([]);
    }, [])

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            createAt: Date.now(),
            content: "这是一条 mock 回复信息",
        }
        setTimeout(() => { 
            setMessage((message) => ([ ...message, newAssistantMessage])); 
        }, 200);
        setHints([]);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const commonHintStyle = useMemo(() => ({
        border: '1px solid var(--semi-color-border)',
        padding: '10px',
        borderRadius: '10px',
        color: 'var( --semi-color-text-1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: '14px'
    }), []);
    
    const renderHintBox = useCallback((props) => {
        const { content, onHintClick, index } = props;
        return <div style={commonHintStyle} onClick={onHintClick} key={index}>
            {content}
            <IconArrowRight style={{ marginLeft: 10 }}>click me</IconArrowRight>
        </div>
    }, []);

    onClear = useCallback(() => {
        setHints([]);
    }, [])

    return (
        <Chat 
            renderHintBox={renderHintBox}
            hints={hints}
            onHintClick={onHintClick}
            style={commonOuterStyle}
            chats={message}
            roleConfig={roleInfo}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            onClear={onClear}
            uploadProps={uploadProps}
        />
    )
}

render(DefaultChat);
```

### API

| 属性  | 说明   | 类型   | 默认值 |
|------|--------|-------|-------|
| align | 对话布局方式，支持 `leftRight`、`leftAlign` | string | `leftRight` |
| bottomSlot | 底部插槽 | React.ReactNode | - |
| chatBoxRenderConfig | chatBox 渲染配置 | ChatBoxRenderConfig | - |
| chats | 受控对话列表 | Message | - |
| className | 自定义类名 | string | - |
| customMarkDownComponents | 自定义 markdown render， 透传给对话内容渲染的 MarkdownRender | MDXProps\['components'\]| - |
| enableUpload | 是否启用上传, 自 v2.76.0 支持，支持 boolean 类型及对象类型，传入 boolean 类型将同时控制拖拽，点击上传按钮，在输入框中粘贴的上传行为，传入对象可分别设置，传入对象类型时未设置的项默认为 true | boolean \| { pasteUpload: boolean, clickUpload: boolean, dragUpload: boolean } | true |
| hints | 提示信息 | string | - |
| hintCls | 提示区最外层样式类名 | string | - |
| hintStyle | 提示区最外层样式 | CSSProperties | - |
| inputBoxStyle | 输入框样式 | CSSProperties | - |
| inputBoxCls | 输入框类名 | string | - |
| sendHotKey | 发送输入内容的键盘快捷键，支持 `enter` \| `shift+enter`。前者在单独按下 enter 将发送输入框中的消息， shift 和 enter 按键同时按下时，仅换行，不发送。后者相反 | string | `enter` |
| markdownRenderProps | 该参数将透传给对话框渲染所用的 MarkdownRender 组件，详见 [MarkdownRenderProps](/zh-CN/plus/markdownrender#API)，Chat 中的 markdownRender 默认 format 为 md ，如果需要使用 mdx 格式，可通过此参数设置 | MarkdownRenderProps |-|
| mode | 对话模式，支持 `bubble` \| `noBubble` \| `userBubble`  | string | `bubble` |
| roleConfig | 角色信息配置，具体见 [RoleConfig](#RoleConfig) | RoleConfig | - |
| renderDivider | 自定义渲染分割线, 自 v2.67.0 支持 | (message?: Message) => ReactNode | - |
| renderHintBox | 自定义渲染提示信息 | (props: {content: string; index: number,onHintClick: () => void}) => React.ReactNode| - |
| onChatsChange | 对话列表变化时触发 | (chats: Message[]) => void | - |
| onClear | 清除上下文消息时候触发 | () => void | - |
| onHintClick | 点击提示信息时触发 | (hint: string) => void | - |
| onInputChange | 输入区域信息变化时触发 | (props: { value?: string, attachment?: FileItem[] }) => void; | - |
| onMessageBadFeedback | 消息负向反馈时触发 | (message: Message) => void | - |
| onMessageCopy | 复制消息时触发 | (message: Message) => void | - |
| onMessageDelete | 删除消息时触发 | (message: Message) => void | - |
| onMessageGoodFeedback | 消息正向反馈时触发 | (message: Message) => void | - |
| onMessageReset | 重置消息时触发 | (message: Message) => void | - |
| onMessageSend | 发送消息时触发 | (content: string, attachment?: FileItem[]) => void | - |
| onStopGenerator | 点击停止生成按钮时触发 | (message: Message) => void | - |
| placeholder | 输入框占位符 | string | - |
| renderInputArea | 自定义渲染输入框 | (props: RenderInputAreaProps) => React.ReactNode | - |
| showClearContext | 是否展示清除上下文按钮| boolean | false |
| showStopGenerate | 是否展示停止生成按钮| boolean | false |
| topSlot | 顶部插槽 | React.ReactNode | - |
| uploadProps | 上传组件属性, 详情参考 [Upload](/zh-CN/input/upload#API%20%E5%8F%82%E8%80%83) | UploadProps | - |
| uploadTipProps | 上传组件提示属性, 详情参考 [Tooltip](/zh-CN/show/tooltip#API%20%E5%8F%82%E8%80%83) | TooltipProps | - |


#### RoleConfig

| 属性  | 说明   | 类型   | 默认值 |
|------|--------|-------|-------|
| user | 用户信息 | Metadata | - |
| assistant | 助手信息 | Metadata | - |
| system | 系统信息 | Metadata | - |

#### Metadata

| 属性  | 说明   | 类型   | 默认值 |
|------|--------|-------|-------|
| name | 名称 | string | - |
| avatar | 头像 | string | - |
| color | 头像背景色，同 Avatar 组件的 color 参数, 支持 `amber`、 `blue`、 `cyan`、 `green`、 `grey`、 `indigo`、 `light-blue`、 `light-green`、 `lime`、 `orange`、 `pink`、 `purple`、 `red`、 `teal`、 `violet`、 `yellow` | string | `grey` |

#### Message

| 属性  | 说明   | 类型   | 默认值 |
|------|--------|-------|-------|
| role | 角色  | string | - |
| name | 名称  | string | - |
| id | 唯一标识  | string\| number | - |
| content | 文本内容 | string| Content[] | - |
| parentId | 父节点id | string | - |
| createAt | 创建时间 | number | -|
| status | 消息状态，可选值为 `loading` \| `incomplete` \| `complete` \| `error` | string | complete |


#### Content

| 属性  | 说明   | 类型   | 默认值 |
|------|--------|-------|-------|
| type | 类型, 可选值`text` \| `image_url` \| `file_url`  | string | - |
| text | 当类型为 `text` 时的内容数据 | string | - |
| image_url | 当类型为 `image_url` 时的内容数据 | { url: string } | - |
| file_url | 当类型为 `file_url` 时的内容数据 | { url: string; name: string; size: string; type: string } | - |

#### Methods

| 方法  | 说明   |
|------|--------|
| resetMessage | 重置消息 |
| scrollToBottom(animation: boolean) | 滚动到最底部, animation 为 true，则有动画，反之无动画 |
| clearContext | 清除上下文|
| sendMessage(content: string, attachment: FileItem[]) |发送消息 |

## 设计变量

<DesignToken/>

