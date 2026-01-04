import React, { useState, useLayoutEffect, Component } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Toast, Select as BasicSelect,
    Form,
    useFormState,
    useFormApi,
    useFieldApi,
    useFieldState,
    withFormState,
    withFormApi,
    withField,
    ArrayField,
    AutoComplete,
    Collapse,
    Icon } from '../../../index';


import { ComponentUsingFormState } from '../Hook/hookDemo';
import Textarea from '../../../input/textarea';
const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker, InputNumber, InputGroup } = Form;


// Form level validate
class ValidateFieldsDemo extends Component {
    constructor() {
        super();
        this.syncValidate = this.syncValidate.bind(this);
        this.asyncValidate = this.asyncValidate.bind(this);
    }

    syncValidate(values) {
        const errors = {};
        if (values.name !== 'mike') {
            errors.name = 'you must name mike';
        }
        if (values.sex !== 'female') {
            errors.sex = 'must be woman';
            // errors.group = {};
            // errors.group.sort = '';
        }
        errors.familyName = [
            { before: 'before errror inject success ', after: 'after error inject success' },
            'familyName[1] error inject success'
        ];
        // // return '';
        return errors;
    }

    asyncValidate(values) {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        return sleep(2000).then(() => {
            let errors = {};
            if (values.name !== 'mike') {
                errors.name = 'you must name mike';
            }
            if (values.sex !== 'female') {
                errors.sex = 'sex not valid';
            }
            console.log(errors);
            return errors;

        });
    }

    render() {
        return (
            <>
                <h4 style={{ marginTop: 400 }}>同步校验</h4>
                <Form
                    autoScrollToError
                    validateFields={this.syncValidate}
                    onReset={v => console.log('reset')}
                    // onChange={v => console.log(v)}
                    onValueChange={(values, changedField) => console.log('onValueChange', values, changedField)}
                    onErrorChange={(errors, changedField) => console.log('onErrorChange', errors, changedField)}    
                >
                    <Form.InputGroup label="group" style={{ width: 600 }}>
                        <Input field="group.name" style={{ width: 280 }} />
                        <Input field="group.sort" style={{ width: 290 }} />
                    </Form.InputGroup>
                    <Input field="name" trigger="blur" />
                    <Input field="familyName[0].before" trigger="blur" />
                    <Input field="familyName[0].after" trigger="blur" />
                    <Input field="familyName[1]" trigger="blur" />
                    <Input field="sex" trigger="blur" />
                    <Button type="primary" htmlType="submit">
                        Submit
                    </Button>
                    <Button htmlType="reset">reset</Button>
                    <ComponentUsingFormState />
                </Form>
                <h4>异步校验</h4>
                <Form
                    autoScrollToError
                    validateFields={this.asyncValidate}
                    onReset={v => console.log('reset')}
                    onChange={v => console.log(v)}
                    onValueChange={v => console.log('onValueChange')}>
                    <Input field="name" trigger="blur" />
                    <Button type="primary" htmlType="submit">
                        Submit
                    </Button>
                    <Button htmlType="reset">reset</Button>
                    <ComponentUsingFormState />
                </Form>
            </>
        );
    }
}


// Field level
class CustomValidateDemo extends Component {
    constructor() {
        super();
        this.validateName = this.validateName.bind(this);
        this.asyncValidate = this.asyncValidate.bind(this);
    }

    validateName(val) {
        if (!val) {
            return '【sync】can\'t be empty';
        } else if (val.length <= 5) {
            return <span>我是传入的reactNode</span>;
        //     // return '【sync】must more than 5';
        }
        return;
    }

    asyncValidate(val, values) {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        return sleep(2000).then(() => {
            if (!val) {
                return '【async】can\'t be empty';
                // throw '【async】can\'t be empty';
            } else if (val.length <= 5) {
                return '【async】must more than 5';
                // throw '【async】must more than 5';
            } else {
                return;
            }
        });
    }

    render() {
        return (
            <Form
                autoScrollToError
                onErrorChange={(errors, changedField) => console.log(errors, changedField)}
            >
                <Input field="name" validate={this.asyncValidate} trigger="blur" />
                <Input field="familyName" validate={this.validateName} trigger="blur" name="familyName" />
                <Input field="code" validate={this.asyncValidate} trigger={['change', 'mount']} />
                <Button type="primary" htmlType="submit">
                    Submit
                </Button>
                <Button htmlType="reset">reset</Button>
                <h5>Component using formState:</h5>
                <ComponentUsingFormState />
            </Form>
        );
    }
}


