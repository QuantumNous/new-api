export const defaultMessages = [{
    id: '1',
    role: 'user',
    content: '你好',
}, {
    id: '2',
    role: 'assistant',
    content: '你好呀，请问有什么可以帮助您的吗～你好呀，请问有什么可以帮助您的吗～你好呀，请问有什么可以帮助您的吗～',
    status: 'completed',
}, {
    id: '3',
    role: 'user',
    content: [{
        type: 'message',
        content: [{
            type: 'input_text',
            text: '帮我生成类似的图片帮我生成类似的图片帮我生成类似的图片帮我生成类似的图片',
        }],
    }, {
        type: 'message',
        content: [{
            type: 'input_image',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id'
        }, {
            type: 'input_image',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id'
        }
        ],
    }],
    status: 'completed',
}, {
    id: '4',
    role: 'assistant',
    content: [{
        type: 'message',
        role: 'assistant',
        content: [{
            type: 'output_text',
            text: '好的，请稍等',
        }],
    }],
    status: 'completed',
}, {
    id: '5',
    role: 'user',
    content: `Semi Design 是由抖音前端团队和MED产品设计团队设计、开发并维护的设计系统。作为一个全面、易用、优质的现代应用UI解决方案，Semi Design从字节跳动各业务线的复杂场景中提炼而来，目前已经支撑了近千个平台产品，服务了内外部超过10万用户[1]。

Semi Design的特点包括：

设计简洁、现代化。 提供主题方案，可深度样式定制。 提供明暗色两套模式，切换方便。 国际化，覆盖了简/繁体中文、英语、日语、韩语、葡萄牙语等20+种语言，日期时间组件提供全球时区支持，全部组件可自动适配阿拉伯文RTL布局。 采用 Foundation 和 Adapter 跨框架技术方案，方便扩展`,
    status: 'completed',
}];
  
export const loadingMessages = [{
    id: '1',
    role: 'assistant',
    status: 'in_progress',
}];

export const continueSendMessages = [{
    id: '1',
    role: 'assistant',
    content: '你好',
}, {
    id: '2',
    role: 'assistant',
    content: '你好呀呀呀',
}];
  
export const multiModalityMessage = [{
    id: '1',
    role: 'user',
    content: '你好',
}, {
    id: '2',
    role: 'assistant',
    content: '你好呀，请问有什么可以帮助您的吗？',
    status: 'completed',
}, {
    id: '3',
    role: 'user',
    content: [{
        type: 'message',
        content: [{
            type: "input_text",
            text: "帮我根据下面文件的内容，生成一个简单的 semi design 代码使用示例",
        },
        {
            type: 'input_file',
            file_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            filename: 'edit-bag.jpeg',
            size: '100KB',
        },
        {
            type: 'input_file',
            file_url: 'https://www.berkshirehathaway.com/letters/2024ltr.docx',
            filename: 'i-am-word-i-am-word.docx',
            size: '1000KB',
        },
        {
            type: 'input_file',
            file_url: 'https://www.berkshirehathaway.com/letters/2024ltr.pdf',
            filename: '2024ltr.pdf',
            size: '100KB',
        },
        {
            type: 'input_image',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id'
        }, {
            type: 'input_image',
            image_url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/edit-bag.jpeg',
            file_id: 'demo-file-id'
        },
        ],
    }],
    status: 'completed',
}, {
    id: '4',
    role: 'assistant',
    content: [{
        type: 'message',
        content: [{
            type: 'output_text',
            text: "以下是一个 Semi 代码的使用示例：\n\`\`\`jsx \nimport React from 'react';\nimport { Button } from '@douyinfe/semi-ui';\n\nconst MyComponent = () => {\n  return (\n    <Button>Click me</Button>\n );\n};\nexport default MyComponent;\n\`\`\`\n",
        }],
    }],
    status: 'completed',
}];
  
