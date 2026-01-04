import React, { useState, useCallback } from 'react';
import { AIChatDialogue } from '../../../index';

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

const defaultMessages = [
    {
        id: '1',
        role: 'user',
        content: '你好，我想开发一个多 Agent 场景下的聊天应用，你能帮我设计一下吗？',
    },
    {
        id: '2',
        role: 'assistant',
        name: 'PM',
        content: `收到。为保证方案可落地，我先明确目标与范围：\n\n- 目标：支持多 Agent 协同回复，用户可选择 Agent 或由系统自动分配\n- MVP 功能：\n  1) 基础对话（文本/图片/文件）\n  2) Agent 身份标识与头像\n  3) 正在输入与流式输出\n  4) 引用来源与工具结果展示\n- 约束：先做单会话，不做云端持久化；优先移动端适配\n\n接下来我会整理 PRD 要点并同步给设计与前端。`,
    },
    {
        id: '3',
        role: 'assistant',
        name: 'PM',
        content: `PRD 要点（摘要）：\n\n- 用户故事：作为用户，我可以向多个 Agent 提问，系统按职责路由并汇总答案\n- 关键流程：发送 -> Agent 路由 -> 工具调用 -> 汇总 -> 呈现引用与步骤\n- 质量指标：首条响应 < 2s，完整响应 < 8s；错误有可读的原因提示\n\nUI 先根据此摘要出信息架构与关键页面，我这边保持跟进评审。`,
    },
    {
        id: '4',
        role: 'assistant',
        name: 'UI',
        content: `设计初稿如下：\n\n- 信息架构：对话页（历史列表 | 消息流 | 工具卡片区）\n- 视觉：左侧展示 Agent 头像与名称标签，色块区分角色\n- 交互：\n  - 输入区支持 @Agent 快速切换与建议提示\n  - 流式输出时展示打字气泡与进度占位\n  - 工具结果以卡片/步骤条形式插入，可展开详情与复制\n\n我先出低保真线框，稍后补高保真与动效说明。`,
    },
    {
        id: '5',
        role: 'assistant',
        name: 'FE',
        content: `技术方案建议：\n\n- 技术栈：React + Semi UI，后端采用 WebSocket 或 SSE 支持流式响应\n- 数据模型：消息包含 id、role、name、content、status、references 等字段\n- 组件拆分：AIChatInput + AIChatDialogue；内容采用 Markdown 渲染，支持图片与文件点击\n- 性能：虚拟列表与滚动置底；长文本分块渲染；图片懒加载\n- 可观测性：埋点消息延迟、出错率、工具调用耗时\n\n若确认，我可先搭建页面骨架并接入 mock 数据进行联调。`,
    },
];

export default function MultiAssistant() {
    const [messages, setMessages] = useState(defaultMessages);

    const onChatsChange = useCallback((chats) => {
        setMessages(chats);
    }, []);

    return (
        <AIChatDialogue 
            roleConfig={roleConfig}
            align="leftRight"
            mode="bubble"
            chats={messages}
            onChatsChange={onChatsChange}
        />
    );
}