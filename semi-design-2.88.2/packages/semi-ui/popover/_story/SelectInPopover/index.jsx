import React from 'react';
import { Select, Popover, Tag } from '@douyinfe/semi-ui';

const { Option } = Select;

function Demo() {
    return (
        <div>
            <div style={{ width: 200, height: 2000, backgroundColor: 'gray' }}>区块1</div>
            <Popover
                content={(
                    <div style={{ padding: 20 }} id={'popup-container'}>
                        <p>123456</p>
                        <div />
                        <Select
                            defaultValue="abc"
                            style={{ width: 120 }}
                            getPopupContainer={() => document.querySelector('#popup-container')}
                        >
                            <Option value="abc">抖音</Option>
                            <Option value="hotsoon">火山</Option>
                            <Option value="pipixia" disabled>
                                皮皮虾
                            </Option>
                            <Option value="xigua">西瓜视频</Option>
                        </Select>
                    </div>
                )}
                trigger="click"
                showArrow
            >
                <Tag>点击此处</Tag>
            </Popover>
        </div>
    );
}

export default Demo;
