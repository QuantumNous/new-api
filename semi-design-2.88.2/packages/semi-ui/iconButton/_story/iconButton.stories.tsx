import * as React from 'react';
import { storiesOf } from '@storybook/react';

import IconButton from '../index';

const stories = storiesOf('IconButton', module);

stories.add(`IconButton`, () => (
    <div>
        <IconButton icon={'user'} />
        <IconButton icon={'delete'} />
        <IconButton icon={'apps'} />
        <IconButton icon={'camera'} type={'tertiary'} />
        <IconButton icon={'globe'} theme={'solid'} />
    </div>
));
