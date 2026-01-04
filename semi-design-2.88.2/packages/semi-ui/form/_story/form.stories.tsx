import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { Form, useFormState, useFormApi, withField, Input, Button, Upload, withFormApi, withFormState } from '../../index';
const stories = storiesOf('Form', module);
import { FormApiContext } from '../context';


import type { FormApi, FormFCChild, FormState } from '../interface';

const treeData = [
    {
        label: '浙江省',
        value: 'zhejiang',
        key: '0',
        children: [
            {
                label: '杭州市',
                value: 'hangzhou',
                key: '0-0',
                children: [
                    {
                        label: '西湖区',
                        value: 'xihu',
                        key: '0-0-0',
                    },
                    {
                        label: '萧山区',
                        value: 'xiaoshan',
                        key: '0-0-1',
                    },
                    {
                        label: '临安区',
                        value: 'linan',
                        key: '0-0-2',
                    },
                ],
            },
            {
                label: '宁波市',
                value: 'ningbo',
                key: '0-1',
                children: [
                    {
                        label: '海曙区',
                        value: 'haishu',
                        key: '0-1-0',
                    },
                    {
                        label: '江北区',
                        value: 'jiangbei',
                        key: '0-1-1',
                    },
                ],
            },
        ],
    },
];

const htmlInput = (props: any) => {
    let value = props.value || '';
    delete props.validateStatus; // prevent props being transparently transmitted to DOM
    return <input {...props} value={value} />;
};

const FieldB = withField(Input);
const FieldA = withField(htmlInput, { valueKey: 'value', onKeyChangeFnName: 'onChange', valuePath: 'target.value' });

const Fields: FunctionComponent<FormFCChild> = ({ formState, values, formApi }) => {
    const ref = React.useRef();
    return (
    <>
        <Form.Rating field='test' className='fe' count={2} ref={ref}  />

        <Form.Input field='test'  ref={ref}  />
        <Input size='default' showClear insetLabel />
        <FieldB insetLabel placeholder='fe' fieldClassName='fefe' field='custom' />

        {/* <Button onClick={() => formApi.setValue('fieldA', 'fe')}>set</Button> */}
        <Form.Select field='test' ref={ref}>
            <Form.Select.Option value="f1"></Form.Select.Option>
            <Form.Select.Option value="f2"></Form.Select.Option>
        </Form.Select>
        <Form.Input field="UserName" label="用户名" ref={ref} />
        <Form.TextArea field="textarea" onKeyDown={(v: any) => console.log(v)}  ref={ref}  />
        <Form.Input field="Password" label="密码" />
        <Form.InputNumber field="number"  ref={ref} />
        <Form.Rating field="rating" />
        <Form.Switch field="switch" checkedText="on" uncheckedText="off"  ref={ref} />

        <Form.Cascader
            placeholder="请选择所在地区"
            field="area"
            ref={ref} 
            label={{ text: '123', required: true, extra: 123 }}
            treeData={treeData}
        ></Form.Cascader>
        <Form.TimePicker field="time" minuteStep={2} ref={ref} />
        <Form.AutoComplete field="fe" />

        <Form.TreeSelect field="treeSelect" treeData={treeData} ref={ref} />
        <Form.Slider field="slider" ref={ref}  />
        <Form.DatePicker field="datepicker" ref={ref} />
        <Form.CheckboxGroup
            field="type"
            ref={ref} 
            label="申请类型（CheckboxGroup）"
            initValue={['user', 'admin']}
            rules={[{ required: true }]}
        >
            <Form.Checkbox value="admin">admin</Form.Checkbox>
            <Form.Checkbox value="user">user</Form.Checkbox>
            <Form.Checkbox value="guest">guest</Form.Checkbox>
            <Form.Checkbox value="root">root</Form.Checkbox>
        </Form.CheckboxGroup>
        <Form.RadioGroup
            field="radio"
            ref={ref} 
            label="是否独占资源（Radio）"
            rules={[{ type: 'boolean' }, { required: true, message: '必须选择是否独占 ' }]}
        >
            <Form.Radio value={1}>是</Form.Radio>
            <Form.Radio value={0}>否</Form.Radio>
        </Form.RadioGroup>
        <Form.Checkbox field='abc' noLabel>
            我已阅读并清楚相关规定（Checkbox）
        </Form.Checkbox>
        <Form.Label text="fe" required />
        <Form.ErrorMessage error="errorText" />
        <FieldB field="custom" />
        <FieldA field="cuB" />
        <Form.TagInput field='tagInput' ref={ref} ></Form.TagInput>
        <Form.Upload ref={ref} fileName='semi' action='https://test.com' field='file' />
        <Form.Slot />
        <code style={{ marginTop: 30 }}>{JSON.stringify(formState)}</code>
    </>
    )
};

