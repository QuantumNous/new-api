import React, { useState, useLayoutEffect } from 'react';
import { Form, Button, Icon, Row, Col, Modal } from '../../../index';

class ModalFormDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: false,
        };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.getFormApi = this.getFormApi.bind(this);
    }

    showDialog() {
        this.setState({ visible: true });
    }

    handleOk() {
        this.formApi
            .validate()
            .then(values => {
                console.log(values);
            })
            .catch(errors => {
                console.log(errors);
            });
    }

    handleCancel() {
        this.setState({ visible: false });
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        const { visible } = this.state;
        let message = '该项为必填项';
        return (
            <>
                <Button onClick={this.showDialog}>打开弹窗</Button>
                <Modal title="新建" visible={visible} onOk={this.handleOk} onCancel={this.handleCancel}>
                    <Form getFormApi={this.getFormApi}>
                        <Row>
                            <Col span={6}>
                                <Form.Select
                                    field="region"
                                    label="国家/地区"
                                    placeholder="请选择"
                                    style={{ width: 100 }}
                                    rules={[{ required: true, message }]}
                                >
                                    <Form.Select.Option value="China">中国</Form.Select.Option>
                                    <Form.Select.Option value="US">美国</Form.Select.Option>
                                    <Form.Select.Option value="Europe">欧洲</Form.Select.Option>
                                    <Form.Select.Option value="Japan">日本</Form.Select.Option>
                                </Form.Select>
                            </Col>
                            <Col span={18}>
                                <Form.Input field="owner" label="业务执行人" rules={[{ required: true, message }]} />
                            </Col>
                            <Col span={6}>
                                <Form.Select
                                    field="area"
                                    label="投放区域"
                                    placeholder="请选择"
                                    style={{ width: 100 }}
                                    rules={[{ required: true, message }]}
                                >
                                    <Form.Select.Option value="China">中国</Form.Select.Option>
                                    <Form.Select.Option value="US">美国</Form.Select.Option>
                                    <Form.Select.Option value="Europe">欧洲</Form.Select.Option>
                                    <Form.Select.Option value="Japan">日本</Form.Select.Option>
                                </Form.Select>
                            </Col>
                            <Col span={18}>
                                <Form.Input
                                    field="department"
                                    label="业务执行部门"
                                    rules={[{ required: true, message }]}
                                />
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            </>
        );
    }
}

export { ModalFormDemo };