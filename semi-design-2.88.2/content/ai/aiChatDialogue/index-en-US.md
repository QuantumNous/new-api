---
localeCode: en-US
order: 101
category: Plus
title: AIChatDialogue
icon: doc-aiDialogue
width: 60%
brief: Display AI chat conversation messages to users
showNew: true
---

## When to use
AIChatDialogue can be used together with AIChatInput to build richer, more comprehensive and easier-to-customize AI conversation experiences.
The component message format is based on OpenAI's [Response Object](https://platform.openai.com/docs/api-reference/responses/object), and supports the OpenAI community's [Response](https://platform.openai.com/docs/api-reference/responses/create) / [Chat Completion](https://platform.openai.com/docs/api-reference/chat/create) format standards by default. Responses to GPT-5 and GPT-4o series models are supported out of the box. For details, see [Message Data Conversion](/zh-CN/ai/aiChatDialogue#%E6%B6%88%E6%81%AF%E6%95%B0%E6%8D%AE%E8%BD%AC%E6%8D%A2).

## Demos

### How to import

```jsx import
import { AIChatDialogue } from '@douyinfe/semi-ui';
```

### Basic Usage
Set `chats` and `onChatsChange` to enable basic conversation display and interactions.

Use `align` to control layout: `leftRight` (default) and `leftAlign`.

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue, RadioGroup, Radio } from '@douyinfe/semi-ui';

const defaultMessages = [
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
        content: "Give an example of using the Semi Design Button component",
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: "Here is a sample usage of a Semi component:\n```jsx \nimport React from 'react';\nimport { Button } from '@douyinfe/semi-ui';\n\nconst MyComponent = () => {\n  return (\n    <Button>Click me</Button>\n );\n};\nexport default MyComponent;\n```\n",
    }
];

