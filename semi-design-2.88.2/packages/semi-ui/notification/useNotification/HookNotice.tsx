import React, { useState, useEffect } from 'react';
import Notice from '../notice';
import { NoticeInstance } from '@douyinfe/semi-foundation/notification/notificationFoundation';

export interface HookNoticeProps extends NoticeInstance{
    afterClose: (id: string) => void
}

const HookNotice = ({ afterClose, ...config }: HookNoticeProps, ref: React.Ref<any>) => {
    const [visible, setVisible] = useState(true);

    const close = () => {
        setVisible(false);
    };

    React.useImperativeHandle(ref, () => ({
        close: () => {
            setVisible(false);
        }
    }));

    useEffect(() => {
        if (!visible) {
            afterClose(String(config.id));
        }
    }, [visible]);

    return visible ? (
        <Notice
            {...config}
            onHookClose={close}
        />
    ) : null;
};

export default React.forwardRef(HookNotice);
