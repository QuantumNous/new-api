import React, { useMemo, ReactNode, ReactElement } from 'react';
import Avatar from '../../avatar';
import { Message, Metadata, RenderAvatarProps } from '../interface';
import { cssClasses } from '@douyinfe/semi-foundation/chat/constants';
import cls from 'classnames';

const { PREFIX_CHAT_BOX } = cssClasses;

interface ChatBoxAvatarProps {
    children?: string;
    role?: Metadata;
    continueSend?: boolean;
    message?: Message;
    customRenderFunc?: (props: RenderAvatarProps) => ReactNode
}

const ChatBoxAvatar = React.memo((props: ChatBoxAvatarProps) => {
    const { role, customRenderFunc, continueSend, message } = props;

    const node = useMemo(() => {
        const { avatar, color } = role;
        return (<Avatar
            className={cls(`${PREFIX_CHAT_BOX}-avatar`,
                {
                    [`${PREFIX_CHAT_BOX}-avatar-hidden`]: continueSend
                })}
            src={avatar}
            size="extra-small"
        >
        </Avatar>);
    }, [role]);

    if (customRenderFunc && typeof customRenderFunc === 'function') {
        return customRenderFunc({
            role, 
            defaultAvatar: node,
            message: message
        }) as ReactElement;
    }
    return node;
});

export default ChatBoxAvatar;

