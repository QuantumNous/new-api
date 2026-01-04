import * as React from 'react';
import { storiesOf } from '@storybook/react';
import Demo from './Demo';
import Avatar from '../index';
import AvatarGroup from '../avatarGroup';

const stories = storiesOf('Avatar', module);

stories.add('Avatar', () => <Demo />);

stories.add('Avatar', () => <>
    <Avatar size={'6rem'} />
    <Avatar size="small" />
    <AvatarGroup size="6rem">
        <Avatar color="red" alt='Lisa LeBlanc'>LL</Avatar>
        <Avatar alt='Caroline Xiao'>CX</Avatar>
    </AvatarGroup>
</>);
