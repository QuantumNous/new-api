import React, { useState } from 'react';
import { storiesOf } from '@storybook/react';

import Modal from '../index';
import Button from '../../button';

const stories = storiesOf('Modal', module);

const DialogComponent = (props: any) => {
    const { maskClosable } = props;
    const [visible, setVisible] = useState(false);

    const handleOk = () => {
        setVisible(false);
    };

    const handleCancel = () => {
        setVisible(false);
    };

    return (
        <React.Fragment>
            <Button onClick={() => setVisible(true)}>show dialog</Button>
            <Button onClick={() => {
                let mod = Modal.info({
                    title: '123', maskClosable: !!maskClosable
                });
                mod.destroy();
            }}>静态调用</Button>
            <Modal title="对话框标题" visible={visible} onOk={handleOk} onCancel={handleCancel} {...props}>
                <input autoFocus />
                <p>basic modal</p>
                <Button onClick={handleCancel}>hide dialog</Button>
            </Modal>
        </React.Fragment >
    );
};

stories.add('模态框默认', () => <DialogComponent />);

stories.add('模态框-点击遮罩层不可关闭', () => <DialogComponent maskClosable={false} />);
