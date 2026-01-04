import React, { useState, useLayoutEffect } from 'react';
import { Form, Select } from '../../../index';
import { IconSemiLogo } from '@douyinfe/semi-icons';

const { Option } = Select;
class AssistComponent extends React.Component {

    render() {
        return (
            <>
                <Form
                    onChange={v => console.log(v)}
                    onSubmit={v => console.log(v)}
                    style={{
                        width: 600,
                    }}
                    labelPosition="left"
                    labelWidth={100}
                >
                    <Form.Input
                        field="特效名称"
                        style={{
                            width: 250,
                        }}
                        trigger="blur"
                        rules={[
                            {
                                required: true,
                            },
                        ]}
                    />
                    <Form.Select
                        style={{
                            width: 250,
                        }}
                        field="type"
                        label="特效类型"
                    >
                        <Option value="脸部贴纸">脸部贴纸</Option>
                        <Option value="前景贴纸">前景贴纸</Option>
                    </Form.Select>
                    <Form.ErrorMessage />
                    <Form.Slot
                        label={{
                            text: 'SlotA',
                            required: true,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%',
                            }}
                        >
                            我是Semi Form SlotA, 我是自定义的ReactNode
                        </div>
                    </Form.Slot>
                    <Form.Slot label="string Label">
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%',
                            }}
                        >
                            我是一个传string label的slot
                        </div>
                    </Form.Slot>
                    <Form.Slot label={<IconSemiLogo />}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%',
                            }}
                        >
                            我是一个传ReactNode label的slot
                        </div>
                    </Form.Slot>
                    <Form.Slot label={<IconSemiLogo />} error={'我是slot的错误信息'}>
                        <div>我是一个带error的slot</div>
                    </Form.Slot>
                    <Form.Slot
                        label={{
                            text: 'SlotB',
                            width: 170,
                            align: 'right',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '100%',
                            }}
                        >
                            我是Semi Form SlotB, 我的Label Align、Width与众不同
                        </div>
                    </Form.Slot>
                </Form>
                <Form.Slot
                    label={{
                        text: 'SlotB',
                        width: 170,
                        align: 'right',
                        extra: 'se',
                        required: true,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                        }}
                    >
                        我是Slot，我并没有被Form包裹，我是单独使用的
                    </div>
                </Form.Slot>
            </>
        );
    }
}

export { AssistComponent };
