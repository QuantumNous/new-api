import React from 'react';
import Demo from './Demo';
import { storiesOf } from '@storybook/react';

const stories = storiesOf('Radio', module);

stories.add('Radio', () => <Demo />);