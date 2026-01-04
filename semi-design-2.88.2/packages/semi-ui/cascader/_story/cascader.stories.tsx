import * as React from 'react';
import Demo from './Demo';
import { storiesOf } from '@storybook/react';

const stories = storiesOf('Cascader', module);
stories.add('Cascader', () => <Demo />);