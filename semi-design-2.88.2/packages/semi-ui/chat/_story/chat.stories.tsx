import React, { useState, useCallback, } from 'react';
import { storiesOf } from '@storybook/react';
import Chat from '@douyinfe/semi-ui/chat';
import { getUuidv4 } from '@douyinfe/semi-foundation/utils/uuid';
import { initMessage, roleInfo, commonOuterStyle, hintsExample } from './constant';


const stories = storiesOf('Chat', module);

stories.add('Chat 对话', () => {
    const [message, setMessage] = useState(initMessage);
    const [hints, setHints] = useState(hintsExample);

    const onClear = useCallback(() => {
       console.log('onClear');
       setHints([]);
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newUserMessage = {
            role: 'user',
            id: getUuidv4(),
            content: content,
            attachment: attachment,
        }
        const newAssistantMessage = {
            role: 'assistant',
            id: getUuidv4(),
            content: "这是一条 mock 回复信息",
        }
        setMessage((message) => {
            return [
                ...message,
                newUserMessage,
                newAssistantMessage
            ] as any
        })
    }, []);

    const onMessageDelete = useCallback((message) => {
       console.log('message delete', message);
    }, []);

    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onMessageGoodFeedback = useCallback((message) => {
        console.log('message good feedback', message);
    }, []);

    const onMessageBadFeedback = useCallback((message) => {
        console.log('message bad feedback', message);
    }, []);

    const onMessageReset = useCallback((message) => {
        console.log('message reset', message);
    }, []);

    const onInputChange = useCallback((props) => {
        console.log('onInputChange', props);
    }, []);

    const onHintClick = useCallback((hint) => {
        setHints([]);
    }, []);

    return (
        <div
            style={{ height: 600}}
        >
            <Chat 
                style={commonOuterStyle}
                chats={message}
                hints={hints}
                roleConfig={roleInfo}
                onClear={onClear}
                onMessageSend={onMessageSend}
                onMessageDelete={onMessageDelete}
                onMessageGoodFeedback={onMessageGoodFeedback}
                onMessageBadFeedback={onMessageBadFeedback}
                onChatsChange={onChatsChange}
                onMessageReset={onMessageReset}
                onInputChange={onInputChange}
                onHintClick={onHintClick}
            />
        </div>
    )
});
