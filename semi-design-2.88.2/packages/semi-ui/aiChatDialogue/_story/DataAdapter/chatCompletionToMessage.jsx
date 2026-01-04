import React, { useState, useCallback, useEffect } from 'react';
import { AIChatDialogue, chatCompletionToMessage } from '../../../index';
import { CHAT_COMPLETION_DATA } from '../Data/ChatCompletionData';

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

export default function ChatCompletionToMessageDemo() {
    const [messages, setMessage] = useState(defaultMessages);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    // only need to test text, refusal, function_call, tool_calls
    useEffect(() => {
        const message = chatCompletionToMessage(CHAT_COMPLETION_DATA);
        setMessage([...defaultMessages, ...message]);
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