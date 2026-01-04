import React, { useMemo, ReactElement, ReactNode } from 'react';
import { RenderTitleProps } from '../interface';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatDialogue/constants';

const { PREFIX } = cssClasses;

interface DialogueTitleProps extends RenderTitleProps {
    customRenderFunc?: (props: RenderTitleProps) => ReactNode
}

const DialogueTitle = React.memo((props: DialogueTitleProps) => {
    const { role, message, customRenderFunc } = props;
    const title = useMemo(() => {
        return <span className={`${PREFIX}-title`}>{role?.name}</span>;
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

export default DialogueTitle;