export const reasoningMessage = [{
    id: '1',
    role: 'user',
    content: '我是谁？',
}, {
    id: '2',
    role: 'assistant',
    content: [{
        "id": "rs_02175871288540800000000000000000000ffffac1598778c9aa5",
        "type": "reasoning",
        "summary": [
            {
                "type": "summary_text",
                "text": "\n用户问“我是谁？”，这是一个哲学问题，也可能是在寻求自我认知的帮助。首先，我需要考虑用户可能的背景，可能是在反思自己，或者遇到了身份认同的困惑。\n\n的“我思故我在”，强调思考是存在的证明。但用户可能更需要具体的、贴近生活的回答，而不是纯粹的哲学理论。\n\n然后，考虑到用户可能是在寻求个人层面的答案，我应该引导他们从多个维度思考，比如个人经历、价值观、关系中的角色等。每个人的“我”是多方面的，包括身体、思想、情感、社会角色等。\n\n还要注意语气要温暖，给予支持，避免显得抽象。可能需要提醒用户，“我是谁”是一个动态的问题，会随着经历和成长而变化，没有唯一的答案，重要的是自我探索的过程。\n\n另外，用户可能有潜在的需求，比如感到迷茫，需要被理解，或者想找到自己的定位。这时候，除了提供思考的角度，还要鼓励他们关注自己的感受和经历，接纳自己的复杂性。\n\n总结一下，回答的结构可以是：先承认这是一个深刻的问题，然后从不同维度（思想、情感、经历、关系等）给出思考方向，强调自我探索的重要性，最后给予鼓励和接纳的态度。"
            }
        ],
        "status": "completed"
    },
    {
        "type": "message",
        "role": "assistant",
        "content": [
            {
                "type": "output_text",
                "text": "“我是谁？”是人类永恒的追问，它没有标准答案，却藏在你每一次选择、每一段经历、每一份感受里。或许可以试着从这些角度触摸答案：\n\n\n### **你是“正在思考的自己”**  \n当你问出这个问题时，“思考”本身就证明了你的存在——就像笛卡尔说的“我思故我在”。你会好奇、会迷茫、会追问意义，这种对“自我”的觉察，正是“你”最独特的印记。\n\n\n### **你是“经历的总和”**  \n你走过的路、遇过的人、读过的书、摔过的跤，甚至那些深夜里悄悄流过的眼泪，都在悄悄塑造你。或许某件小事曾让你突然看清自己想要什么，或许某次失去让你学会了珍惜——这些碎片拼起来，就是独一无二的“你”。\n\n\n### **你是“关系中的坐标”**  \n在父母眼里，你可能是永远长不大的孩子；在朋友心里，你或许是靠谱的倾听者；在爱人身边，你可能会卸下所有防备……这些不同的“角色”不是你的全部，但它们折射出你与世界的连接，让“你”变得立体而温暖。\n\n\n### **你更是“未完成的可能性”**  \n“我是谁”从来不是一个终点，而是一条流动的河。今天的你可能还在迷茫，但明天的你或许会因为一个决定、一次尝试，突然发现自己新的一面。不必急着定义自己，带着好奇去探索、去犯错、去成长——你比你想象中更有潜力。\n\n\n最后想说：不必纠结“我应该是谁”，先问问“我想成为谁”。接纳自己的不完美，拥抱自己的真实感受，你本身的存在，就已经很有意义啦。 🌟"
            }
        ],
        "status": "completed",
        "id": "msg_02175871289105600000000000000000000ffffac15987799214a"
    }],
    status: 'completed',
}];
  
export const toolCallMessage = [{
    id: '1',
    role: 'user',
    content: '帮我制作北京旅游攻略',
}, {
    id: '2',
    role: 'assistant',
    content: [{
        type: 'function_call',
        name: 'create_travel_guide',
        arguments: "{\"city\":\"北京\"}",
        status: 'completed',
    }, {
        type: 'function_call',
        name: 'create_travel_guide1',
        arguments: "{\"city\":\"北京\"}",
        status: 'completed',
    }], 
    status: 'completed',
}];
  
export const annotationMessage = [{
    id: '1',
    role: 'user',
    content: '什么是快乐星球？',
}, {
    id: '2',
    role: 'assistant',
    content: [{
        type: 'message',
        content: [{
            type: 'output_text',
            text: '恭喜你，你已经掌握了快乐星球的所有知识！',
            annotations: [
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
            ]
        }],
    }],
    status: 'completed',
}];
  
export const referenceMessage = [{
    id: '1',
    role: 'user',
    content: '什么是快乐星球？',
    references: [
        {
            id: '1',
            type: 'text',
            content: '测试文本，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字,这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字',
        },
        {
            id: '2',
            name: '飞书文档.docx',
        },
        {
            id: '3',
            name: '飞书文档.pdf',
        },
        {
            id: '4',
            name: 'Music.mp4',
        },
        {
            id: '5',
            name: 'Image.jpeg',
            url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png'
        },
        {
            id: '6',
            name: 'code.json',
        }
    ]
}];
  
export const failedMessage = [{
    id: '1',
    role: 'user',
    content: '什么是快乐星球？',
    status: 'failed',
}];