import React, { PropsWithChildren } from 'react';
import ConfirmModal from '../ConfirmModal';
import { ConfirmProps } from '../confirm';

interface HookModalProps {
    afterClose: (...args: any[]) => void;
    config: ConfirmProps
}

export interface HookModalRef {
    destroy: () => void;
    update: (newConfig: ConfirmProps) => void
}

const HookModal = ({ afterClose, config, ...props }: PropsWithChildren<HookModalProps>, ref: React.Ref<any>) => {
    const [innerConfig, setInnerConfig] = React.useState(config);

    React.useImperativeHandle(ref, () => ({
        destroy: () => {
            setInnerConfig(originConfig => ({
                ...originConfig,
                visible: false,
            }));
        },
        update: newConfig => {
            setInnerConfig(originConfig => ({
                ...originConfig,
                ...newConfig,
            }));
        },
    }));

    const mergeAfterClose = () => {
        config?.afterClose?.();
        afterClose();
    }; 
    return (
        <ConfirmModal
            {...innerConfig}
            afterClose={mergeAfterClose}
            // visible={!visible ? visible : undefined}
        />
    );
};

export default React.forwardRef<HookModalRef, HookModalProps>(HookModal);
