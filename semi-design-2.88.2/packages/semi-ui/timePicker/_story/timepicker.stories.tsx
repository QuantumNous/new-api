import React, { Component, useState } from 'react';
import { storiesOf } from '@storybook/react';

import TimePicker from '../index';

const stories = storiesOf('timePicker', module);

stories.add('default', () => {
    const Demo = () => {
        return (
            <div>
                <TimePicker type={'time'} size={'large'} defaultValue={'11:23:08'} />
            </div>
        );
    };

    return <Demo />;
});
