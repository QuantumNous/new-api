import React from 'react';
import Toast from '../index';
import Button from '../../button/index';

const Demo: React.FunctionComponent = () => (
    <div>
        <Button onClick={(): string => Toast.info('info')}>
            Info
        </Button>
        <Button onClick={(): string => Toast.success('success')}>
            Success
        </Button>
        <Button onClick={(): string => Toast.warning('warning')}>
            Warning
        </Button>
        <Button onClick={(): string => Toast.error('error')}>
            Error
        </Button>
    </div>
);

export default Demo;
