import React from 'react';
import Demo from './Demo';
import { storiesOf } from '@storybook/react';

const stories = storiesOf('Slider', module);

stories.add('Slider', () => <Demo />);