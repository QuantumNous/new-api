import React from 'react';
import { Popover, Select } from '../../../index';

class SafariDemo extends React.Component {
    constructor() {
        super();
    }

    render() {
        return (
            <div style={{ height: 500 }}>
                <Select defaultValue='abc' style={{ width: 120, marginTop: 480 }}>
                    <Select.Option value='abc'>抖音</Select.Option>
                    <Select.Option value='hotsoon'>火山</Select.Option>
                    <Select.Option value='pipixia' disabled>皮皮虾</Select.Option>
                    <Select.Option value='xigua'>西瓜视频</Select.Option>
                </Select>
            </div>
        );
    }
}

export default SafariDemo;