const roleConfig = {
    user: {
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
};

function AlignAndMode () {
    const [messages, setMessage] = useState(defaultMessages);
    const [mode, setMode] = useState('bubble');
    const [align, setAlign] = useState('leftRight');

    const onAlignChange = useCallback((e) => {
        setAlign(e.target.value);
    }, []);

    const onModeChange = useCallback((e) => {
        setMode(e.target.value);
    }, []); 

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    return (
        <>
            <span style={{ display: 'flex', flexDirection: 'column', rowGap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px' }}>
                    Mode
                    <RadioGroup onChange={onModeChange} value={mode} type={"button"}>
                        <Radio value={'bubble'}>Bubble</Radio>
                        <Radio value={'noBubble'}>No bubble</Radio>
                        <Radio value={'userBubble'}>User bubble</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px' }}>
                    Conversation layout
                    <RadioGroup onChange={onAlignChange} value={align} type={"button"}>
                        <Radio value={'leftRight'}>LeftRight</Radio>
                        <Radio value={'leftAlign'}>LeftAlign</Radio>
                    </RadioGroup>
                </span>
            </span>
            <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 12, marginTop: 10, padding: 20 }}>
                <AIChatDialogue 
                    key={align + mode}
                    align={align}
                    mode={mode}
                    chats={messages}
                    roleConfig={roleConfig}
                    onChatsChange={onChatsChange}
                />
            </div>
        </>
    );
}

render(AlignAndMode);

```

### Message Status
`chats` is of type `Message[]`. Each `Message` contains various fields such as role `role`, content `content`, status `status`, unique identifier `id`, and creation time `createdAt`. See [Message](#Message) for details. The `status` follows the same values as the [Response API Status](https://platform.openai.com/docs/api-reference/responses/object#responses/object-status): 6 status values mapping to 3 official styles (success / in progress / failed).

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

const defaultMessages = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: "Success", 
        // default status is completed
    },
    {
        id: 'loading',
        role: 'assistant',
        status: 'in_progress' // Same visual as queued, incomplete
    },
    {
        role: 'assistant',
        id: 'error',
        content: 'Error',
        status: 'failed' // Same visual as cancelled
    }
];

const roleConfig = {
    user: {
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
};

function StatusDemo () {
    const [messages, setMessage] = useState(defaultMessages);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    return (
        <AIChatDialogue 
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
        />
    );
}

render(StatusDemo);

```

### Message Display
The message content uses [ContentItem[]](https://platform.openai.com/docs/api-reference/responses/list#responses/list-data). It supports blocks such as text, file, image, code, reasoning, annotation, and tool call. `AIChatDialogue.Step` is provided for step-by-step displays (e.g., workflows or plans).

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';
import { IconSearchStroked, IconCodeStroked, IconBriefStroked } from '@douyinfe/semi-icons';


const defaultMessages = [
    {
        role: 'assistant',
        id: '1',
        createAt: 1715676751919,
        content: 'Plain text', 
    },
    {
        id: '2',
        role: 'user',
        content: [
            {
                type: 'message',
                content: [
                    {
                        type: 'input_text',
                        text: 'Help me generate a similar image',
                    },
                    {
                        type: 'input_image',
                        image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
                        file_id: 'demo-file-id'
                    },
                    {
                        type: 'input_text',
                        text: 'Files preview below',
                    },
                    {
                        type: 'input_file',
                        file_url: 'https://www.semi.pdf',
                        filename: 'semi.pdf',
                        size: '100KB',
                    },
                    {
                        type: 'input_file',
                        file_url: 'https://www.semi.json',
                        filename: 'semi.json',
                        size: '100KB',
                    },
                    {
                        type: 'input_file',
                        file_url: 'https://www.semi.docx',
                        filename: 'semi.docx',
                        size: '100KB',
                    }
                ],
            },
        ],
        status: 'completed',
    },
    {
        id: '3',
        role: 'assistant',
        content: [
            {
                type: 'reasoning',
                status: 'completed',
                summary: [
                    {
                        'type': 'summary_text',
                        'text': '\nI need to reason and answer the user about what the Semi component library is...'
                    }
                ],
            },
            {
                type: 'message',
                content: [
                    {
                        type: 'output_text',
                        text: 'Semi Design is a design system built and maintained by ByteDance Frontend Team and the MED Product Design Team.'
                    }
                ],
                status: 'completed',
            },
            {
                id: 'fc_12345xyz',
                call_id: 'call_12345xyz',
                type: 'function_call',
                name: 'get_weather',
                status: 'completed',
                arguments: '{\'location\':\'Paris, France\'}'
            },
            {
                type: 'message',
                content: [
                    {
                        type: 'output_text',
                        text: 'Congrats! You now know everything about Semi Design!',
                        annotations: [
                            {
                                title: 'semi.design',
                                url: 'https://semi.design/',
                                detail: 'semi design page',
                                logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
                            },
                            {
                                title: 'semi.design',
                                url: 'https://semi.design/',
                                detail: 'semi design page',
                                logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
                            },
                        ]
                    }
                ]
            },
            {
                type: 'plan',
                content: [
                    {
                        summary: 'Create a comprehensive Beijing travel guide covering attractions, lodging, transport, food, and tips',
                        steps: [
                            {
                                summary: 'Search introductions and ticket info for Beijing attractions',
                                description: 'Searching: Beijing attraction introductions and ticket info',
                                type: 'search',
                            }, 
                            {
                                summary: 'Read specific lines of a given file',
                                description: 'Creating document: Beijing Travel Guide',
                                type: 'docs',
                            }, 
                            {
                                summary: 'Create a file containing the Beijing travel guide',
                                description: 'Creating code file: beijing_travel_guide.html',
                                type: 'code',
                            }, 
                        ],
                        statues: 'completed'
                    },
                    {
                        summary: 'Summarize the created Beijing travel guide and present to the user',
                        steps: []
                    }
                ],
            }
        ],
        status: 'completed',
    },
];

const roleConfig = {
    user: {
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
};

function AllTypeMessageDemo () {
    const [messages, setMessage] = useState(defaultMessages);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const mapStep = useCallback((steps) => {
        if (!steps) {
            return [];
        }
        return steps.map((item) => {
            let icon = null;
            switch (item.type) {
                case 'search':
                    icon = <IconSearchStroked />;
                    break;
                case 'docs':
                    icon = <IconBriefStroked />;
                    break;
                case 'code':
                    icon = <IconCodeStroked />;
                    break;
            }
            return {
                summary: item.summary,
                description: item.description,
                icon: icon,
            };
        });
    }, []);

    const customRender = useCallback((message) => {
        return {
            'plan': (item) => { // 'plan' is a custom user-defined type
                let steps = item.content.map((item) => {
                    return {
                        summary: item.summary,
                        actions: mapStep(item.steps),
                        status: 'completed'
                    };
                });
                return <AIChatDialogue.Step steps={steps} />;
            },
        };
    }, []);

    return (
        <AIChatDialogue 
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            renderDialogueContentItem={customRender}
        />
    );
}

render(AllTypeMessageDemo);

```


### References
Use `references` to define files or text cited by the current message. `showReference` controls whether a quotable style is shown for the current message. `onReferenceClick` configures the click handler for the reference button.

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

const defaultMessages = [
    {
        id: '1',
        role: 'user',
        content: 'This message is an example for the References demo',
        references: [
            {
                id: '1',
                type: 'text',
                content: 'Sample text. This is a long paragraph of text repeated for demonstration purposes to show truncation and layout behavior in the reference area.',
            },
            {
                id: '2',
                name: 'Feishu Doc.docx',
            },
            {
                id: '3',
                name: 'Music.mp4',
            },
            {
                id: '4',
                name: 'Image.jpeg',
                url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png'
            },
            {
                id: '5',
                name: 'code.json',
            }
        ]
    }
];

const roleConfig = {
    user: {
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
};

function ReferencesDemo () {
    const [messages, setMessage] = useState(defaultMessages);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onReferenceClick = () => {
        console.log('You click the reference button!');
    };

    return (
        <AIChatDialogue 
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            showReference
            onReferenceClick={onReferenceClick}
        />
    );
}

render(ReferencesDemo);
```


### Selection
```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue, RadioGroup, Radio } from '@douyinfe/semi-ui';

const defaultMessages = [
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
        content: "Give an example of using the Semi Design Button component",
    },
    {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: "Here is a sample usage of a Semi component:\n```jsx \nimport React from 'react';\nimport { Button } from '@douyinfe/semi-ui';\n\nconst MyComponent = () => {\n  return (\n    <Button>Click me</Button>\n );\n};\nexport default MyComponent;\n```\n",
    }
];

const roleConfig = {
    user: {
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
};

function SelectingDemo () {
    const ref = useRef(null);
    const [messages, setMessage] = useState(defaultMessages);
    const [align, setAlign] = useState('leftRight');
    const [select, setSelect] = useState(true);
    const [selection, setSelection] = useState('allSelect');

    useEffect(() => {
        ref.current.selectAll();
    }, []);

    const onSelectChange = useCallback((e) => {
        setSelect(e.target.value);
    }, []);

    const onSelectionChange = useCallback((e) => {
        if (e.target.value === 'allSelect') {
            ref.current.selectAll();
        } else {
            ref.current.deselectAll();
        }
        setSelection(e.target.value);
    }, []);

    const onSelect = useCallback((selectionId) => {
        console.log('onSelect', selectionId);
    }, []);

    const onAlignChange = useCallback((e) => {
        setAlign(e.target.value);
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    return (
        <div>
            <span style={{ display: 'flex', flexDirection: 'column', rowGap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px' }}>
                    Session Layout
                    <RadioGroup onChange={onAlignChange} value={align} type={"button"}>
                        <Radio value={'leftRight'}>Left Right</Radio>
                        <Radio value={'leftAlign'}>Left Align</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px' }}>
                    Whether to Enable Selection
                    <RadioGroup onChange={onSelectChange} value={select} type={"button"}>
                        <Radio value={true}>ON</Radio>
                        <Radio value={false}>OFF</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px' }}>
                    Selection Method
                    <RadioGroup onChange={onSelectionChange} value={selection} type={"button"}>
                        <Radio value={'allSelect'}>AllSelect</Radio>
                        <Radio value={'cancelSelect'}>CancelAllSelect</Radio>
                    </RadioGroup>
                </span>
            </span>

            <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 12, marginTop: 10, padding: 20 }}>
                <AIChatDialogue 
                    ref={ref}
                    align={align}
                    mode="bubble"
                    chats={messages}
                    selecting={select}
                    onSelect={onSelect}
                    roleConfig={roleConfig}
                />
            </div>
        </div>
    );
}

render(SelectingDemo);

```

<!-- todo -->
<!-- ### 编辑消息 -->
<!-- ```jsx live=true dir="column" noInline=true

``` -->


### Hints
Use `hints` to set the hint area content. Clicking a hint populates it as the new user input and triggers `onHintClick`.

```jsx live=true dir="column"
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

() => {
    const defaultMessages = [
        {
            role: 'assistant',
            id: '1',
            createAt: 1715676751919,
            content: 'Semi Design is a design system designed, developed, and maintained by the TikTok front-end team and the MED product design team. You can ask me any questions about Semi.',
        }
    ];

    const hintsExample = [
        "What are the commonly used components in the Semi component library?",
        "Can you show an example of a page built using the Semi component library?",
        "Is there any official documentation for the Semi component library?",
    ];

    const roleConfig = {
        user: {
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
    };
    const [messages, setMessage] = useState(defaultMessages);
    const [hints, setHints] = useState(hintsExample);
  
    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onHintClick = useCallback((hint) => {
        setHints([]);
    }, []);

    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            hints={hints}
            onHintClick={onHintClick}
        />
    );
};

```



### Custom Hint Rendering
Customize the hint area with `renderHintBox`. Parameters:

```ts
type renderHintBox = (props: {content: string; index: number,onHintClick: () => void}) => React.ReactNode;
```

```jsx live=true dir="column"
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';
import { IconArrowRight } from '@douyinfe/semi-icons';


() => {
    const defaultMessages = [
        {
            role: 'assistant',
            id: '1',
            createAt: 1715676751919,
            content: 'Semi Design is a design system created and maintained by ByteDance Frontend Team and the MED Product Design Team. You can ask me anything about Semi.',
        }
    ];

    const hintsExample = [
        "What are the commonly used components in the Semi component library?",
        "Can you show an example of a page built using the Semi component library?",
        "Is there any official documentation for the Semi component library?",
    ];

    const roleConfig = {
        user: {
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
    };
    const [messages, setMessage] = useState(defaultMessages);
    const [hints, setHints] = useState(hintsExample);
  
    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onHintClick = useCallback((hint) => {
        setHints([]);
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
        return (
            <div style={commonHintStyle} onClick={onHintClick} key={index}>
                {content}
                <IconArrowRight style={{ marginLeft: 10 }}>click me</IconArrowRight>
            </div>
        );
    }, []);
    

    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            hints={hints}
            onHintClick={onHintClick}
            renderHintBox={renderHintBox}
        />
    );
};
```

### Custom Chat Box Rendering
Pass custom rendering configuration via `chatBoxRenderConfig`. Types:

```ts
export interface RenderTitleProps {
    message?: Message;
    role?: Metadata;
    defaultTitle?: ReactNode
}

export interface RenderAvatarProps {
    message?: Message; 
    role?: Metadata, 
    defaultAvatar?: ReactNode
}

export interface RenderContentProps {
    message?: Message;
    role?: Metadata | Map<string, Metadata>;
    defaultContent?: ReactNode | ReactNode[]; 
    className?: string;
}

export interface DefaultActionNodeObj {
    copyNode: ReactNode;
    likeNode: ReactNode;
    dislikeNode: ReactNode;
    resetNode: ReactNode;
    moreNode: ReactNode;
}

export interface RenderActionProps {
    message?: Message;
    defaultActions?: ReactNode | ReactNode[];
    className: string;
    defaultActionsObj?: DefaultActionNodeObj;
};

export interface FullDialogueNodes {
    avatar?: ReactNode;
    title?: ReactNode; 
    content?: ReactNode; 
    action?: ReactNode
}

export interface RenderFullDialogueProps {
    message?: Message;
    role?: Metadata;
    defaultNodes?: FullDialogueNodes;
    className: string
}


export interface DialogueRenderConfig {
    /* Customize message title rendering */
    renderDialogueAction?: (props: RenderActionProps) => ReactNode;
    /* Customize avatar rendering */
    renderDialogueAvatar?: (props: RenderAvatarProps) => ReactNode;
    /* Customize content rendering */
    renderDialogueContent?: (props: RenderContentProps) => ReactNode;
    /* Customize action bar rendering */
    renderDialogueTitle?: (props: RenderTitleProps) => ReactNode;
    /* Fully customize the entire chat box */
    renderFullDialogue?: (props: RenderFullDialogueProps) => ReactNode
}
```

You can customize the avatar and title via `renderChatBoxAvatar` and `renderChatBoxTitle`.
```jsx live=true dir="column" 
import React, { useState, useCallback } from 'react';
import { AIChatDialogue, Avatar } from '@douyinfe/semi-ui';

() => {
    const defaultMessages = [
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
            content: "Give an example of using the Semi Design Button component",
        },
        {
            role: 'assistant',
            id: '3',
            createAt: 1715676751919,
            content: "Here is a sample usage of a Semi component:\n```jsx \nimport React from 'react';\nimport { Button } from '@douyinfe/semi-ui';\n\nconst MyComponent = () => {\n  return (\n    <Button>Click me</Button>\n );\n};\nexport default MyComponent;\n```\n",
        }
    ];

    const roleConfig = {
        user: {
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
    };

    const [messages, setMessage] = useState(defaultMessages);
    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const renderConfig = {
        renderDialogueTitle: (props) => {
            return <div className="semi-ai-chat-dialogue-title">My-{props.role.name}</div>;
        },
        renderDialogueAvatar: (props) => {
            return <Avatar
                src={props.role.avatar}
                size="extra-small"
                shape="square"
            >
            </Avatar>;
        },
        renderDialogueAction: (props) => {
            return <div className={props.className}>{props.defaultActions[0]}</div>;
        },
    };

    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            dialogueRenderConfig={renderConfig}
        />
    );
};

```

### Custom Message Content Rendering

Use `renderDialogueContentItem` to provide renderers by message type. Example:

```jsx live=true dir="column" noInline=true
import React, { useState, useCallback } from 'react';
import { AIChatDialogue, MarkdownRender } from '@douyinfe/semi-ui';

const defaultMessages = [
    {
        id: '1',
        role: 'user',
        content: 'Hello',
    }, 
    {
        id: '2',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        status: 'completed',
    }, 
    {
        id: '3',
        role: 'user',
        content: [
            {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: 'Help me generate a similar image',
                    }, 
                    {
                        type: 'input_image',
                        image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
                        file_id: 'demo-file-id'
                    }, 
                    {
                        type: 'input_image',
                        image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
                        file_id: 'demo-file-id'
                    }
                ],
            }],
    }, 
    {
        id: '4',
        role: 'assistant',
        content: [{
            type: "reasoning",
            summary: [
                {
                    "type": "summary_text",
                    "text": "\nThe user asked me to generate a similar image. I need to analyze the image first, then generate a similar one..."
                }
            ],
            annotations: [
                {
                    title: 'semi.design',
                    url: 'https://semi.design/',
                    detail: 'semi design page',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
                },
                {
                    title: 'semi.design',
                    url: 'https://semi.design/',
                    detail: 'semi design page',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
                },
            ],
            status: "completed"
        }, 
        {
            type: 'function_call',
            name: 'create_travel_guide',
            arguments: "{\n\"city\": \"Beijing\"\n}",
            status: 'completed',
        }
        ],
        status: 'completed',
    }];

const roleConfig = {
    user: {
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
};

function CustomRender () {
    const [messages, setMessage] = useState(defaultMessages);
    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const userTextStyle = {
        backgroundColor: 'var(--semi-color-fill-1)',
        color: 'var(--semi-color-text-0)',
        borderRadius: '25px',
        padding: '6px 16px',
    };

    const assistantStyle = {
        color: 'var(--semi-color-text-0)',
        padding: '6px 16px',
    };

    const functionCallStyle = {
        backgroundColor: 'var(--semi-color-fill-1)',
        padding: '6px 16px',
        borderRadius: '25px',
    };

    const customRenderReasoningContent = useCallback((props) => {
        return <React.Fragment>
            <AIChatDialogue.Annotation 
                annotation={props.annotations} 
                description={'References'} 
                maxCount={3}
                onClick={(e) => {
                    e && e.stopPropagation();
                    Toast.success('Ready to open the sidebar!');
                }}
            />
            <div style={{ marginTop: '8px' }}>
                <MarkdownRender
                    format='md'
                    raw={props.summary[0].text}
                    {...props.markdownRenderProps}
                />
            </div>
        </React.Fragment>;
    }, []);

    const customRender = {
        "function_call": {
            "create_travel_guide": (item) => {
                return <div style={functionCallStyle}>Function Tool Call: {item.name} {item.arguments}</div>;
            }
        },
        "input_text": (item, message) => {
            if (message.role === 'user') {
                return <div style={userTextStyle} className={'userTextStyle'}>{item.text}</div>;
            }
            return <div style={assistantStyle}>{item.text}</div>;
        },
        "reasoning": (item) => {
            return <AIChatDialogue.Reasoning {...item} customRenderer={customRenderReasoningContent} />;
        },
        "default": (item, message) => {
            if (message.role === 'user') {
                return <div style={userTextStyle} className={'userTextStyle'}>{item}</div>;
            } else {
                return <div style={assistantStyle}>{item}</div>;
            }
        }
    };

    return (
        <AIChatDialogue 
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            renderDialogueContentItem={customRender}
        />
    );
}

render(CustomRender);
```



### Message Data Adapters
The current component's dialogue messages are modeled after OpenAI's [Response Object](https://platform.openai.com/docs/api-reference/responses/object). To better support users in seamlessly integrating the [Chat Completion API](https://platform.openai.com/docs/api-reference/chat/create) and [Response API](https://platform.openai.com/docs/api-reference/responses/create), we provide four `Adapter` transformation functions. Users can directly use these functions to transform the API's return results to obtain data that can be directly used for message display. Two `Adapter` functions are provided to process the data of the `ChatInput` component into an `input Message` format adapted to the `Response API` or the `Input Message` format in the `Chat Completion API`.

```ts
// Convert the data returned by the Chat Completion API into the Message format in Chat Dialogue
function chatCompletionToMessage(chatCompletion: ChatCompletion): Message[]

// Convert the Chat Completion API streaming data into Message format for Chat Dialogue.
function streamingChatCompletionToMessage(chatCompletionChunks: ChatCompletionChunk[], state?: StreamingChatState): { messages: Message[]; state?: StreamingChatState }

// Convert the data returned by the Response API into the Message format in Chat Dialogue
function responseToMessage(response: Response): Message

// Convert the streaming data returned by the Response API into the Message format in Chat Dialogue
function streamingResponseToMessage(chunks: ResponseChunk[], prevState: StreamingResponseState): { messages: Message[]; state?: StreamingResponseState }

// Convert the streaming data returned by the Response API into Message format for the Chat Dialogue.
function chatInputToMessage(inputContent: MessageContent): Message

// Convert Chat Input data to Input Message format in Chat Completion API
function chatInputToChatCompletion(inputContent: MessageContent): ChatCompletionInput
```

For example, when a user returns non-streaming data using the [Chat Completion API](https://platform.openai.com/docs/api-reference/chat/create) interface, the `chatCompletionToMessage` function can be used to convert the Chat Completion Object into a Dialogue Message block format. Note that because the `Chat Completion API` allows control over the number of results generated for each input message via `n`, this function returns an array. (Note: If n > 1, the user needs to decide which data to add to the message for display.)

```jsx live=true noInline=true dir="column"
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

const roleConfig = {
    user: {
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
};

function ChatCompletionToMessageDemo() {
    const [messages, setMessage] = useState([]);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    useEffect(() => {
        const message = chatCompletionToMessage(CHAT_COMPLETION_DATA);
        setMessage([...message]);
    }, []);
  
    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
        />
    );
};

const CHAT_COMPLETION_DATA = {
    "id": "chatcmpl-B9MBs8CjcvOU2jLn4n570S5qMJKcT",
    "object": "chat.completion",
    "created": 1741569952,
    "model": "gpt-4.1-2025-04-14",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Hello! How can I assist you today?",
                "refusal": null,
                "annotations": [],
                "tool_calls": [
                    {
                        "id": "call_abc123",
                        "type": "function",
                        "function": {
                            "name": "get_current_weather",
                            "arguments": "{\n\"location\": \"Boston, MA\"\n}"
                        }
                    }
                ]
            },
            "logprobs": null,
            "finish_reason": "stop"
        }
    ],
    // ...
};

render(ChatCompletionToMessageDemo);
```


For example, when a user returns streaming data using the [Chat Completion API](https://platform.openai.com/docs/api-reference/chat/create) interface, the `streamingChatCompletionToMessage` function can be used to convert the Chat Completion Chunk Object List into a Dialogue Message format.

```jsx live=true noInline=true dir="column"
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

const roleConfig = {
    user: {
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
};

function StreamingChatCompletionToMessageDemo() {
    const [messages, setMessage] = useState([]);
    const [state, setState] = useState();

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    useEffect(() => {
        const total = STREAMING_CHAT_COMPLETION_DATA.length;
        let i = 1;

        const timer = setInterval(() => {
            if (i > total) {
                clearInterval(timer);
                return;
            }

            const slice = STREAMING_CHAT_COMPLETION_DATA.slice(0, i);
            const { messages: partialMessages, state: nextState } = streamingChatCompletionToMessage(slice, state);
            setState(nextState);

            const merged = [...messages, partialMessages[0]];
            setMessage(merged);

            i += 1;
        }, 100);

        return () => clearInterval(timer);
    }, []);
  
    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
        />
    );
};

const STREAMING_CHAT_COMPLETION_DATA = [
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011843, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "", "refusal": null }, "finish_reason": null }], "obfuscation": "ahPqlzj6DD" },
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011843, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": { "content": "" }, "finish_reason": null }], "obfuscation": "i2PXRIwvc3D" },
    // index 0: 输出文本增量
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011843, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": { "content": " I'm using " }, "finish_reason": null }], "obfuscation": "3sslO5QylW" },
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011843, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": { "content": "streamingChatCompletionToMessage" }, "finish_reason": null }], "obfuscation": "3sslO5QylW" },

    // index 1: 工具调用增量（function_call / tool_calls）
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011845, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 1, "delta": { "tool_calls": [{ "id": "call_1", "function": { "name": "searchWeather", "arguments": "{\"city\":\"Beijing\"}" } }] }, "finish_reason": null }], "obfuscation": "T1" },
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011846, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 1, "delta": { "tool_calls": [{ "id": "call_1", "function": { "name": null, "arguments": ",\"day\":\"today\"}" } }] }, "finish_reason": null }], "obfuscation": "T2" },

    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011844, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": { "content": " transform to Chat Completion Chunks" }, "finish_reason": null }], "obfuscation": "X1" },
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011844, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": { "content": " 🥳" }, "finish_reason": null }], "obfuscation": "X2" },

    // 终止信号
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011843, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 0, "delta": {}, "finish_reason": "stop" }], "obfuscation": "n13SLf" },
    { "id": "chatcmpl-COjljxurV5GKrRUsg1wd7mIyQCiiT", "object": "chat.completion.chunk", "created": 1760011843, "model": "o3-mini-2025-01-31", "service_tier": "default", "system_fingerprint": "fp_6c43dcef8c", "choices": [{ "index": 1, "delta": {}, "finish_reason": "stop" }], "obfuscation": "jt9rDb" }
];

render(StreamingChatCompletionToMessageDemo);

```

When a user returns non-streaming data using the [Response API](https://platform.openai.com/docs/api-reference/responses/create) interface, the `responseToMessage` function can be used to convert the Response Object into a Dialogue Message block format.
```jsx live=true noInline=true dir="column"
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

const roleConfig = {
    user: {
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
};

function ResponseToMessageDemo() {
    const [messages, setMessage] = useState([]);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    useEffect(() => {
        const responseMessage = responseToMessage(RESPONSE_DATA);

        setMessage([responseMessage]);
    }, []);
  
    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
        />
    );
};

const RESPONSE_DATA = {
    "id": "resp_67ccd3a9da748190baa7f1570fe91ac604becb25c45c1d41",
    "object": "response",
    "created_at": 1741476777,
    "status": "completed",
    "error": null,
    "incomplete_details": null,
    "instructions": null,
    "max_output_tokens": null,
    "model": "gpt-4o-2024-08-06",
    "output": [
        {
            "id": "rs_6876cf02e0bc8192b74af0fb64b715ff06fa2fcced15a5ac",
            "type": "reasoning",
            "status": "completed",
            "summary": [
                {
                    "type": "summary_text",
                    "text": "**What is Semi Design?** The user asks for \"Semi Design\" which requires aggregating multiple sources. First, ByteDance's Semi Design is a design system supporting multiple platforms with Design Tokens and code conversion tools. Another result from India focuses on semiconductor training, but the user likely refers to the ByteDance one. Other results mention semi-custom design but are less relevant. We should confirm if there are other interpretations, but current info covers the main dimensions. Continuing to reason may improve completeness, but it's sufficient to answer now."
                }
            ]
        },
        {
            "type": "message",
            "id": "msg_67ccd3acc8d48190a77525dc6de64b4104becb25c45c1d41",
            "status": "completed",
            "role": "assistant",
            "content": [
                {
                    "type": "output_text",
                    "text": "Semi Design is a design system created and maintained by ByteDance's Frontend Team and the MED Product Design Team. You can ask me anything about Semi.",
                    "annotations": [
                        {
                            "title": 'Semi Design',
                            "url": 'https://semi.design/zh-CN/start/getting-started',
                            "detail": 'Semi Design Getting Started',
                            "logo": 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
                        },
                        {
                            "title": 'Semi Design',
                            "url": 'https://semi.design/zh-CN/start/getting-started',
                            "detail": 'Semi Design Getting Started',
                            "logo": 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
                        },
                        {
                            "title": 'Semi Design',
                            "url": 'https://semi.design/zh-CN/start/getting-started',
                            "detail": 'Semi Design Getting Started',
                            "logo": 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
                        },
                    ]
                }
            ]
        },
        {
            "id": "fc_12345xyz",
            "call_id": "call_12345xyz",
            "type": "function_call",
            "name": "get_semi_page",
            "status": "completed",
            "arguments": "{\"pageName\":\"AIChatDialogue\"}"
        },
    ],
    // ...
};

render(ResponseToMessageDemo);
```

When a user returns streaming data using the [Response API](https://platform.openai.com/docs/api-reference/responses/create) interface, the `streamingResponseToMessage` function can be used to convert the Response Chunk Object List into a Dialogue Message format.
```jsx live=true noInline=true dir="column"
import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '@douyinfe/semi-ui';

const roleConfig = {
    user: {
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
};

const FIXED_SHUFFLED_INDICES = [
    0,  // sequence_number: 0
    1,  // sequence_number: 1
    2,  // sequence_number: 2
    3,  // sequence_number: 3
    4,  // sequence_number: 4
    6,  // sequence_number: 6 (块5被跳过 / chunk 5 skipped)
    6,  // sequence_number: 6 (块6重复到达)
    7,  // sequence_number: 7
    5,  // sequence_number: 5 (块5延迟到达 / chunk 5 arrives late)
    8,  // sequence_number: 8
    9,  // sequence_number: 9
    10, // sequence_number: 10
    11, // sequence_number: 11
    12, // sequence_number: 12 
    13, // sequence_number: 13 
    14, // sequence_number: 14
    15, // sequence_number: 15
    16, // sequence_number: 16
];

function StreamingResponseToMessageDemo() {
    const [messages, setMessage] = useState([]);
    const [currentState, setCurrentState] = useState(null);
    const [currentLength, setCurrentLength] = useState(0);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    useEffect(() => {
        if (currentLength > FIXED_SHUFFLED_INDICES.length) {
            return;
        }

        const timer = setTimeout(() => {
            if (currentLength === 0) {
                setCurrentLength(1);
                return;
            }

            const currentIndices = FIXED_SHUFFLED_INDICES.slice(0, currentLength);
            const currentChunks = currentIndices.map(index => REASONING_CHUNKS[index]);

            const result = streamingResponseToMessage(currentChunks, currentState);
            
            if (result) {
                const { message: responseMessage, nextState } = result;
                if (responseMessage) {
                    setMessage([responseMessage]);
                    // 更新状态供下次使用 / Update state for next iteration
                    setCurrentState(nextState);
                }
            }
            setCurrentLength(prev => prev + 1);
        }, 200);

        return () => clearTimeout(timer);
    }, [currentLength, currentState]);
  
    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
        />
    );
};

const REASONING_CHUNKS = [
    { "type": "response.created", "sequence_number": 0, "response": { "id": "resp_reason_001", "object": "response", "created_at": 1760091777, "status": "in_progress", "background": false, "error": null, "incomplete_details": null, "instructions": null, "max_output_tokens": null, "max_tool_calls": null, "model": "o3-mini-2025-01-31", "output": [], "parallel_tool_calls": true, "previous_response_id": null, "prompt_cache_key": null, "reasoning": { "effort": "medium", "summary": null }, "safety_identifier": null, "service_tier": "auto", "store": true, "temperature": 1.0, "text": { "format": { "type": "text" }, "verbosity": "medium" }, "tool_choice": "auto", "tools": [], "top_logprobs": 0, "top_p": 1.0, "truncation": "disabled", "usage": null, "user": null, "metadata": {} } },
    { "type": "response.in_progress", "sequence_number": 1, "response": { "id": "resp_reason_001", "object": "response", "created_at": 1760091777, "status": "in_progress", "background": false, "error": null, "incomplete_details": null, "instructions": null, "max_output_tokens": null, "max_tool_calls": null, "model": "o3-mini-2025-01-31", "output": [], "parallel_tool_calls": true, "previous_response_id": null, "prompt_cache_key": null, "reasoning": { "effort": "medium", "summary": null }, "safety_identifier": null, "service_tier": "auto", "store": true, "temperature": 1.0, "text": { "format": { "type": "text" }, "verbosity": "medium" }, "tool_choice": "auto", "tools": [], "top_logprobs": 0, "top_p": 1.0, "truncation": "disabled", "usage": null, "user": null, "metadata": {} } },

    // reasoning item（输出索引 0）
    { "type": "response.output_item.added", "sequence_number": 2, "output_index": 0, "item": { "id": "rs_reason_001", "type": "reasoning", "summary": [] } },
    { "type": "response.reasoning_summary_part.added", "sequence_number": 3, "output_index": 0, "summary_index": 0, "part": { "type": "reasoning", "text": "" } },
    { "type": "response.reasoning_summary_text.delta", "sequence_number": 4, "output_index": 0, "summary_index": 0, "delta": "T" },
    { "type": "response.reasoning_summary_text.delta", "sequence_number": 5, "output_index": 0, "summary_index": 0, "delta": "h" },
    { "type": "response.reasoning_summary_text.delta", "sequence_number": 6, "output_index": 0, "summary_index": 0, "delta": "i" },
    { "type": "response.reasoning_summary_text.delta", "sequence_number": 7, "output_index": 0, "summary_index": 0, "delta": "n" },
    { "type": "response.reasoning_summary_text.done", "sequence_number": 9, "output_index": 0, "summary_index": 0, "text": "Done thinking!" },
    { "type": "response.output_item.done", "sequence_number": 10, "output_index": 0, "item": { "id": "rs_reason_001", "type": "reasoning", "summary": [ { "type": "reasoning", "text": "思考完成！" } ] } },

    // assistant message（输出索引 1）
    { "type": "response.output_item.added", "sequence_number": 11, "output_index": 1, "item": { "id": "msg_reason_001", "type": "message", "status": "in_progress", "content": [], "role": "assistant" } },
    { "type": "response.content_part.added", "sequence_number": 12, "item_id": "msg_reason_001", "output_index": 1, "content_index": 0, "part": { "type": "output_text", "annotations": [], "text": "" } },
    { "type": "response.output_text.delta", "sequence_number": 13, "item_id": "msg_reason_001", "output_index": 1, "content_index": 0, "delta": "Based on the reasoning above, " },
    { "type": "response.output_text.delta", "sequence_number": 14, "item_id": "msg_reason_001", "output_index": 1, "content_index": 0, "delta": "the conclusions are:" },
    { "type": "response.output_text.done", "sequence_number": 15, "item_id": "msg_reason_001", "output_index": 1, "content_index": 0, "text": "Based on the reasoning above, the conclusions are: ..." },

    { "type": "response.completed", "sequence_number": 16, "response": { "id": "resp_reason_001", "object": "response", "created_at": 1760091777, "status": "completed", "background": false, "error": null, "incomplete_details": null, "instructions": null, "max_output_tokens": null, "max_tool_calls": null, "model": "o3-mini-2025-01-31", "output": [ { "id": "rs_reason_001", "type": "reasoning", "summary": [ { "type": "reasoning", "text": "思考完成！" } ] }, { "id": "msg_reason_001", "type": "message", "status": "completed", "content": [ { "type": "output_text", "annotations": [], "text": "基于上述思考，结论如下：..." } ], "role": "assistant" } ], "parallel_tool_calls": true, "previous_response_id": null, "prompt_cache_key": null, "reasoning": { "effort": "medium", "summary": null }, "safety_identifier": null, "service_tier": "default", "store": true, "temperature": 1.0, "text": { "format": { "type": "text" }, "verbosity": "medium" }, "tool_choice": "auto", "tools": [], "top_logprobs": 0, "top_p": 1.0, "truncation": "disabled", "usage": { "input_tokens": 12, "input_tokens_details": { "cached_tokens": 0 }, "output_tokens": 120, "output_tokens_details": { "reasoning_tokens": 16 }, "total_tokens": 132 }, "user": null, "metadata": {} } }
];

render(StreamingResponseToMessageDemo);

```

## API Reference
| Prop | Description | Type | Default |
|---|---|---|---|
| align | Conversation layout | 'leftRight' \| 'leftAlign' | 'leftRight' |
| chats | Controlled conversation messages | Message[] | - |
| className | Custom class name | string | - |
| disabledFileItemClick | Disable file click | boolean | false |
| hintCls | Hint area outer wrapper class name | string | - |
| hints | Hint texts | string[] | - |
| hintStyle | Hint area outer wrapper style | CSSProperties | - |
| markdownRenderProps | Props passed to the MarkdownRender used by the dialogue. See [MarkdownRenderProps](/zh-CN/plus/markdownrender#API) | MarkdownRenderProps | - |
| messageEditRender | Custom message edit renderer | (props: MessageContent) => React.ReactNode | - |
| mode | Conversation mode | 'bubble' \| 'noBubble' \| 'userBubble' | 'bubble' |
| onAnnotationClick | Annotation click callback | (annotation?: Annotation) => void | - |
| onChatsChange | Messages change callback | (chats?: Message[]) => void | - |
| onFileClick | Attachment file click callback | (file?: InputFile) => void | - |
| onHintClick | Hint click callback | (hint: string) => void | - |
| onImageClick | Image click callback | (image?: InputImage) => void | - |
| onMessageBadFeedback | Negative feedback callback | (message?: Message) => void | - |
| onMessageCopy | Copy message callback | (message?: Message) => void | - |
| onMessageDelete | Delete message callback | (message?: Message) => void | - |
| onMessageEdit | Edit message callback | (message?: Message) => void | - |
| onMessageGoodFeedback | Positive feedback callback | (message?: Message) => void | - |
| onMessageReset | Reset message callback | (message?: Message) => void | - |
| onMessageShare | Share message callback | (message?: Message) => void | - |
| onReferenceClick | Reference button click callback | (message?: Message) => void | - |
| onSelect | Selection change callback | (selectedIds: string[]) => void | - |
| renderConfig | Custom render config for sections | DialogueRenderConfig | - |
| renderDialogueContentItem | Renderer map by message content type | DialogueContentItemRendererMap | - |
| renderHintBox | Custom hint item renderer | (props: { content: string; index: number; onHintClick: () => void }) => React.ReactNode | - |
| roleConfig | Role metadata config (user/assistant/system, etc.) | [RoleConfig](/en-US/ai/aiChatDialogue#RoleConfig) | - |
| selecting | Enable selection mode | boolean | false |
| showReset | Show reset action | boolean | true |
| showReference | Show quotable icon in text or file messages (user messages only) | boolean | false |
| style | Style | CSSProperties | - |

### RoleConfig
| Prop  | Description   | Type   | Default |
|------|--------|-------|-------|
| user | user info | Metadata \| Map<string, Metadata> | - |
| assistant | assistant info | Metadata \| Map<string, Metadata> | - |
| system | system info | Metadata \| Map<string, Metadata> | - |

### MetaData
| Prop  | Description   | Type   | Default |
|------|--------|-------|-------|
| name | Name | string | - |
| avatar | Avatar | string | - |
| color | Avatar background color, same as Avatar `color` prop. Supports `amber`, `blue`, `cyan`, `green`, `grey`, `indigo`, `light-blue`, `light-green`, `lime`, `orange`, `pink`, `purple`, `red`, `teal`, `violet`, `yellow` | string | `grey` |

### Message
| Prop  | Description   | Type   | Default |
|------|--------|-------|-------|
| role | Role | string | - |
| name | Name | string | - |
| id | Unique ID | string\| number | - |
| content | Message content | string\| ContentItem[] | - |
| createdAt | Created at (timestamp) | number | -|
| model | Model name | string | -|
| status | Message status: `queued` \| `in_progress` \| `incomplete` \| `completed` \| `failed` \| `cancelled` | string | `completed` |

### Reference
| Prop  | Description   | Type   | Default |
|------|--------|-------|-------|
| id | Unique identifier  | string\| number | - |
| type | type  | string | - |
| name | name  | string | - |
| url | url  | string | - |
| content | text content  | string | - |

### Methods
| Method  | Description   |
|------|--------|
| selectAll | Select all messages |
| deselectAll | Deselect all messages |
| scrollToBottom(animation: boolean) | Scroll to bottom; if `true`, animate; otherwise no animation |

### ContentItem
`ContentItem` supports all OpenAI Response [InputItem](https://platform.openai.com/docs/api-reference/responses/create#responses-create-input) and [OutputItem](https://platform.openai.com/docs/api-reference/responses/object#responses/object-output) types. Definitions:

```ts
type ContentItem = InputContentItem | OutputContentItem;

type InputContentItem = InputMessage | ItemReference;
type OutputContentItem = OutputMessage | MCPToolCall | Reasoning FileSearchToolCall | 
                        WebSearchToolCall | FunctionToolCall | CustomToolCall | ImageGenerationCall| CustomObject;

interface CommonContentItem {
    id?: string;
    type?: string;
    status?: string;
    role?: string
}

interface CustomObject {
    [key: string]: any
}

// input item
interface InputMessage extends CommonContentItem {
    content?: string | (InputText | InputImage | InputFile)[]
}

interface InputText extends CommonContentItem {
    text?: string
}

interface InputImage extends CommonContentItem {
    detail?: string;
    file_id?: string;
    image_url?: string
}

interface InputFile extends CommonContentItem {
    file_id?: string;
    file_data?: string;
    file_url?: string;
    filename?: string;
    size?: string;
    file_type?: string;
    fileInstance?: any
}

interface ItemReference extends CommonContentItem {
    file_id?: string
}


// output item
interface OutputMessage extends CommonContentItem {
    content?: (OutputText | Refusal)[]
}

interface OutputText {
    text?: string;
    type?: string;
    annotations?: Annotation[]
}

interface Refusal extends CommonContentItem {
    refusal?: string;
    type?: string
}

type Annotation = URLCitation | CustomObject;

interface URLCitation {
    end_index?: number;
    start_index?: number;
    title?: string;
    type?: string;
    url?: string
}

interface Reasoning extends CommonContentItem {
    summary?: {
        text?: string;
        type?: string
    }[];
    content?: {
        text?: string;
        type?: string
    }[]
}

interface FileSearchToolCallResult {
    attributes?: Map<string, string>;
    score?: number;
    file_id?: string;
    filename?: string;
    text?: string
}

interface FileSearchToolCall extends CommonContentItem {
    queries?: string[];
    results?: FileSearchToolCallResult[]
}

interface WebSearchToolCall extends CommonContentItem {
    action?: SearchAction | OpenPageAction | FindAction
}

interface SearchAction {
    type?: string;
    query?: string;
    sources?: { type: string; url: string }[]
}

interface OpenPageAction {
    type?: string;
    url?: string
}

interface FindAction {
    action?: string;
    type?: string;
    query?: string
}

interface FunctionToolCall extends CommonContentItem {
    call_id?: string;
    name?: string;
    arguments?: string
}

interface CustomToolCall extends CommonContentItem {
    call_id?: string;
    name?: string;
    input?: string
}

interface ImageGenerationCall extends CommonContentItem {
    result?: string
}

interface MCPToolCall extends CommonContentItem {
    arguments?: string;
    server_label?: string;
    name?: string;
    result?: string;
    output?: string
}

interface FileUploadToolCall extends CommonContentItem {
    result?: string
}

```

## Design Tokens
<DesignToken/>