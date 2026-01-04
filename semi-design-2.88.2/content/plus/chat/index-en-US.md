---
localeCode: en-US
order: 27
category: Plus
title:  Chat
icon: doc-chat
dir: column
brief: Used to quickly build conversation content
---

## When to use

The `Chat` component can be used in scenarios such as regular conversations or AI conversations.

The rendering of the conversation content is based on the [MarkdownRender](/en-US/plus/markdownrender) component, which supports Markdown and MDX (Note: The default format mode of MarkdownRender in Chat is md. If you need to use MDX format, you can set it through the markdownRenderProps API). It allows for common rich text features such as images, tables, links, bold text, code blocks, and more. More complex and customized document writing and display requirements can be achieved using JSX.

## Demos

### How to import

Chat is supported starting from version v2.63.0.
```jsx
import { Chat } from '@douyinfe/semi-ui';
```

### Basic usage

By setting `chats`, `onChatsChange`, and `onMessageSend`, you can achieve basic conversation display and interaction.

Conversations involve multiple participants and multiple rounds of interaction. Role information, including names and avatars, can be passed through the `roleConfig` parameter. For detailed parameter information, refer to [RoleConfig](#RoleConfig).

The prompt text of the upload button can be set through `uploadTipProps`. For details, please refer to [Tooltip](/zh-CN/tooltip#API%20%E5%8F%82%E8%80%83).

Dialogue is a scene involving multiple parties and multiple rounds of interaction. Role information (including name, avatar, etc.) can be passed in through `roleConfig`, and the specific parameter details are [RoleConfig](#roleConfig).

Use the `align` attribute to set the layout of the dialog, supporting left and right layout (`leftRight`, default) and left alignment (`leftAlign`).

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
        content: "Give an example of using Semi Design’s Button component",
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: "The following is an example of using Semi code：\n\`\`\`jsx \nimport React from 'react';\nimport { Button } from '@douyinfe/semi-ui';\n\nconst MyComponent = () => {\n  return (\n    <Button>Click me</Button>\n );\n};\nexport default MyComponent;\n\`\`\`\n",
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
const uploadTipProps = { content: 'Customize upload button prompt information' }

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
            content: "This is a mock response",
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
                    Mode
                    <RadioGroup onChange={onModeChange} value={mode} type={"button"}>
                        <Radio value={'bubble'}>bubble</Radio>
                        <Radio value={'noBubble'}>noBubble</Radio>
                        <Radio value={'userBubble'}>userBubble</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    Chat layout
                    <RadioGroup onChange={onAlignChange} value={align} type={"button"}>
                        <Radio value={'leftRight'}>leftRight</Radio>
                        <Radio value={'leftAlign'}>leftAlign</Radio>
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

### Chat status

The chats type is `Message[]`, where each `Message` contains various information about the conversation, such as role, content, attachment, status, unique identifier (id), creation time (createAt), and more. For detailed information, please refer to [Message](#message). The conversation style may vary depending on the different status values.

``` jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: "Success response",   
    },
    {
        id: 'loading',
        role: 'assistant',
        status: 'loading'
    },
    {
        role: 'assistant',
        id: 'error',
        content: 'Error response',
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
            content: "This is a mock response",
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

### Dynamic update chats

For the case of receiving Server-Sent Event data from the backend, the obtained data can be used to update the `chats`, and the conversation content will be updated in real-time.

The `showStopGenerate` parameter can be used to determine whether to display the stop generation button, with a default value of `false`. The logic for stopping the generation can be handled in the `onStopGenerator` function.

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
Semi Design is a design system designed, developed and maintained by Douyin's front-end team and MED product design team. As a comprehensive, easy-to-use, high-quality modern application UI solution, Semi Design is extracted from the complex scenarios of ByteDance's various business lines. It has currently supported nearly a thousand platform products and served more than 100,000 internal and external users.[[1]](https://semi.design/zh-CN/start/introduction)。

Semi Design features include:

1. Simple and modern design.
2. Provide theme solutions, which can be customized in depth.
3. Provide two sets of light and dark color modes, easy to switch.
4. Internationalization, covering 20+ languages ​​such as Simplified/Traditional Chinese, English, Japanese, Korean, Portuguese, etc. The date and time component provides global time zone support, and all components can automatically adapt to the Arabic RTL layout.
5. Use Foundation and Adapter cross-framework technical solutions to facilitate expansion.

---
Learn more:
1. [Introduction - Semi Design](https://semi.design/zh-CN/start/introduction)
2. [Getting Started - Semi Design](https://semi.design/zh-CN/start/getting-started)
3. [The evolution of Semi D2C design draft to code - Zhihu](https://zhuanlan.zhihu.com/p/667189184)
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

### Clear context

Displaying the clear context button in the input box can be enabled through `showClearContext`, which defaults to `false`.
The context can also be cleared by calling the `clearContext` method through ref.

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
        content: "Introduce semi design", 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: 'Semi Design is a design system designed, developed and maintained by the Douyin front-end team and MED product design team.',
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
const uploadTipProps = { content: 'Customize upload button prompt information' }

function DefaultChat() {
    const [message, setMessage] = useState(defaultMessage);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getId(),
            createAt: Date.now(),
            content: "This is a mock response message.",
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

### Custom rendering dialog box

Pass in custom rendering configuration through `chatBoxRenderConfig`, the chatBoxRenderConfig type is as follows

```ts
export interface RenderTitleProps {
    message?: Message;
    role?: Metadata;
    defaultTitle?: ReactNode
}

export interface RenderAvatarProps {
    message?: Message;  /* Supported in  2.69.0*/
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
    /* Custom rendering title */
    renderChatBoxTitle?: (props: RenderTitleProps) => ReactNode;
     /* Custom rendering avatar */
    renderChatBoxAvatar?: (props: RenderAvatarProps) => ReactNode;
    /* Custom rendering content */
    renderChatBoxContent?: (props: RenderContentProps) => ReactNode;
   /* Custom rendering content */
    renderChatBoxAction?: (props: RenderActionProps) => ReactNode;
   /* Fully customized rendering of the entire chat box */
    renderFullChatBox?: (props: RenderFullChatBoxProps) => ReactNode
}
```

Custom render avatar and Title through `renderChatBoxAvatar` and `renderChatBoxTitle`。

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
                text: 'What\'s in this picture?'
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
        content: 'The picture shows a yellow backpack decorated with cartoon images'
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
                    Avatar Render Mode
                    <RadioGroup onChange={onAvatarChange} value={avatar} type="button">
                    <Radio value={'default'}>default</Radio>
                    <Radio value={'null'}>null</Radio>
                    <Radio value={'custom'}>custom</Radio>
                </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: 10}}>
                    Title Render mode
                    <RadioGroup onChange={onTitleChange} value={title} type="button">
                    <Radio value={'default'}>default</Radio>
                    <Radio value={'null'}>null</Radio>
                    <Radio value={'custom'}>custom</Radio>
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

When hovering over a conversation, the conversation action area will be displayed. You can customize the rendering of the action area using `renderChatBoxAction`.

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
        content: "Introduce Semi design", 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: 'Semi Design is a design system designed, developed, and maintained by the front-end team at Douyin and the MED product design team.',
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
                    <Dropdown.Item icon={<IconForward />}>Share</Dropdown.Item>
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

You can customize the content of the action area using `renderChatBoxContent`.

```jsx live=true noInline=true dir="column"
import React, { useState, useCallback, useRef} from 'react';
import { Chat, MarkdownRender } from '@douyinfe/semi-ui';

const defaultMessage = [
        {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: "Semi Design is a design system designed, developed and maintained by Douyin's front-end team and MED product design team. As a comprehensive, easy-to-use, high-quality modern application UI solution, it is extracted from the complex scenarios of ByteDance's various business lines, supports nearly a thousand platform products, and serves 100,000+ internal and external users.",
        source: [
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/en-US/start/introduction',
                title: 'semi Design',
                subTitle: 'Semi design website',
                content: 'Semi Design is a design system designed, developed and maintained by Douyin\'s front-end team and MED product design team.'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/dsm/landing',
                subTitle: 'Semi DSM website',
                title: 'Semi Design System',
                content: 'From Semi Design to Any Design, quickly define your design system and apply it in design drafts and code'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/code/en-US/start/introduction',
                subTitle: 'Semi D2C website',
                title: 'Design to Code',
                content: 'Semi Design to Code, or Semi D2C for short, is a new performance improvement tool launched by the Douyin front-end Semi Design team.'
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
            <span> Got {source.length} sources </span>
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

Use `renderFullChatBox` to custom render the entire chat box

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
        content: "Introduce Semi", 
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: 'Semi Design is a design system designed, developed, and maintained by the front-end team at Douyin and the MED product design team.',
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

### Custom render InputArea

The rendering input box can be customized through `renderInputArea`, the parameters are as follows

``` ts
export interface RenderInputAreaProps {
    /* Default node */
    defaultNode?: ReactNode;
    /* If you customize the input box, you need to call it when sending a message. */
    onSend?: (content?: string, attachment?: FileItem[]) => void;
    /* If you customize the clear context button, it needs to be called when you click to clear the context */
    onClear?: (e?: any) => void;
    /* DetailProps supported since 2.69.0 */
    detailProps: {
        /* clear context button */
        clearContextNode?: ReactNode;
        /* upload button */
        uploadNOde?: ReactNode;
        /* text input area */
        inputNode?: ReactNode;
        /* send button */
        sendNode?: ReactNode;
        /* The processing function that triggers the focus of the text input box after clicking */
        onClick?: (e?: MouseEvent) => void;
    }
}
```

Example of `detailProps`

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

Other Example:

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
            <strong>Information Chart</strong>
            <Form.Input
                field="name"
                label="Name"
                style={{ width: 250 }}
                trigger='blur'
            />
            <Form.Upload
                field='file'
                label='File'
                action='https://api.semi.design/upload'
            >
                <Button icon={<IconUpload />} theme="light">
                    Upload
                </Button>
            </Form.Upload>
        </Form>
        <Button style={{ width: 'fit-content' }} onClick={onSubmit}>Submit</Button>
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

### Hint

The prompt area content can be set through `hints`. After clicking the prompt content, the prompt content will become the new user input content and trigger the `onHintClick` callback.

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: 'Semi Design is a design system designed, developed, and maintained by the front-end team at Douyin and the MED product design team.',
    }
];

const hintsExample = [
    "Tell me more",
    "What are the components of Semi Design?",
    "What are the addresses of Semi Design’s official website and github warehouse?",
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
            content: "This is a mock response",
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

### Custom render Hint

Customize the content of the prompt area through `renderHintBox`, the parameters are as follows

```ts
type renderHintBox = (props: {content: string; index: number,onHintClick: () => void}) => React.ReactNode;
```

Example:

```jsx live=true noInline=true dir="column"
import React, {useState, useCallback} from 'react';
import { Chat } from '@douyinfe/semi-ui';

const defaultMessage = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: 'Semi Design is a design system designed, developed, and maintained by the front-end team at Douyin and the MED product design team.',
    }
];

const hintsExample = [
    "Tell me more",
    "What are the components of Semi Design?",
    "What are the addresses of Semi Design’s official website and github warehouse?",
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
            content: "This is a mock reply message",
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

| PROPERTIES | INSTRUCTIONS | TYPE | DEFAULT |
|------|--------|-------|-------|
| align | Dialog layout, supports `leftRight`,`leftAlign` | string | `leftRight` |
| bottomSlot | bottom slot for chat | React.ReactNode | - |
| chatBoxRenderConfig | chatBox rendering configuration | ChatBoxRenderConfig | - |
| chats | Controlled conversation list | Message | - |
| className | Custom class name | string | - |
| customMarkDownComponents | custom markdown render, transparently passed to MarkdownRender for conversation content rendering | MDXProps\['components'\]| - |
| enableUpload | Whether to enable uploading, supported since v2.76.0, supports boolean type and object type. When the boolean type is passed in, the upload behavior of dragging, clicking the upload button, and pasting in the input box will be controlled at the same time. When the object is passed in, it can be set separately. When the object type is passed in, the unset items default to true. | boolean \| { pasteUpload: boolean, clickUpload: boolean, dragUpload: boolean } | true |
| hints | prompt information | string | - |
| hintCls | hint style | string | - |
| hintStyle | hint style | CSSProperties | - |
| inputBoxStyle | Input box style | CSSProperties | - |
| inputBoxCls | Input box className | string | - |
| sendHotKey | Keyboard shortcut for sending content, supports `enter` \| `shift+enter`. The former will send the message in the input box when you press enter alone. When the shift and enter keys are pressed at the same time, it will only wrap the line and not send it. The latter is the opposite | string | `enter` |
| markdownRenderProps | This parameter will be passed to the MarkdownRender component used for dialog rendering. For details, see [MarkdownRenderProps](/en-US/plus/markdownrender#API). The default format of markdownRender in Chat is md. If you need to use mdx format, you can set it through this parameter| MarkdownRenderProps |-|
| mode | Conversation mode, support `bubble` \| `noBubble` \| `userBubble`  | string | `bubble` |
| roleConfig | Role information configuration, see [RoleConfig](#RoleConfig) | RoleConfig | - |
| renderDivider | Custom render divider, supported since v2.67.0 | (message?: Message) => ReactNode | - |
| renderHintBox | Custom rendering prompt information | (props: {content: string; index: number,onHintClick: () => void}) => React.ReactNode| - |
| onChatsChange | Triggered when the conversation list changes | (chats: Message[]) => void | - |
| onClear | Triggered when context message is cleared | () => void | - |
| onHintClick | Triggered when the prompt message is clicked | (hint: string) => void | - |
| onInputChange | Triggered when input area information changes | (props: { value?: string, attachment?: FileItem[] }) => void; | - |
| onMessageBadFeedback | Triggered when the message is negatively fed back | (message: Message) => void | - |
| onMessageCopy | Triggered when copying a message | (message: Message) => void | - |
| onMessageDelete | Triggered when a message is deleted | (message: Message) => void | - |
| onMessageGoodFeedback | Triggered when the message is fed back positively | (message: Message) => void | - |
| onMessageReset | Triggered when message is reset | (message: Message) => void | - |
| onMessageSend | Triggered when sending a message | (content: string, attachment?: FileItem[]) => void | - |
| onStopGenerator | Fires when the stop generation button is clicked | (message: Message) => void | - |
| placeholder | Input box placeholder | string | - |
| renderInputArea | Custom rendering input box | (props: RenderInputAreaProps) => React.ReactNode | - |
| showClearContext | Whether to display the clear context button| boolean | false |
| showStopGenerate | Whether to display the stop generation button| boolean | false |
| topSlot | top slot for chat | React.ReactNode | - |
| uploadProps | Upload component properties, refer to details [Upload](/en-US/input/upload#API%20%E5%8F%82%E8%80%83) | UploadProps | - |
| uploadTipProps | Upload component prompt attribute, refer to details [Tooltip](/en-US/show/tooltip#API%20%E5%8F%82%E8%80%83) | TooltipProps | - |


#### RoleConfig

| PROPERTIES | INSTRUCTIONS | TYPE | DEFAULT |
|------|--------|-------|-------|
| user | User information | Metadata | - |
| assistant | Assistant information | Metadata | - |
| system | System information | Metadata | - |

#### Metadata

| PROPERTIES | INSTRUCTIONS | TYPE | DEFAULT |
|------|--------|-------|-------|
| name | name | string | - |
| avatar | avatar | string | - |
| color | Avatar background color, same as the color parameter of Avatar component, support `amber`、 `blue`、 `cyan`、 `green`、 `grey`、 `indigo`、 `light-blue`、 `light-green`、 `lime`、 `orange`、 `pink`、 `purple`、 `red`、 `teal`、 `violet`、 `yellow` | string | `grey` |

#### Message

| PROPERTIES | INSTRUCTIONS | TYPE | DEFAULT |
|------|--------|-------|-------|
| role | role  | string | - |
| name | name  | string | - |
| id | Uniquely identifies  | string\| number | - |
| content | all content | string| Content[] | - |
| parentId | parent Uniquely identifies | string | - |
| createAt | creation time | number | -|
| status | Information status， `loading` \| `incomplete` \| `complete` \| `error` | string | complete |


#### Content

| PROPERTIES | INSTRUCTIONS | TYPE | DEFAULT |
|------|--------|-------|-------|
| type | type,  suport `text` \| `image_url` \| `file_url`  | string | - |
| text | Content data when type is `text` | string | - |
| image_url | Content data when type is `image_url` | { url: string } | - |
| file_url | Content data when type is `file_url` | { url: string; name: string; size: string; type: string } | - |

#### Methods

| METHOD  | INSTRUCTIONS   |
|------|--------|
| resetMessage | Reset message |
| scrollToBottom(animation: boolean) | Scroll to the bottom, if animation is true, there will be animation, otherwise there will be no animation. |
| clearContext | clear context|
| sendMessage(content: string, attachment: FileItem[]) | send message with content and attachment |

## Design Token

<DesignToken/>