// validate partial fields
// reset partial fields
class PartValidAndResetDemo extends Component {
    constructor() {
        super();
        this.validate = this.validate.bind(this);
        this.getFormApi = this.getFormApi.bind(this);
        this.validatePartial = this.validatePartial.bind(this);
        this.resetPartial = this.resetPartial.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    validate(val) {
        if (!val) {
            return '【sync】can\'t be empty';
        } else if (val.length <= 5) {
            return <span>我是传入的reactNode</span>;
        }
        return;
    }

    validatePartial(type) {
        let scope = this.formApi.getValue('validateScope');
        !scope ? scope = [] : null;
        this.formApi.validate(scope)
            .then(values => {
                console.log(values);
                Toast.success('pass');
            }).catch(error => {
                Toast.error('error');
                console.log(error);
            });
    }

    resetPartial() {
        let scope = this.formApi.getValue('resetScope');
        this.formApi.reset(scope);
    }

    render() {
        let options = ['a', 'b', 'c', 'd', 'b.name'].map(item => ({ label: item, value: item }));
        return (
            <Form
                getFormApi={this.getFormApi}
                autoScrollToError
                onErrorChange={(errors, changedField) => console.log(errors, changedField)}
            >
                <Input field="a[1]" validate={this.validate} trigger="blur" />
                <Input field="a[0]" validate={this.validate} trigger="blur" />
                <Input field="ackk" validate={this.validate} trigger="blur" />
                <Input field="b.name[0]" validate={this.validate} trigger="blur" name="familyName" />
                <Input field="b.name[1]" validate={this.validate} trigger="blur" name="familyName" />
                <Input field="b.type" validate={this.validate} trigger="blur" name="familyName" />
                <Input field="c" validate={this.validate} trigger="change" name="familyName" />
                <Input field="d" validate={this.validate} trigger="change" name="familyName" />
                <CheckboxGroup options={options} field="validateScope" label="Need Validate Fields" direction="horizontal" />
                <CheckboxGroup options={options} field="resetScope" label="Need Reset Fields" direction="horizontal" />
                <Button type="primary" htmlType="submit">submit</Button>
                <Button htmlType="reset">reset</Button>
                <Button onClick={() => this.validatePartial('all')}>all validate</Button>
                <Button onClick={() => this.validatePartial()}>partial validate</Button>
                <Button onClick={this.resetPartial}>partial reset</Button>
                <ComponentUsingFormState />
            </Form>
        );
    }
}

class RulesValidateDemo extends Component {
    constructor() {
        super();
        this.validate = this.validate.bind(this);
        this.getFormApi = this.getFormApi.bind(this);
        this.set = this.set.bind(this);
    }

    validate(values) {
        this.formApi.validate().then(value => {
            Toast.info('reslove');
        }).catch(error => {
            Toast.error('error');
        });
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    set(val) {
        this.formApi.setError('panel[1].a', val);
    }

    render() {
        return (
            <>
                <Form
                    layout="horizontal"
                    getFormApi={this.getFormApi}
                    autoScrollToError
                    onReset={v => console.log('reset')}
                    onChange={v => console.log(v)}
                    onValueChange={v => console.log('onValueChange')}
                    onErrorChange={(errors, changedField) => console.log(errors, changedField)}
                >
                    <Input field="panel[0].a" trigger="custom" rules={[{ required: true, message: '字段不能为空' }]} />
                    <Input field="panel[0].b" trigger="custom" rules={[{ required: true, message: '字段不能为空' }]} />
                    <Input field="panel[0].c" trigger="custom" rules={[{ required: true, message: '字段不能为空' }]} />
                    <Input field="panel[1].a" trigger="custom" rules={[{ required: false, message: '字段不能为空' }]} />
                    <Button type="primary" onClick={this.validate}>
                        validate
                    </Button>
                    <Button htmlType="reset">reset</Button>
                    <Button onClick={() => this.set('')}>setEmptyString</Button>
                    <Button onClick={() => this.set(undefined)}>setUndefined</Button>
                    <ComponentUsingFormState />
                </Form>
            </>
        );
    }
}

class SetBugDemo extends Component {
    constructor() {
        super();
        this.state = {
            key: 1
        };

    }

    validate = values => {
        this.formApi.validate().then(value => {
            Toast.info('reslove');
        }).catch(error => {
            Toast.error('error');
        });
    }

    getFormApi = formApi => {
        this.formApi = formApi;
    }

    set = val => {
        this.formApi.setError('panel[1].a', val);
    }

