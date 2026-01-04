import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import Button from '../index';
import Demo from './Demo';

const stories = storiesOf('Button', module);

stories.add('base', () => <Demo />);
