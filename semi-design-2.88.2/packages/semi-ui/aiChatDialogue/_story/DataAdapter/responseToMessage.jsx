import React, { useState, useCallback, useEffect } from 'react';
import { AIChatDialogue, responseToMessage } from '../../../index';
import { RESPONSE_DATA } from '../Data/ResponseData';

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

export default function ResponseToMessageDemo() {
    const [messages, setMessage] = useState(defaultMessages);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    useEffect(() => {
        const responseMessage = responseToMessage(RESPONSE_DATA);

        setMessage([...defaultMessages, responseMessage]);
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