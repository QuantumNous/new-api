import React from "react";
import Divider from '../divider';
import ChatBox from './chatBox';
import type { CommonChatsProps } from "./interface";
import { cssClasses, strings } from "@douyinfe/semi-foundation/chat/constants";
import LocaleConsumer from "../locale/localeConsumer";
import { Locale } from "../locale/interface";
import { Toast } from '../index';

const { PREFIX_DIVIDER, PREFIX } = cssClasses;
const { ROLE } = strings;

interface ChatContentProps extends CommonChatsProps {}

const ChatContent = React.memo((props: ChatContentProps) => {
    const { chats, onMessageBadFeedback, onMessageCopy, mode,
        onChatsChange, onMessageDelete, onMessageGoodFeedback,
        onMessageReset, roleConfig, chatBoxRenderConfig, align,
        customMarkDownComponents, renderDivider, markdownRenderProps
    } = props;

    const [toast, contextHolder] = Toast.useToast();

    return (
        <>
            {chats.map((item, index) => {
                const lastMessage = index === chats.length - 1;
                return item.role === ROLE.DIVIDER ? (
                    renderDivider ? renderDivider(item) :
                    <Divider key={item.id} className={PREFIX_DIVIDER}>
                        <LocaleConsumer<Locale["Chat"]> componentName="Chat" >
                            {(locale: Locale["Chat"]) => locale['clearContext']}
                        </LocaleConsumer>
                    </Divider>) :
                    <ChatBox
                        previousMessage={index ? chats[index - 1] : undefined}
                        toast={toast}
                        align={align} 
                        mode={mode}
                        key={item.id} 
                        message={item}
                        roleConfig={roleConfig}
                        onMessageBadFeedback={onMessageBadFeedback}
                        onMessageCopy={onMessageCopy}
                        onChatsChange={onChatsChange}
                        onMessageDelete={onMessageDelete}
                        onMessageGoodFeedback={onMessageGoodFeedback}
                        onMessageReset={onMessageReset}
                        lastChat={lastMessage}
                        customMarkDownComponents={customMarkDownComponents}
                        chatBoxRenderConfig={chatBoxRenderConfig}
                        markdownRenderProps={markdownRenderProps}
                    />;
            })}
            <div className={`${PREFIX}-toast`}>{contextHolder as any}</div>
        </>
    );  
});

export default ChatContent;
