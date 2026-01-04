import React from 'react';
import Demo from './Demo';
import { storiesOf } from '@storybook/react';

const stories = storiesOf('Toast', module);

stories.add('Toast', () => <Demo />);