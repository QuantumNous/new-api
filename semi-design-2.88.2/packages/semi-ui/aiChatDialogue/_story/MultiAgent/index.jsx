import React, { useState, useCallback } from 'react';
import { AIChatDialogue, AIChatInput, chatInputToMessage, Button, Typography } from '../../../index';
import { IconFixedStroked, IconFeishuLogo, IconBookOpenStroked, IconGit, IconFigma, IconTemplateStroked, IconSearch, IconChevronLeft, IconClose } from '@douyinfe/semi-icons';
import { Paragraph } from '../../../skeleton/item';

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
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/2.x.png',
            file_id: 'demo-file-id',
            size: '100KB',
        }, {
            type: 'input_text',
            text: '结合上面图片的风格，帮我生成一个介绍 Semi Design 设计系统的图片',
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
        "status": "completed"
    }, {
        "type": 'message',
        "content": [{
            "type": "output_text",
            "text": "现在需要生成了一张 Semi Design 的介绍图片",
            "annotations": [
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
        },
        {
            "type": "output_file_custom",
            content: {
                title: 'RFC',
                size: '135kb',
                detail: 'This is a mock custom file'
            }     
        }
        ],
        "status": "completed"
    }, {
        type: 'function_call',
        name: 'create_image',
        arguments: "{\"description\":\"生成 Semi Design 的介绍图片\"}",
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
        label: <IconTemplateStroked />,
        value: 'template',
    },
    {
        label: <IconSearch />,
        value: 'search',
    }
];

export default function MultiAgentDemo() {
    const inputOuterStyle = { marginTop: '12px', minHeight: 150, maxHeight: 300, flexShrink: 0 };
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
        <Configure.RadioButton options={radioButtonProps} field="thinkType" initValue="template"/>
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

    const onAnnotationClick = useCallback((annotations) => {
        console.log('annotations', annotations);
        toggleSideBar();
        setSideBarContent({
            type: 'annotation',
            value: annotations
        });
    }, [toggleSideBar]);

    const toggleSideBar = useCallback(() => {
        setSideBarVisible(v => !v);
    }, []);

    const renderSideBarTitle = useCallback((content) => {
        const { type, value } = content;
        return <div style={{ display: 'flex', alignItems: 'center ', justifyContent: 'space-between', padding: 12, color: 'var(--semi-color-text)' }}>
            {type === 'annotation' && <div style={{ fontSize: '16px', lineHeight: '22px', fontWeight: 600 }}>参考资料</div>}
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
        }
        return <div>

        </div>;
    }, []);

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
            {sideBarVisible && <div 
                style={{ flexShrink: 0, width: 200, height: 'calc(100vh - 32px)', borderRadius: '12px', border: '1px solid var(--semi-color-border)', flexShrink: 0 }}
            >
                {renderSideBarTitle(sideBarContent)}
                {renderSideBarBody(sideBarContent)}
            </div>}
        </div>
    );
}