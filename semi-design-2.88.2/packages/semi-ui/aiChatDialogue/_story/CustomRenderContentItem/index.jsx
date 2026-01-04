import React, { useState, useCallback } from 'react';
import { AIChatDialogue, Typography, MarkdownRender, Toast } from '../../../index';
import { IconSearch, IconFile, IconTerminal } from '@douyinfe/semi-icons';
import './index.scss';

const defaultMessages = [{
    id: '1',
    role: 'user',
    content: '你好',
}, {
    id: '2',
    role: 'assistant',
    content: '你好呀，请问有什么可以帮助您的吗~',
    status: 'completed',
}, {
    id: '3',
    role: 'user',
    content: [{
        type: 'message',
        role: 'user',
        content: [{
            type: 'input_text',
            text: '帮我生成类似的图片',
        }, {
            type: 'input_image',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id'
        }, {
            type: 'input_image',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id'
        }],
    }],
}, {
    id: '4',
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
        type: 'function_call',
        name: 'create_travel_guide',
        arguments: {
            city: '北京'
        },
        status: 'completed',
    }, {
        "id": "rs_02175871288540800000000000000000000ffffac1598778c9aa5",
        "type": "plan",
        "content": [
            {
                "summary": "分析图片内容，然后生成类似的图片",
                "steps": [
                    {
                        "summary": "分析图片内容",
                        "description": "正在分析图片内容",
                        "type": "search",
                    }, {
                        "summary": "调用生成图片的工具",
                        "description": "正在调用生成图片的工具",
                        "type": "code",
                    }, {
                        "summary": "完成生成图片，并返回给用户",
                        "description": "正在完成生成图片，并返回给用户",
                        "type": "terminal",
                    }
                ],
                "status": "completed"
            },
            {
                "summary": "总结生成图片的成果并呈现给用户",
                "steps": []
            }
        ],
        "status": "completed"
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
  
export default function CustomRender() {
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
                    icon = <IconSearch />;
                    break;
                case 'code':
                    icon = <IconFile />;
                    break;
                case 'terminal':
                    icon = <IconTerminal />;
                    break;
            }
            return {
                summary: item.summary,
                description: item.description,
                status: item.status,
                icon: icon,
            };
        });
    }, []);

    const customRenderReasoningContent = useCallback((props) => {
        return <React.Fragment>
            <AIChatDialogue.Annotation 
                annotation={props.annotations} 
                description={'参考资料'} 
                maxCount={3}
                onClick={(e) => {
                    e && e.stopPropagation();
                    Toast.success('Ready to open the sidebar!');
                }}
            />
            <div className="reasoning-content">
                <MarkdownRender
                    format='md'
                    raw={props.summary[0].text}
                    {...props.markdownRenderProps}
                />
            </div>
        </React.Fragment>;
    }, []);

    const customRender = {
        // "function_call": (item) => {
        //     return <div>custom render {item.name} {JSON.stringify(item.arguments)}</div>;
        // },
        "function_call": {
            "create_travel_guide": (item, message) => {
                return <div className="user-text">Function Tool Call: {item.name} {JSON.stringify(item.arguments)}</div>;
            }
        },
        "input_text": (item, message) => {
            if (message?.role === 'user') {
                return <div className="user-text">{item.text}</div>;
            }
            return <div className="assistant-text">{item.text}</div>;
        },
        "reasoning": (item, message) => {
            return <AIChatDialogue.Reasoning {...item} customRenderer={customRenderReasoningContent} />;
        },
        "plan": (item, message) => { // plan 为用户自定义类型
            let steps = item.content.map((item) => {
                return {
                    summary: item.summary,
                    actions: mapStep(item.steps),
                    status: item.status,
                };
            });
            return <AIChatDialogue.Step steps={steps} />;
        },
        "default": (item, message) => {
            if (message?.role === 'user') {
                return <div className="user-text">{item}</div>;
            }
            return <div className="assistant-text">{item}</div>;
        }
    };

    return (
        <div>
            <Typography.Text mark>👇 消息内容块自定义渲染</Typography.Text>
            <AIChatDialogue 
                align="leftRight"
                mode="userBubble"
                chats={messages}
                roleConfig={roleConfig}
                onChatsChange={onChatsChange}
                renderDialogueContentItem={customRender}
            />
        </div>
    );
};