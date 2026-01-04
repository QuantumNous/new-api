/* argus-disable unPkgSensitiveInfo */
import React, { useState } from 'react';
import { Button, UserGuide, Toast, Tag, Switch, SideSheet } from '@douyinfe/semi-ui/index';

export default {
    title: 'UserGuide',
};

export const BasicUsage = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Button onClick={() => setVisible(true)}>显示引导</Button>
            <div className="step-1">第一步目标</div>
            <div className="step-2">第二步目标</div>
            <UserGuide
                mode="popup"
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        title: "第一步",
                        description: "这是第一步的说明",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        title: "第二步",
                        description: "这是第二步的说明",
                        position: "right"
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
        />
        </div>
    );
};

