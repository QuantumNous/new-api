import React, { useMemo, useEffect, ReactElement } from 'react';
import cls from 'classnames';
import type { ChatBoxProps } from '../interface';
import ChatBoxAvatar from './chatBoxAvatar';
import ChatBoxTitle from './chatBoxTitle';
import ChatBoxContent from './chatBoxContent';
import ChatBoxAction from './chatBoxAction';
import { cssClasses, strings } from '@douyinfe/semi-foundation/chat/constants';

const { PREFIX_CHAT_BOX } = cssClasses;
const { ROLE, CHAT_ALIGN } = strings;

const ChatBox = React.memo((props: ChatBoxProps) => {
    const { message, lastChat, align, toast, mode,
        roleConfig, 
        onMessageBadFeedback, 
        onMessageGoodFeedback,
        onMessageCopy, 
        onChatsChange,
        onMessageDelete,
        onMessageReset,
        chatBoxRenderConfig = {}, 
        customMarkDownComponents,
        previousMessage,
        markdownRenderProps
    } = props;
    const { renderChatBoxAvatar, renderChatBoxAction, 
        renderChatBoxContent, renderChatBoxTitle,
        renderFullChatBox
    } = chatBoxRenderConfig;

    const continueSend = useMemo(() => {
        return message?.role === previousMessage?.role;
    }, [message.role, previousMessage]);

    const info = useMemo(() => {
        let info = {};
        if (roleConfig) {
            info = roleConfig[message.role] ?? {};
        }
        return info;
    }, [message.role, roleConfig]);

    const avatarNode = useMemo(() => {
        return (<ChatBoxAvatar
            continueSend={continueSend}
            role={info} 
            message={message}
            customRenderFunc={renderChatBoxAvatar}
        />);
    }, [info, message, renderChatBoxAvatar]);

    const titleNode = useMemo(() => {
        return (<ChatBoxTitle 
            role={info} 
            message={message}
            customRenderFunc={renderChatBoxTitle}
        />);
    }, [info, message, renderChatBoxTitle]);

    const contentNode = useMemo(() => {
        return (<ChatBoxContent
            mode={mode}
            role={info}
            message={message}
            customMarkDownComponents={customMarkDownComponents}
            customRenderFunc={renderChatBoxContent}
            markdownRenderProps={markdownRenderProps}
        />);
    }, [message, info, renderChatBoxContent, mode]);

    const actionNode = useMemo(() => {
        return (<ChatBoxAction 
            toast={toast}
            role={info} 
            message={message}
            lastChat={lastChat}
            onMessageBadFeedback={onMessageBadFeedback}
            onMessageCopy={onMessageCopy}
            onChatsChange={onChatsChange}
            onMessageDelete={onMessageDelete}
            onMessageGoodFeedback={onMessageGoodFeedback}
            onMessageReset={onMessageReset}
            customRenderFunc={renderChatBoxAction}
        />);
    }, [message, info, lastChat, onMessageBadFeedback, onMessageGoodFeedback, onMessageCopy, onChatsChange, onMessageDelete, onMessageReset, renderChatBoxAction]);

    const containerCls = useMemo(() => cls(PREFIX_CHAT_BOX, {
        [`${PREFIX_CHAT_BOX}-right`]: message.role === ROLE.USER && align === CHAT_ALIGN.LEFT_RIGHT,
    }
    ), [message.role, align]);

    if (typeof renderFullChatBox !== 'function') {
        return (<div
            className={containerCls}
        >
            {avatarNode}
            <div
                className={`${PREFIX_CHAT_BOX}-wrap`}
            >
                {!continueSend && titleNode}
                {contentNode}
                {actionNode}
            </div>
        </div>);
    } else {
        return renderFullChatBox({
            message,
            role: info,
            defaultNodes: {
                avatar: avatarNode,
                title: titleNode,
                content: contentNode,
                action: actionNode,
            },
            className: containerCls
        }) as ReactElement;
    }
});

export default ChatBox;
