import React from 'react';
import { storiesOf } from '@storybook/react';
import classNames from 'classnames';
import { optionRenderProps, RenderMultipleSelectedItemFn, RenderSingleSelectedItemFn } from '@douyinfe/semi-ui/select/index';
import { Checkbox } from '../../index';
import { Select, Avatar, Tag, Space } from '../../index';

const stories = storiesOf('Select', module);

let optionList = [
    { value: 'tony', label: 'Ironman' },
    { value: 'Thor', label: 'Thor' },
    { value: 'steve', label: 'Caption' },
    { value: 'peter', label: 'SpiderBoy' },
];

stories.add('Select', () => (
    <>
        <Select style={{ width: 200 }}>
            <Select.Option value="1"></Select.Option>
            <Select.Option value="2"></Select.Option>
        </Select>
    </>
));

const RenderOptionDemo = () => {
    const renderOptionItem = (renderProps: optionRenderProps) => {
        const {
            disabled,
            selected,
            label,
            value,
            focused,
            className,
            style,
            onMouseEnter,
            onClick,
            ...rest
        } = renderProps;

        const optionCls = classNames({
            ['custom-option-render']: true,
            ['custom-option-render-focused']: focused,
            ['custom-option-render-disabled']: disabled,
            ['custom-option-render-selected']: selected,
        });
        // Notice：
        // 1.props传入的style需在wrapper dom上进行消费，否则在虚拟化场景下会无法正常使用
        // 2.选中(selected)、聚焦(focused)、禁用(disabled)等状态的样式需自行加上，你可以从props中获取到相对的boolean值
        // 3.onMouseEnter需在wrapper dom上绑定，否则上下键盘操作时显示会有问题

        return (
            <div style={style} className={optionCls} onClick={(e) => onClick(e)} onMouseEnter={e => onMouseEnter(e)}>
                <Checkbox checked={selected} />
                <div className="option-right">{label}</div>
            </div>
        );
    };

    return (
        <Select
            filter
            dropdownClassName="components-select-demo-renderOptionItem"
            optionList={optionList}
            style={{ width: 300 }}
            renderOptionItem={renderOptionItem}
        />
    );
};

interface OptionNode {
    name: string;
    email: string;
    avatar: string;
}


function CustomRender(props) {
    const list = [
        {
            name: '夏可漫',
            email: 'xiakeman@example.com',
            avatar:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png',
        },
        {
            name: '申悦',
            email: 'shenyue@example.com',
            avatar:
                'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
        },
        {
            name: '曲晨一',
            email: 'quchenyi@example.com',
            avatar:
                'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/8bd8224511db085ed74fea37205aede5.jpg',
        },
        {
            name: '文嘉茂',
            email: 'wenjiamao@example.com',
            avatar:
                'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png',
        },
    ];

    const renderCustomOption = (item) => {
        let optionStyle = {
            display: 'flex',
            paddingLeft: 24,
            paddingTop: 10,
            paddingBottom: 10,
        };
        return (
            <Select.Option value={item.name} style={optionStyle} showTick={true} {...item} key={item.email}>
                <Avatar size="small" src={item.avatar} />
                <div style={{ marginLeft: 8 }}>
                    <div style={{ fontSize: 14 }}>{item.name}</div>
                    <div
                        style={{
                            color: 'var(--semi-color-text-2)',
                            fontSize: 12,
                            lineHeight: '16px',
                            fontWeight: 'normal',
                        }}
                    >
                        {item.email}
                    </div>
                </div>
            </Select.Option>
        );
    }

    const renderSelectedItem: RenderSingleSelectedItemFn = (optionNode: OptionNode): React.ReactNode => {
        return (
            <div key={optionNode.email} style={{ display: 'flex', alignItems: 'center' }}>
                <Avatar src={optionNode.avatar} size="small">
                    {optionNode.avatar}
                </Avatar>
                <span style={{ marginLeft: 8 }}>{optionNode.email}</span>
            </div>
        );
    }

    const renderMultipleWithCustomTag: RenderMultipleSelectedItemFn = (optionNode: OptionNode, { onClose  }) => {
        let content = (
            <Tag
                avatarSrc={optionNode.avatar}
                avatarShape="circle"
                closable={true}
                onClose={onClose}
                size="large"
                key={optionNode.name}
            >
                {optionNode.name}
            </Tag>
        );
        return {
            isRenderInTag: false,
            content,
        };
    }

    return (
        <Space>
            <Select
                style={{
                    width: 300,
                    height: 40,
                }}
                defaultValue={'夏可漫'}
                renderSelectedItem={renderSelectedItem}
            >
                {list.map(item => renderCustomOption(item))}
            </Select>
            <Select
                placeholder="请选择"
                maxTagCount={2}
                style={{ width: 280 }}
                onChange={v => console.log(v)}
                defaultValue={['夏可漫', '申悦']}
                multiple
                renderSelectedItem={renderMultipleWithCustomTag}
            >
                {list.map(item => renderCustomOption(item))}
            </Select>
        </Space>
    );
}

stories.add('自定义已选标签渲染', () => (
    <>
        <div>renderSelectedItem</div>
        <CustomRender />
    </>
));
