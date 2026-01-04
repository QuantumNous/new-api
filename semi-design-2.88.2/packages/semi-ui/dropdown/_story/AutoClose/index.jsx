import { Dropdown, Tag, Switch } from '@douyinfe/semi-ui';
import React, { useState } from 'react';

const log = console.log;

function Demo() {
    const [clickToHide, setClickToHide] = useState(true);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [visible, setVisible] = useState(false);

    return (
        <div style={{ margin: 50 }}>
            <div>
                <div>
                    <label>点击后是否自动关闭</label>
                    <Switch
                        checked={clickToHide}
                        onChange={v => {
                            setClickToHide(v);
                        }}
                    />
                </div>
                <Dropdown
                    clickToHide={clickToHide}
                    onVisibleChange={v => {
                        log('dropdown1 visible changed to: ', v);
                    }}
                    position={'bottomLeft'}
                    trigger="click"
                    render={
                        <Dropdown.Menu>
                            {[1, 2, 3].map(index => (
                                <Dropdown.Item key={index} onClick={() => log('Dropdown.Item closed: ', index)}>
                                    Menu Item {index}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    }
                >
                    <Tag>Click Me</Tag>
                </Dropdown>
            </div>
            <div>
                <div>
                    <label>手动控制点击选项后关闭</label>
                </div>
                <Dropdown
                    position={'bottomLeft'}
                    trigger="click"
                    visible={dropdownVisible}
                    onVisibleChange={v => {
                        log('dropdown2 visible changed to: ', v);
                        setDropdownVisible(v);
                    }}
                    render={
                        <Dropdown.Menu>
                            {[1, 2, 3].map(index => (
                                <Dropdown.Item key={index} onClick={() => setDropdownVisible(false)}>
                                    Menu Item {index}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    }
                >
                    <Tag>Click Me</Tag>
                </Dropdown>
            </div>
            <div>
                <div>
                    <label>完全控制浮层显隐</label>
                </div>
                <Dropdown
                    position={'bottomLeft'}
                    trigger="custom"
                    visible={visible}
                    onVisibleChange={v => {
                        log('dropdown3 visible changed to: ', v);
                        // setVisible(v);
                    }}
                    render={
                        <Dropdown.Menu>
                            {[1, 2, 3].map(index => (
                                <Dropdown.Item key={index} onClick={() => setVisible(false)}>
                                    Menu Item {index}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    }
                >
                    <Tag onClick={() => setVisible(!visible)}>Click Me</Tag>
                </Dropdown>
            </div>
            <div>
                <div>
                    <label>hover展示+选择选项后自动关闭</label>
                </div>
                <Dropdown
                    clickToHide
                    position={'bottomLeft'}
                    trigger="hover"
                    onVisibleChange={v => {
                        log('dropdown3 visible changed to: ', v);
                        // setVisible(v);
                    }}
                    render={
                        <Dropdown.Menu>
                            {[1, 2, 3].map(index => (
                                <Dropdown.Item key={index}>Menu Item {index}</Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    }
                >
                    <Tag>Hover Me</Tag>
                </Dropdown>
            </div>
        </div>
    );
}

export default Demo;
