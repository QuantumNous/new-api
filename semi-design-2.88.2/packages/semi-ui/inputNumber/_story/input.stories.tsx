import React, { useRef, useState } from 'react';
import { storiesOf } from '@storybook/react';
import InputNumber from '../index';

const stories = storiesOf('InputNumber', module);

stories.add('default', () => {
    const Demo = () => {
        return (
            <div>
                <InputNumber defaultValue={123} />
            </div>
        );
    };

    return <Demo />;
});