    refresh = val => {
        this.setState({ key: new Date().valueOf() });
    }


    render() {
        const commonRules = [{
            required: true, message: '不能为空'
        }];
        const { key } = this.state;
        return (
            <>
                <Form
                    key={key}
                    layout="horizontal"
                    getFormApi={this.getFormApi}
                    autoScrollToError
                    onReset={v => console.log('reset')}
                    onChange={v => console.log(v)}
                    onValueChange={v => console.log('onValueChange')}>
                    {({ formState, values }) => (
                        <>
                            <Form.Input field="panels[11].start_time" rules={commonRules} />
                            <Form.Input field="panels[11].end_time" rules={commonRules} />
                            <Form.Input field="panels[13].start_time" rules={commonRules} />
                            <Form.Input field="panels[13].end_time" rules={commonRules} />
                            <Form.Input field="a.a1" rules={commonRules} />
                            <Form.Input field="a.a2" rules={commonRules} />
                            <Textarea style={{ margin: 10 }} value={JSON.stringify(formState.errors)} />
                            <Textarea style={{ margin: 10 }} value={JSON.stringify(formState.values)} />
                            {/* <ComponentUsingFormState/> */}
                            <Button type="primary" onClick={this.validate}>
                                validate
                            </Button>
                            <Button htmlType="reset">reset</Button>
                            <Button onClick={this.refresh}>refresh</Button>
                        </>
                    )}
                </Form>
            </>
        );
    }
}

class UnmountedLeafDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            show: true,
        };
        this.change = this.change.bind(this);
    }

    change() {
        let { show } = this;
        this.setState({ show: !show });
    }

    render() {
        let { show } = this.state;
        return (
            <Form style={{ width: 500 }} labelPosition="left" labelWidth="220px" allowEmpty>
                {({ values }) => (
                    <>
                        {JSON.stringify(values)}
                        {show ? <Form.Input field="array[0].name" /> : null}
                        <Button onClick={this.change}>change</Button>
                    </>
                )}
            </Form>
        );
    }
}


class RulesExample extends React.Component {
    constructor() {
        super();
        this.state = {
            initValues: {
                name: 'semi',
                role: 'rd'
            }
        };
        this.getFormApi = this.getFormApi.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    render() {
        const { Select, Input } = Form;
        const style = { width: '100%' };
        return (
            <Form initValues={this.state.initValues}>
                <Input
                    field="name"
                    label="名称（Input）"
                    style={style}
                    trigger="blur"
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'muji', message: 'not muji' }
                    ]}
                />
                <Select field="role" style={style} label="角色" placeholder="请选择你的角色" initValue={'pm'}>
                    <Select.Option value="operate">运营</Select.Option>
                    <Select.Option value="rd">开发</Select.Option>
                    <Select.Option value="pm">产品</Select.Option>
                    <Select.Option value="ued">设计</Select.Option>
                </Select>
            </Form>
        );
    }
}



class RaceAsyncDemo extends React.Component {
    constructor() {
        super();
        this.asyncValidate = this.asyncValidate.bind(this);
    }

    asyncValidate(val, values) {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        let time = 1000; 
        if (val === 'semi') {
            time = 4000;
        } 
        return sleep(time).then(() => {
            if (!val) {
                return 'can\'t be empty';
            } else if (val === 'semi') {
                return 'sleep 4000';
            } else if (val === 'sem') {
                return 'sleep 1000';
            } else {
                return '';
            }
        });
    }

    render() {
        return (
            <Form>
                <Form.Input
                    field='name'
                    label='props.rules ract async validate'
                    // validate={this.asyncValidate}
                    trigger='blur'
                    rules={[
                        {
                            type: 'string',
                            asyncValidator: (rule, value) => {
                                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
                                let time = 1000; 
                                if (value === 'semi') {
                                    time = 4000;
                                }
                                return sleep(time).then(() => {
                                    if (value === 'semi') {
                                        throw Error('sleep 4000');
                                    } else if (value === 'sem') {
                                        throw Error('sleep 1000');
                                    } else {
                                        return;
                                    }
                                });
                            }
                        }
                    ]}
                />
                <Form.Input
                    field='nick'
                    label='props.validate race async validate'
                    validate={this.asyncValidate}
                    trigger='blur'
                />
                <Button htmlType="reset">reset</Button>
            </Form>
        );
    }
}

export { ValidateFieldsDemo, CustomValidateDemo, PartValidAndResetDemo, RulesValidateDemo, SetBugDemo, UnmountedLeafDemo, RulesExample, RaceAsyncDemo };
