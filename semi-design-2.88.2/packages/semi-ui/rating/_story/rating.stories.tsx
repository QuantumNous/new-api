import React from 'react';
import { storiesOf } from '@storybook/react';
import { Rating } from '../../index';

const stories = storiesOf('Rating', module);

stories.add('Rating', () => (
    <>
        <Rating allowClear allowHalf/>
    </>
));