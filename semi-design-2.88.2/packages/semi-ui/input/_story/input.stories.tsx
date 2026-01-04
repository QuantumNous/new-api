import * as React from 'react';
import { storiesOf } from '@storybook/react';

import Demo from './Demo';
import TextareaDemo from './TextareaDemo';

const stories = storiesOf('Input', module);
const textareaStories = storiesOf('Textarea', module);
textareaStories.add('Textarea', () => <TextareaDemo />);

stories.add('input', () => <Demo />);
