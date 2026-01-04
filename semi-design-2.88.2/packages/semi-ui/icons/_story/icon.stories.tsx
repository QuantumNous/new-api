import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { IconHome, IconLock, IconClear, IconTickCircle, IconTick, IconClose, IconCaretup, IconAIBellLevel2 } from '@douyinfe/semi-icons';
const stories = storiesOf('Icon', module);
stories.add('Icon', () => (
    <div>
        <div>
            <IconHome size="large" />
            <IconLock size="small" />
            <IconLock />
            <IconClear />
            <IconTickCircle />
            <IconTick />
            <IconClose />
            <IconCaretup />
        </div>
        <div
            style={{
                color: 'red',
            }}
        >
            <IconHome size="large" />
            <IconLock size="small" />
            <IconLock />
            <IconClear />
            <IconTickCircle />
            <IconTick />
            <IconClose />
            <IconCaretup />
        </div>
        <div
            style={{
                color: 'pink',
            }}
        >
            <IconHome size="large" />
            <IconLock size="small" />
            <IconLock />
            <IconClear />
            <IconTickCircle />
            <IconTick />
            <IconClose />
            <IconCaretup />
        </div>
    </div>
));
