import React, { useState } from 'react';
import { Icon, Radio, RadioGroup, Button } from '@douyinfe/semi-ui/';
import Popconfirm from '../..';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
export default function TypesConfirmDemo(props = {}) {
    const typeMap = {
        default: {
            okType: 'primary',
            cancelType: 'primary',
            icon: 'alert_triangle',
        },
        warning: {
            okType: 'warning',
            cancelType: 'warning',
            icon: (
                <Icon
                    style={{
                        color: 'var(--semi-color-warning)',
                    }}
                    type={<IconAlertTriangle />}
                    size="extra-large"
                />
            ),
        },
        danger: {
            okType: 'danger',
            cancelType: 'danger',
            icon: (
                <Icon
                    style={{
                        color: 'var(--semi-color-danger)',
                    }}
                    type={<IconAlertTriangle />}
                    size="extra-large"
                />
            ),
        },
        tertiary: {
            okType: 'tertiary',
            cancelType: 'tertiary',
            icon: (
                <Icon
                    style={{
                        color: 'var(--semi-color-tertiary)',
                    }}
                    type={<IconAlertTriangle />}
                    size="extra-large"
                />
            ),
        },
    };
    const keys = Object.keys(typeMap);
    const [type, setType] = useState('default');
    const [visible, _setVisible] = useState(true);

    const changeType = e => {
        const type = e && e.target && e.target.value;

        if (type && keys.includes(type)) {
            setType(type);
        }
    };

    const setVisible = visible => _setVisible(visible);

    const toggleVisible = () => setVisible(!visible);

    return (
        <div>
            <RadioGroup
                onChange={changeType}
                value={type}
                style={{
                    marginTop: 14,
                    marginBottom: 14,
                }}
            >
                {keys.map(key => (
                    <Radio key={key} value={key}>
                        <strong
                            style={{
                                color: `var(--semi-color-${key === 'default' ? 'primary' : key})`,
                            }}
                        >
                            {key}
                        </strong>
                    </Radio>
                ))}
            </RadioGroup>
            <div>
                <Popconfirm
                    {...typeMap[type]}
                    visible={visible}
                    onVisibleChange={setVisible}
                    trigger="custom"
                    title="确定是否要保存此修改？"
                    content="此修改将不可逆"
                >
                    <Button onClick={toggleVisible}>点击此处</Button>
                </Popconfirm>
            </div>
            <div
                style={{
                    marginTop: 320,
                }}
            >
                <Popconfirm
                    {...typeMap[type]}
                    showArrow
                    visible={visible}
                    onVisibleChange={setVisible}
                    trigger="custom"
                    title="确定是否要保存此修改？"
                    content="此修改将不可逆"
                >
                    <Button onClick={toggleVisible}>点击此处</Button>
                </Popconfirm>
            </div>
        </div>
    );
}
