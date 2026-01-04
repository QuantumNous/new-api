import React, { useState } from 'react';
import { Radio, RadioGroup, Button, Switch } from '@douyinfe/semi-ui/';
import Popconfirm from '../..';

const defaultTitle = '确定是否要保存此修改？';
const defaultContent = '此修改将不可逆';

function Demo(props = {}) {
    const [visible, _setVisible] = useState(true);
    const [showCloseIcon, _setShowCloseIcon] = useState(true);

    const setVisible = visible => _setVisible(visible);

    const toggleVisible = () => setVisible(!visible);

    const toggleCloseIconState = () => _setShowCloseIcon(!showCloseIcon);

    return (
        <div>
            <div>
                <div>展示close图标</div>
                <Switch checked={showCloseIcon} onChange={toggleCloseIconState} />
            </div>
            <div
                style={{
                    margin: 20,
                }}
            >
                <Popconfirm
                    onVisibleChange={setVisible}
                    showCloseIcon={showCloseIcon}
                    title={defaultTitle}
                    content={defaultContent}
                    arrowPointAtCenter
                    showArrow
                >
                    <Button onClick={toggleVisible}>点击</Button>
                </Popconfirm>
            </div>
        </div>
    );
}

export default Demo;
