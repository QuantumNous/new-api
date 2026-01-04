import * as React from 'react';
import { storiesOf } from '@storybook/react';

import Demo from './Demo';

const stories = storiesOf('Badge', module);

stories.add('Badge', () => <Demo />);
