import React, { useMemo, ReactNode, ReactElement } from 'react';
import { RenderAvatarProps } from '../interface';
import Avatar from '../../avatar';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import cls from 'classnames';

const { PREFIX } = cssClasses;

interface DialogueAvatarProps extends RenderAvatarProps {
    continueSend?: boolean;
    customRenderFunc?: (props: RenderAvatarProps) => ReactNode
}

const DialogueAvatar = React.memo((props: DialogueAvatarProps) => {
    const { role, customRenderFunc, continueSend, message } = props;

    const node = useMemo(() => {
        const { avatar } = role;
        return (<Avatar
            className={cls(`${PREFIX}-avatar`,
                {
                    [`${PREFIX}-avatar-hidden`]: continueSend
                })}
            src={avatar}
            size="extra-small"
        >
        </Avatar>);
    }, [continueSend, role]);

    if (customRenderFunc && typeof customRenderFunc === 'function') {
        return customRenderFunc({
            role, 
            defaultAvatar: node,
            message: message
        }) as ReactElement;
    }
    return node;
});

export default DialogueAvatar;