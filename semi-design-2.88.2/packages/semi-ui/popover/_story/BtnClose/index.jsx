import React, { useState, useEffect, useMemo } from 'react';
import { Select, Popover, Tag, Button, Dropdown } from '@douyinfe/semi-ui';

const { Option } = Select;

const SelectSection = () => {
    useEffect(() => {
        console.log('SelectSection mounted');

        return () => {
            console.log('SelectSection unmounted');
        };
    }, []);

    return (
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
    );
};

function Demo() {
    const [popupVisible, setPopupVisible] = useState(false);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const cachedSelect = useMemo(() => <SelectSection />, []);

    return (
        <div style={{ margin: 50 }}>
            <Popover
                visible={popupVisible}
                onVisibleChange={v => setPopupVisible(v)}
                position={'bottomLeft'}
                content={(
                    <div style={{ padding: 20 }} id={'popup-container'}>
                        <p>123456</p>
                        <div>
                            <Button onClick={() => setPopupVisible(false)}>关闭浮层</Button>
                        </div>
                        {cachedSelect}
                        <div>
                            <Dropdown
                                trigger={'click'}
                                position={'bottomLeft'}
                                visible={dropdownVisible}
                                onVisibleChange={v => setDropdownVisible(v)}
                                getPopupContainer={() => document.querySelector('#popup-container')}
                                render={(
                                    <Dropdown.Menu>
                                        {[1, 2, 3].map(index => (
                                            <Dropdown.Item key={index} onClick={() => setDropdownVisible(false)}>
                                                Menu Item {index}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                )}
                            >
                                <Button>Click me</Button>
                            </Dropdown>
                        </div>
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
