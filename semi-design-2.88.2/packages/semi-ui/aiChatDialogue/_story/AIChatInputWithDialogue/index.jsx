import React, { useState, useCallback } from 'react';
import { AIChatDialogue, AIChatInput, chatInputToMessage } from '../../../index';
import { IconFixedStroked, IconFeishuLogo, IconBookOpenStroked, IconGit, IconFigma } from '@douyinfe/semi-icons';

const { Configure } = AIChatInput;


const defaultMessages = [{
    id: '1',
    role: 'assistant',
    content: '你好呀，请问有什么可以帮助您的吗~',
    status: 'completed',
}, {
    id: '2',
    role: 'user',
    content: [{
        type: 'message',
        role: 'user',
        content: [{
            type: 'input_image',
            name: 'edit-bag.jpeg',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id',
            size: '100KB',
        }, {
            type: 'input_text',
            text: '帮我生成类似的图片',
        }],
    }],
}, {
    id: '3',
    role: 'assistant',
    content: [{
        "id": "rs_02175871288540800000000000000000000ffffac1598778c9aa5",
        "type": "reasoning",
        "summary": [
            {
                "type": "summary_text",
                "text": "\n用户问需要我帮助他生成类似图片，我需要先分析图片内容分析图片内容分析图片内容分析图片内容分析图片内容分析图片内容，然后生成类似的图片..."
            }
        ],
        "annotations": [
            {
                title: '快乐星球',
                url: 'https://semi.design/zh-CN/start/getting-started',
                detail: '快乐星球是一个快乐的地方',
                logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
            },
            {
                title: '快乐星球',
                url: 'https://semi.design/zh-CN/start/getting-started',
                detail: '快乐星球是一个快乐的地方',
                logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
            },
            {
                title: '快乐星球',
                url: 'https://semi.design/zh-CN/start/getting-started',
                detail: '快乐星球是一个快乐的地方',
                logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
            }
        ],
        "status": "completed"
    }, {
        "type": 'message',
        "content": [{
            "type": "output_text",
            "text": "现在需要生成了一张黄色背包的图片",
            "annotations": [
                {
                    title: '黄色背包',
                    url: 'https://semi.design/zh-CN/start/getting-started',
                    detail: '黄色背包',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
                },
                {
                    title: '黄色背包',
                    url: 'https://semi.design/zh-CN/start/getting-started',
                    detail: '黄色背包',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
                },
                {
                    title: '黄色背包',
                    url: 'https://semi.design/zh-CN/start/getting-started',
                    detail: '黄色背包',
                    logo: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
                }
            ],
        }],
        "status": "completed"
    }, {
        type: 'function_call',
        name: 'create_image',
        arguments: "{\"description\":\"生成一个黄色背包的图片\"}",
        status: 'completed',
    }],
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
    {
        label: '极速',
        value: 'fast',
    },
    { 
        label: '思考',
        value: 'think',
    },
    {
        label: '超能',
        value: 'super',
    }
];

export default function AIChatInputWithDialogue() {
    const inputOuterStyle = { margin: '12px 0px', minHeight: 150, maxHeight: 300, flexShrink: 0 };
    const editingInputOuterStyle = { margin: '12px 0px', maxHeight: 300, flexShrink: 0 };
    const dialogueOuterStyle = { flex: 1, overflow: 'auto' };

    const [messages, setMessages] = useState(defaultMessages); 
    const [generating, setGenerating] = useState(false);
    const [references, setReferences] = useState([]); 

    const renderLeftMenu = useCallback(() => (<>
        <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
        <Configure.Button icon={<IconFixedStroked />} field="deepThink">深度思考</Configure.Button>
        <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
        <Configure.Mcp options={mcpOptions} />
        <Configure.RadioButton options={radioButtonProps} field="thinkType" initValue="fast"/>
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
                message.references = message?.references?.filter((ref) => ref.id !== item.id);
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
                references={props?.references}
                uploadProps={{ ...uploadProps, defaultFileList: props?.attachments ?? [] }}
                defaultContent={props?.inputContents?.[0]?.text}
                renderConfigureArea={renderLeftMenu} 
                // onContentChange={onContentChange}
                onMessageSend={onEditMessageSend}
                onReferenceDelete={handleEditingReferenceDelete}
            />
        );
    }, [messages, handleEditingReferenceDelete]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 32px)', overflow: 'hidden' }}>
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
            />
            <AIChatInput 
                style={inputOuterStyle}
                placeholder={'输入内容或者上传内容'} 
                defaultContent={'我是一名<input-slot placeholder="[职业]">学生</input-slot>，帮我写一段面向<input-slot placeholder="[输入对象]"></input-slot>的话术内容'}
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
    );
}