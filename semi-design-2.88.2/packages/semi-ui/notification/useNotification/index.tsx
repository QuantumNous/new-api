import React, { ReactElement, ReactNode, useState } from 'react';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/notification/constants';
import HookNotice from './HookNotice';
import '@douyinfe/semi-foundation/notification/notification.scss';
import getUuid from '@douyinfe/semi-foundation/utils/uuid';
import { NoticeInstance, NoticePosition, NoticeProps } from '@douyinfe/semi-foundation/notification/notificationFoundation';
import { NoticesInPosition } from '../';
// TODO: Automatic folding + unfolding function when there are more than N

const defaultConfig = {
    duration: 3,
    position: 'topRight' as NoticePosition,
    motion: true,
    content: '',
    title: '',
    zIndex: 1010,
};

function usePatchElement(): [ReactNode[], typeof patchElement] {
    const [elements, setElements] = useState([]);

    function patchElement(element: ReactElement, config: NoticeInstance) {
        setElements(originElements => [{ element, config }, ...originElements]);

        return (id: string) => {
            setElements(originElements => originElements.filter(({ config: configOfCurrentElement }) => configOfCurrentElement.id !== id));
        };
    }

    function renderList() {
        const noticesInPosition: NoticesInPosition = {
            top: [],
            topLeft: [],
            topRight: [],
            bottom: [],
            bottomLeft: [],
            bottomRight: [],
        };
        elements.forEach(({ element, config }) => {
            const { position } = config;
            noticesInPosition[position].push(element);
        });
        return Object.entries(noticesInPosition).map(obj => {
            const pos = obj[0];
            const notices = obj[1];
            // @ts-ignore
            // eslint-disable-next-line react/no-unknown-property
            return Array.isArray(notices) && notices.length ? <div key={pos} className={cls(cssClasses.LIST)} placement={pos}>{notices}</div> : null;
        });
    }

    return [
        renderList(),
        patchElement,
    ];
}

export default function useNotification() {
    const [elements, patchElement] = usePatchElement();
    const noticeRef = new Map<string, { close: () => void } & ReactElement>();

    const addNotice = (config: NoticeProps) => {
        const id = getUuid('semi_notice_');
        const mergeConfig = {
            ...config,
            id,
        };
        let closeFunc: ReturnType<typeof patchElement>;
        const ref = (ele: { close: () => void } & ReactElement) => {
            noticeRef.set(id, ele);
        };
        const notice = <HookNotice key={id} {...mergeConfig} afterClose={(instanceID: string) => closeFunc(instanceID)} ref={ref} />;
        closeFunc = patchElement(notice, { ...mergeConfig });
        return id;
    };

    const removeElement = (instanceID: string) => {
        const ele = noticeRef.get(instanceID);
        ele && ele.close();
    };

    return [
        {
            success: (config: NoticeProps) => addNotice({ ...defaultConfig, ...config, type: 'success' }),
            info: (config: NoticeProps) => addNotice({ ...defaultConfig, ...config, type: 'info' }),
            error: (config: NoticeProps) => addNotice({ ...defaultConfig, ...config, type: 'error' }),
            warning: (config: NoticeProps) => addNotice({ ...defaultConfig, ...config, type: 'warning' }),
            open: (config: NoticeProps) => addNotice({ ...defaultConfig, ...config, type: 'default' }),
            close: removeElement,
        },
        <>{elements}</>,
    ];
}
