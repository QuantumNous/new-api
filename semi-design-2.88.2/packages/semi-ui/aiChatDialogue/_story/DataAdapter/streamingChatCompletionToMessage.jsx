import React, { useState, useCallback, useEffect } from 'react';
import { AIChatDialogue, streamingChatCompletionToMessage } from '../../../index';
import { STREAMING_CHAT_COMPLETION_DATA } from '../Data/StreamingChatCompletion';

const defaultMessages = [{
    id: '1',
    role: 'user',
    content: '此处是用户的输入',
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

export default function StreamingChatCompletionToMessageDemo() {
    const [messages, setMessage] = useState(defaultMessages);
    const [state, setState] = useState();

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    let i = 1;

    useEffect(() => {
        // 以 100ms 为间隔，从 1 块逐步增加到全部块，模拟流式输出
        const total = STREAMING_CHAT_COMPLETION_DATA.length;

        const timer = setInterval(() => {
            if (i > total) {
                clearInterval(timer); 
                setState(null);
                return; 
            } 

            const slice = STREAMING_CHAT_COMPLETION_DATA.slice(0, i);
            const { messages: partial, state: nextState } = streamingChatCompletionToMessage(slice, state);
            setState(nextState);

            // 将合并后的消息映射转换为数组，并加上默认的用户消息
            const merged = [defaultMessages[0], ...partial];
            setMessage(merged);

            i += 1;
        }, 100);


        return () => clearInterval(timer);
    }, []);

    // const customRender = {
    //     "function_call": (item) => {
    //         return <div>custom render {item.name} {JSON.stringify(item.arguments)}</div>;
    //     },
    //     "input_text": (item, message) => {
    //         return <div className="user-text">{item.text}</div>;
    //     },
    //     "default": (item, message) => {
    //         return <div className="assistant-text">{item}</div>;
    //     }
    // };  
  
    return (
        <AIChatDialogue 
            align="leftRight"
            mode="bubble"
            chats={messages}
            roleConfig={roleConfig}
            onChatsChange={onChatsChange}
            // renderDialogueContentItem={customRender}
        />
    );
};