stories.add('Form', () => <Form>{Fields}</Form>);

interface IProps {
    [x:string]: any;
}
interface IState {
    visible: boolean;
}

interface FData {
    test: boolean;
    test2: boolean;
    test3: string;
    test4: {
        event: string,
    },
    test5: {
        kkk: {
            jjj: number
        }
    }
    testK: boolean;
    // [x: string]: any;
}
class Demo extends React.Component<IProps, IState> {

    formApi: FormApi<FData>

    constructor(props:any) {
      super(props);
      this.state = { visible: false};
      this.asyncValidateFields = this.asyncValidateFields.bind(this);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    setData() {
        const formApi = this.formApi;
        // set
        formApi.setValue('test3', 123);
        formApi.setValue('test4.event', 123);
        formApi.setValue('test5.kkk', 123);
        formApi.setValue('test5.kkk.jjj', 123);
        formApi.setValue('keyNotExist', 123);
        formApi.setValue('test4.notExist', 123);
        formApi.setValue('test5.kkk.notExist', 123);

        // get
        let test3 = formApi.getValue('test3');
        let test4 = formApi.getValue('test4');
        let test4event = formApi.getValue('test4.event');
        let test5kkk = formApi.getValue('test5.kkk');
        let test5kkkjjj = formApi.getValue('test5.kkk.jjj');

        let a = formApi.getValue('keyNotExist');
        let b = formApi.getValue('test5.kkk.notExist');
        let c = formApi.getValue('test4.notExist');
    }

    asyncValidateFields(values) {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        return sleep(2000).then(() => {
            let errors = {} as Record<string, any>;
            if (values.name !== 'mike') {
                errors.name = 'you must name mike';
            }
            if (values.sex !== 'female') {
                errors.sex = 'sex not valid';
            }
            return errors;
        });
    }

    render() {
      const { visible } = this.state;
      return (
        <>
          <Form<FData>
            getFormApi={this.getFormApi}
            onSubmit={values => console.log(values.test2)}
            onChange={formState => formState.values.test}
            validateFields={this.asyncValidateFields}
            // validateFields={values => ({ test4: 'test4 empty', test2: '', fieldNotExist: 'xx' }) }
        >
          </Form>
        </>
      );
    }
  }

class WithoutGenericsType extends React.Component<IProps, IState> {

    formApi: FormApi

    constructor(props: any) {
        super(props);
    }

    getFormApi(formApi) {
        this.formApi = formApi;
    }

    setData() {
        const formApi = this.formApi;
        formApi.setValue('test3', 123);
        formApi.setValue('test8', 123);
        formApi.setValue('test4.event', 123);
        formApi.setValue('test5.kkk', 123);
        formApi.setValue('test5.kkk.jjj', 123);
        formApi.setValue('test5.kkk.ppp', 123);
        formApi.setValue('test4.5', 123);
    }

    render() {
        return (
            <>
                <Form
                    getFormApi={this.getFormApi}
                    onSubmit={values => console.log(values.test2)}
                    onChange={formState => formState.values.test}
                    validateFields={values => ({ test4: 'test4 empty', test2: '' })}
                >
                </Form>
            </>
        );
    }
}


stories.add('Form render', () => <Form render={({values, formApi, formState}) => <div></div>}></Form>);



interface CodeProps {
    type?: 'email' | 'phone';
    test?: 'a' | 'b' | 'c';
    onSend?: () => Promise<void>
}

class CodeC extends React.Component<CodeProps & { formState?: FormState, formApi?: FormApi }, IState> {
    state: IState = {
        visible: false,
    };
    render() {
        const { formState } = this.props;

        return <div>
            t
        </div>;
    }
}


const t = () => (<CodeC type='email'></CodeC>);
const DoubleWrap = withFormState(withFormApi(CodeC));
const OneWrap = withFormApi(CodeC);


stories.add('Form children', () => <Form>
    {({ formState, formApi, values }) => (
        <>
        <Form.Input field='fe'>
        </Form.Input>
        
        <DoubleWrap type='email' test='c'></DoubleWrap>
        <OneWrap type='email'></OneWrap>
        <CodeC type='email'></CodeC>
        
        <Form.DatePicker field='role'/>
        </>
        )
    }
</Form>);

