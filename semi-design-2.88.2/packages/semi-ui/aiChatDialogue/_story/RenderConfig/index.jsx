import React, { useState, useCallback } from 'react';
import { AIChatDialogue, Avatar } from '../../../index';

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
                ]
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

export default function RenderConfig() {
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
                className="semi-ai-chat-dialogue-avatar"
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
}