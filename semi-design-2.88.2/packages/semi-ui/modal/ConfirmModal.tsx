import React, { useState, useCallback } from 'react';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/modal/constants';
import Modal from './Modal';
import { isSemiIcon } from '../_utils';

import '@douyinfe/semi-foundation/modal/modal.scss';
import { ConfirmProps } from './confirm';

const ConfirmModal = (props: ConfirmProps) => {
    const [visible, setVisible] = useState<boolean>(true);
    const [confirmLoading, setConfirmLoading] = useState<boolean>();
    const [cancelLoading, setCancelLoading] = useState<boolean>();
    const { direction } = props;

    const { title, content, icon, type, onCancel, onOk, className, ...rest } = props;

    const handleOk = useCallback(
        (e: React.MouseEvent) => {
            const res = onOk && onOk(e);
            if (res && res.then) {
                setConfirmLoading(true);
                res.then(
                    (...args) => {
                        setVisible(false);
                        setConfirmLoading(false);
                    },
                    err => {
                        setConfirmLoading(false);
                    }
                );
            } else {
                setVisible(false);
            }
        },
        [onOk]
    );

    const handleCancel = useCallback(
        e => {
            const res = onCancel && onCancel(e);
            if (res && res.then) {
                setCancelLoading(true);
                res.then(
                    (...args) => {
                        setVisible(false);
                        setCancelLoading(false);
                    },
                    err => {
                        setCancelLoading(false);
                    }
                );
            } else {
                setVisible(false);
            }
        },
        [onCancel]
    );

    const confirmCls = `${cssClasses.DIALOG}-confirm`;
    const wrapperCls = cls(className, confirmCls, {
        [`${confirmCls}-rtl`]: direction === 'rtl',
    });
    const typeCls = cls(`${cssClasses.DIALOG}-${type}`);
    const iconNode = isSemiIcon(icon) ? React.cloneElement(icon as any, { className: `${confirmCls}-icon ${typeCls}-icon`, size: 'extra-large' }) : icon;
    const titleNode = title == null ? null : <span className={`${confirmCls}-title-text`}>{title}</span>;
    const contentCls = cls(`${confirmCls}-content`, {
        [`${confirmCls}-content-withIcon`]: props.icon,
    });
    return (
        <Modal
            className={wrapperCls}
            title={titleNode}
            confirmLoading={confirmLoading}
            cancelLoading={cancelLoading}
            onOk={handleOk}
            onCancel={handleCancel}
            icon={iconNode}
            visible={visible}
            {...rest}
        >
            <div className={contentCls} x-semi-prop="content">{content}</div>
        </Modal>
    );
};

export default ConfirmModal;
