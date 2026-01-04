import * as React from 'react';
import Demo from './Demo';
import { storiesOf } from '@storybook/react';
const stories = storiesOf('Calendar', module);
stories.add('Calendar', () => <Demo />);