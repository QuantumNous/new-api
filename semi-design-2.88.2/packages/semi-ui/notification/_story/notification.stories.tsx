import Demo from './Demo';
import React from 'react';
import { storiesOf } from '@storybook/react';

const stories = storiesOf('Notification', module);
stories.add('Notification', () => <Demo />);
