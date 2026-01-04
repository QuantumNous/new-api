import React, { ReactElement, useRef } from 'react';
import getUuid from '@douyinfe/semi-foundation/utils/uuid';
import HookToast from './HookToast';
import { ToastInstance, ToastProps } from '@douyinfe/semi-foundation/toast/toastFoundation';
import { noop } from "lodash";

// const ref = null;
// TODO: toast larger than N bars, automatic folding, allowing expansion, N configurable

const defaultOpts = {
    motion: true,
    zIndex: 1010,
    duration: 3,
};

function usePatchElement(): [any, typeof patchElement] {
    const [elements, setElements] = React.useState([]);

    function patchElement(element: ReactElement, config: ToastInstance) {
        setElements(originElements => [{ element, config }, ...originElements]);

        return (id: string) => {
            setElements(originElements =>
                originElements.filter(({ config: configOfCurrentElement }) => configOfCurrentElement.id !== id));
        };
    }

    return [elements, patchElement];
}

export default function useToast() {
    const [elements, patchElement] = usePatchElement();
    const toastRef = useRef(new Map<string, { close: () => void }>());

    const addToast = (config: ToastProps) => {
        const id = getUuid('semi_toast_');
        const mergeConfig = {
            ...config,
            id,
        };
        let closeFunc: ReturnType<typeof patchElement>;

        const toast = (
            <HookToast
                {...mergeConfig}
                key={id}
                afterClose={instanceId => closeFunc(instanceId)}
                ref={(data: { close: () => void }) => {
                    toastRef.current.set(id, { close: data?.close ?? noop }); 
                }}
            />
        );
        closeFunc = patchElement(toast, { ...mergeConfig });
        return id;
    };

    const removeElement = (id: string) => {
        const { close } = toastRef.current.get(id) ?? {};
        close?.(); 
    };

    return [
        {
            success: (config: ToastProps) => addToast({ ...defaultOpts, ...config, type: 'success' }),
            info: (config: ToastProps) => addToast({ ...defaultOpts, ...config, type: 'info' }),
            error: (config: ToastProps) => addToast({ ...defaultOpts, ...config, type: 'error' }),
            warning: (config: ToastProps) => addToast({ ...defaultOpts, ...config, type: 'warning' }),
            open: (config: ToastProps) => addToast({ ...defaultOpts, ...config, type: 'default' }),
            close: (id: string) => removeElement(id)
        },
        <>
            {
                Array.isArray(elements) && elements.length ?
                    <>{elements.map(item => item.element)}</> :
                    null
            }
        </>,
    ];
}
