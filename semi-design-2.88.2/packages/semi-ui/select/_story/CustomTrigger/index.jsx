import React from 'react';
import { Select, Button } from '../../../index';

const { Option } = Select;

export default function Demo() {
    return (
        <Select
            defaultValue="abc"
            style={{ width: 120 }}
            triggerRender={({ value }) => <Button>{value && value[0] && value[0].value}</Button>}
        >
            <Option value="abc">抖音</Option>
            <Option value="hotsoon">火山</Option>
            <Option value="pipixia" disabled>
                皮皮虾
            </Option>
            <Option value="xigua">西瓜视频</Option>
        </Select>
    );
}
