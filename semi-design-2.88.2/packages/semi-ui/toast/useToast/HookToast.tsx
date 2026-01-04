import React, { useState, useEffect } from 'react';
import Toast from '../toast';
import { ToastInstance } from '@douyinfe/semi-foundation/toast/toastFoundation';

interface HookToastProps extends ToastInstance{
    afterClose: (id: string) => void
}

const HookToast = ({ afterClose, ...config }: HookToastProps, ref: React.Ref<any>) => {
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
            afterClose(config.id);
        }
    }, [visible]);

    return visible ? (
        <Toast
            {...config}
            close={close}
        />
    ) : null;
};

export default React.forwardRef(HookToast);
