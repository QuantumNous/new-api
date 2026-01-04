import React, { useState, useLayoutEffect, useRef } from 'react';
import {
    Form,
    Toast,
    Button, Modal, TreeSelect, Row, Col, Avatar, Select as BasicSelect
} from '../../../index';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;

import { IconPlusCircle, IconMinusCircle } from '@douyinfe/semi-icons';

class ScrollToErrorDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            fields: Array.from({ length: 100 }, (v, i) => i + 1),
        };
        this.formApi = null;
        this.getFormApi = this.getFormApi.bind(this);
        this.validate = this.validate.bind(this);
        this.scrollToError = this.scrollToError.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    validate() {
        let begin = new Date().valueOf();
        let end, time;
        this.formApi
            .validate(['No22', 'No55', 'No88'])
            .then(values => {
                end = new Date().valueOf();
                time = (end - begin) / 1000;
                console.log(`validate用时:${ time }s`);
                // debugger
            })
            .catch(err => {
                end = new Date().valueOf();
                time = (end - begin) / 1000;
                console.log(`validate用时:${ time }s`);
                // debugger
            });
    }

    scrollToError(target) {
        // this.formApi.scrollToError({ field: `No${targetIndex}`});
        if (typeof target === 'string') {
            this.formApi.scrollToError({ field: target });
        } else if (typeof target === 'number') {
            this.formApi.scrollToError({ index: target });
        } else if (!target) {
            this.formApi.scrollToError();
        }
    }

    renderFields() {
        const { fields } = this.state;

        return fields.map(item => (
            <Form.Input
                key={`No${item}`}
                field={`No${item}`}
                rules={[
                    { required: true, message: 'required error' },
                    {
                        pattern: /^[a-zA-Z0-9_]+$/,
                        message: '限制输入字符为：a-z, A-Z, 0-9, _',
                    },
                ]}
            />
        ));
    }
    render() {
        let fields = this.renderFields();
        return (
            <Form getFormApi={this.getFormApi}>
                <div style={{ height: 500, overflow: 'scroll' }}>{fields}</div>
                <Button type='primary' onClick={this.validate}>validate</Button>
                <Button onClick={() => this.scrollToError(88)}>scrollTo 88 Error</Button>
                <Button onClick={() => this.scrollToError()}>scrollTo first Error</Button>
                <Button onClick={() => this.scrollToError('No55')}>scrollTo No55 Error</Button>
                <Button htmlType="reset">reset</Button>
                <Button htmlType="submit">submit</Button>
            </Form>
        );
    }
}

export { ScrollToErrorDemo };