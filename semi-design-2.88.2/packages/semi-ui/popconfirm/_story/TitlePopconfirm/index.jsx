import React, { useState } from 'react';
import { Icon, Radio, RadioGroup, Button, ButtonGroup, Switch } from '@douyinfe/semi-ui/';
import Popconfirm from '../..';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
const defaultTitle =
    '确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？';
const defaultContent =
    '此修改将不可逆此修改将不可逆此修改将不可逆此修改将不可逆此修改将不可逆此修改将不可逆此修改将不可逆此修改将不可逆此修改将不可逆';
const typeMap = {
    default: {
        okType: 'primary',
        cancelType: 'primary',
        icon: <IconAlertTriangle />,
    },
    warning: {
        okType: 'warning',
        cancelType: 'warning',
        icon: (
            <IconAlertTriangle
                style={{
                    color: 'var(--semi-color-warning)',
                }}
                size="extra-large"
            />
        ),
    },
    danger: {
        okType: 'danger',
        cancelType: 'danger',
        icon: (
            <IconAlertTriangle
                style={{
                    color: 'var(--semi-color-danger)',
                }}
                size="extra-large"
            />
        ),
    },
    tertiary: {
        okType: 'tertiary',
        cancelType: 'tertiary',
        icon: (
            <IconAlertTriangle
                style={{
                    color: 'var(--semi-color-tertiary)',
                }}
                size="extra-large"
            />
        ),
    },
};

function Demo(props = {}) {
    const keys = Object.keys(typeMap);
    const [type, setType] = useState('default');
    const [title, setTitle] = useState(defaultTitle);
    const [content, setContent] = useState(defaultContent);
    const [icon, setIcon] = useState(typeMap[type].icon);
    const [visible, _setVisible] = useState(true);

    const changeType = e => {
        const type = e && e.target && e.target.value;

        if (type && keys.includes(type)) {
            setType(type);
        }
    };

    const setVisible = visible => _setVisible(visible);

    const toggleVisible = () => setVisible(!visible);

    const toggleTitle = () => setTitle(title ? null : defaultTitle);

    const toggleContent = () => setContent(content ? null : defaultContent);

    const toggleIcon = () => setIcon(icon ? null : typeMap[type].icon);

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
                <label>展示title</label>
                <Switch checked={Boolean(title)} onChange={toggleTitle} />
            </div>
            <div>
                <label>展示content</label>
                <Switch checked={Boolean(content)} onChange={toggleContent} />
            </div>
            <div>
                <label>展示icon</label>
                <Switch checked={Boolean(icon)} onChange={toggleIcon} />
            </div>
            <div>
                <Popconfirm
                    {...typeMap[type]}
                    icon={icon}
                    visible={visible}
                    onVisibleChange={setVisible}
                    trigger="custom"
                    title={title}
                    content={content}
                >
                    <Button onClick={toggleVisible}>点击此处</Button>
                </Popconfirm>
            </div>
        </div>
    );
}

export default Demo;
