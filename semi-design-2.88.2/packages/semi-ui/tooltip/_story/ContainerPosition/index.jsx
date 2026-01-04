import React from 'react';
import { Tooltip, Tag } from '../../../index';
import './index.scss';

function App() {
    return (
        <div>
            <Tooltip content="semi design" position="bottomRight">
                <Tag>hover</Tag>
            </Tooltip>
        </div>
    );
}

export default App;