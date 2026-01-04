
// select use reactNode as option label & onChangeWithObject is true
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

class TestDemo extends React.Component {
    constructor() {
        super();
        this.renderMaterialChoice = this.renderMaterialChoice.bind(this);
        this.renderDynamicChoice = this.renderDynamicChoice.bind(this);
    }

    renderMaterialChoice = val => {
        let options = [];
        switch (val) {
            case '美妆':
                options = ['面具', '眉毛', '美瞳', '眼妆', '唇部效果'];
                break;
            case '人脸变形' || '滤镜' || '染发':
                options = ['功能'];
                break;
            default:
                options = ['2D素材'];
                break;
        }
        return options.map(item => (
            <Form.Select.Option value={item} key={item}>
                {item}
            </Form.Select.Option>
        ));
    };

    renderDynamicChoice = val => {
        let options = [];

        if (val === '2D素材' || val === '面具' || val === '唇部效果') {
            options = ['静态', '动态'];
        } else {
            options = ['静态'];
        }
        return options.map(item => (
            <Form.Select.Option value={item} key={item}>
                {item}
            </Form.Select.Option>
        ));
    };

    render() {
        return (
            <Form onChange={v => console.log(v)} onSubmit={v => console.log(v)}>
                {({ formState }) => (
                    <>
                        <Form.Select
                            labelPosition="left"
                            labelWidth={100}
                            labelAlign="right"
                            field="type"
                            label="特效类型"
                            placeholder="请选择特效类型"
                            rules={[
                                {
                                    required: true,
                                    message: '内容不能为空',
                                },
                            ]}
                        >
                            <Form.Select.Option value="脸部贴纸">脸部贴纸</Form.Select.Option>
                            <Form.Select.Option value="前景贴纸">前景贴纸</Form.Select.Option>
                            <Form.Select.Option value="人手贴纸">人手贴纸</Form.Select.Option>
                            <Form.Select.Option value="人脸变形">人脸变形</Form.Select.Option>
                            <Form.Select.Option value="美妆">美妆</Form.Select.Option>
                            <Form.Select.Option value="滤镜">滤镜</Form.Select.Option>
                            <Form.Select.Option value="染发">染发</Form.Select.Option>
                            <Form.Select.Option value="猫脸贴纸">猫脸贴纸</Form.Select.Option>
                        </Form.Select>
                        <Form.Select
                            field="material"
                            label="素材类型"
                            placeholder="请选择素材类型"
                            rules={[
                                {
                                    required: true,
                                    message: '内容不能为空',
                                },
                            ]}
                        >
                            {this.renderMaterialChoice(formState.values.type)}
                        </Form.Select>

                        <Form.Select
                            field="dynamic"
                            label="静态/动态"
                            placeholder="请选择静/动态"
                            rules={[
                                {
                                    required: true,
                                    message: '内容不能为空',
                                },
                            ]}
                        >
                            {this.renderDynamicChoice(formState.values.material)}
                        </Form.Select>
                        <Button htmlType="submit">Submit</Button>
                        {/* <ComponentUsingFormState />  */}
                    </>
                )}
            </Form>
        );
    }
}