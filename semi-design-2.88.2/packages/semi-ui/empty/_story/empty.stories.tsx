import * as React from 'react';
import { storiesOf } from '@storybook/react';

import Demo from './Demo';

const stories = storiesOf('Empty', module);

stories.add('Empty', () => <Demo />);
