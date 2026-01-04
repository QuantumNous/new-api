import React from 'react';
import { storiesOf } from '@storybook/react';
import Progress from '../index';

const stories = storiesOf('Progress', module);

stories.add('Progress default', () => (
    <>
        <Progress direction='horizontal' percent={50} />
    </>
));
