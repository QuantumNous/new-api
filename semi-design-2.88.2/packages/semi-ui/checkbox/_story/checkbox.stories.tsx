import * as React from 'react';
import { storiesOf } from '@storybook/react';

import Demo from './Demo';

const stories = storiesOf('Checkbox', module);

stories.add('Checkbox', () => <Demo />);
