import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Tabs, TabPane, Badge } from '@douyinfe/semi-ui';
import {
    Form,
    useFormState,
    useFormApi,
    useFieldApi,
    useFieldState,
    withFormState,
    withFormApi,
    withField,
    ArrayField
} from '../../index';

import {
    UseFormApiDemo,
    UseFormStateDemo,
    UseFieldApiDemo,
    UseFieldStateDemo,
    WithFormStateDemo,
    WithFormApiDemo,
    ComponentUsingFormState,
    CustomStringify
} from '../Hook/hookDemo';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker } = Form;


class HelpAndExtra extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            helpText: '密码建议包含大小写字母，中英文数字，以及特殊字符',
            validateStatus: 'default'
        };
        this.formApi = null;
        this.getFormApi = this.getFormApi.bind(this);
        this.validate = this.validate.bind(this);
        this.random = this.random.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    validate(val, values) {
        if (!val) {
            this.setState({ validateStatus: 'error' });
            return <span>密码不能为空</span>;
        } else if (val && val.length <= 3) {
            this.setState({
                helpText: <span style={{ color: 'var(--semi-color-warning)' }}>密码强度：弱</span>,
                validateStatus: 'warning'
            }); // show helpText
            return ''; // validate pass
        } else {
            this.setState({
                helpText: '',
                validateStatus: 'success'
            });
            return '';
        }
    }

    random() {
        let pw = (Math.random() * 100000).toString().slice(0, 5);
        this.formApi.setValue('password', pw);
    }

    render() {
        let { helpText, validateStatus } = this.state;
        return (
            <Form
                getFormApi={this.getFormApi}
                showValidateIcon={true}
                onSubmit={value => console.log('submit success')}
                onSubmitFail={errors => console.log(errors)}
            >
                <Form.Input
                    validate={this.validate}
                    field="password"
                    validateStatus={validateStatus}
                    helpText={helpText}
                    extraText={(
                        <div
                            style={{
                                color: 'rgba(var(--semi-blue-5), 1)',
                                fontSize: 14,
                                userSelect: 'none',
                                cursor: 'pointer'
                            }}
                            onClick={this.random}>
                            没有想到合适的密码？点击随机生成一个
                        </div>
                    )}
                />
                <Button htmlType="submit">Submit</Button>
            </Form>
        );
    }
}

const ExtraPositionDemo = () => {
    const helpText = <span style={{ color: 'var(--semi-color-warning)' }}>密码强度：弱</span>;
    return (
        <Form extraTextPosition="middle">
            <Form.Input
                field="a"
                label="extraTextPosition-middle: reactNode"
                helpText={helpText}
                // extraTextPosition='middle'
                extraText={(
                    <div style={{
                        color: 'rgba(var(--semi-blue-5), 1)',
                        fontSize: 14,
                        userSelect: 'none',
                        cursor: 'pointer'
                    }}
                    >
                        i am extra text
                    </div>
                )}
            />
            <Form.Input
                field="b"
                helpText={helpText}
                label="extraTextPosition-bottom: string"
                extraTextPosition="bottom"
                extraText={'i am extra text'}
            />
        </Form>
    );
};

export { HelpAndExtra, ExtraPositionDemo };