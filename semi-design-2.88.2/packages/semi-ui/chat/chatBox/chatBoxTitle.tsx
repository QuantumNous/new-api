import React, { useMemo, ReactNode, ReactElement } from 'react';
import { Message, Metadata, RenderTitleProps } from '../interface';
import { cssClasses } from '@douyinfe/semi-foundation/chat/constants';
const { PREFIX_CHAT_BOX } = cssClasses;

interface ChatBoxTitleProps {
    children?: ReactNode | undefined | any;
    role?: Metadata;
    message?: Message;
    customRenderFunc?: (props: RenderTitleProps) => ReactNode
}

const ChatBoxTitle = React.memo((props: ChatBoxTitleProps) => {
    const { role, message, customRenderFunc } = props;
    const title = useMemo(() => {
        return <span
            className={`${PREFIX_CHAT_BOX}-title`}
        >{role?.name}</span>;
    }, [role]);

    if (customRenderFunc && typeof customRenderFunc === 'function') {
        return customRenderFunc({
            role,
            message,
            defaultTitle: title
        }) as ReactElement;
    }
    return title;
});

export default ChatBoxTitle;
