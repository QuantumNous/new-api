import React from 'react';
import Notification from '../index';
import Button from '../../button';

const Demo = () => {
    return (
        <div>
            <Button
                onClick={ () => Notification.info({
                    position: 'topRight',
                    content: 'semi-ui-notification',
                    title: 'Hi bytedance',
                })}>
                Basic Notification
            </Button>
            <Button
                onClick={ () => Notification.error({
                    position: 'bottom',
                    content: 'semi-ui-notification',
                    title: 'Hi bytedance',
                    showClose: false,
                })}>
                Can Not Close From Bottom
            </Button>
        </div>
    );
};

export default Demo;