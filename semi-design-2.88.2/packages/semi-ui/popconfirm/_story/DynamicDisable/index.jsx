import React, { useState } from 'react';
import { Popconfirm, Button, Switch } from '@douyinfe/semi-ui/';

export default function Demo({}) {
    const [disabled, setDisabled] = useState(false);

    return (
        <div>
            <div style={{ padding: 100 }}>
                <Popconfirm
                    disabled={disabled}
                    position="bottomLeft"
                    title="确定是否要保存此修改？"
                    content="此修改将不可逆"
                >
                    <Button>Save</Button>
                </Popconfirm>
                <div style={{ marginTop: 200 }}>
                    <label>是否禁用</label>
                    <Switch checked={disabled} onChange={v => setDisabled(v)} />
                </div>
            </div>
        </div>
    );
}
