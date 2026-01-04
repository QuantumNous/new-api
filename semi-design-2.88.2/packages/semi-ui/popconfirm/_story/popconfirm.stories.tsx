import React, { useState } from 'react';
import { storiesOf } from '@storybook/react';

import Popconfirm from '../index';
import Button from '../../button';

const stories = storiesOf('popconfirm', module);

stories.add('simple', () => (
    <div>
        <div >
            <Popconfirm
                title="确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？"
                content="此修改将不可逆"
            >
                <Button>Delete</Button>
            </Popconfirm>
        </div>
    </div>
));