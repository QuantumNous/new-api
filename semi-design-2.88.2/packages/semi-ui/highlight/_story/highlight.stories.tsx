import React from 'react';
import { storiesOf } from '@storybook/react';

import { Skeleton, Avatar, Button, ButtonGroup, Spin, Highlight } from '../../index';

const searchWords = ['do', 'dollar'];
const sourceString = 'aaa do dollar aaa';
const stories = storiesOf('Highlight', module);

const HighlightTag = () => (
    <h2>
        <Highlight
            component='span'
            sourceString='semi design connect designOps & devOps'
            searchWords={['semi']}
        />
    </h2>
);

stories.add('List', () => (<HighlightTag></HighlightTag>));