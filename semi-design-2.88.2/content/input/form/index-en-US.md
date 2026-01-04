---
localeCode: en-US
order: 39
category: Input
title:  Form
subTitle: Form
icon: doc-form
dir: column
---


## Form

-   **Rerender on demand**, avoids unnecessary full-volume rendering, higher performance
-   Easy to use, **simple structure**, avoids unnecessary hierarchical nesting
-   Perfect accessibility support
-   FormState / FieldState can also be easily obtained from outside the Form
    Provides an external method to operate inside the form: formApi / fieldApi
-   Support for encapsulating custom components into form controls, and you can quickly access your team's components through the extension mechanism provided by Form (through `withField` HOC)
-   Support Form level / Field level assignment, verification (synchronous / asynchronous)

## Field

Semi encapsulates all form field component (Input、Select、Checkbox、DatePicker etc.) with `withField` once.  
Taking over their data flow (`props.value` & `props.onChange`)    
When in use, you need to import from the Form (note: only the control imported from the Form has data synchronization)  

### Supported Field Component

-   `Input`, `InputNumber`, `TextArea`, `Select`, `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `DatePicker`, `TimePicker`, `Slider`, `InputGroup`, `TreeSelect`, `Cascader`, `Rating`, `AutoComplete`, `Upload`,  `Label`, `ErrorMessage`, `Section`、`TagInput`
    All mounted under Form and declared directly in `<Form.Input />`  and `<Form.Select />` when used.

```javascript
import { Form } from '@douyinfe/semi-ui';

const FormInput = Form.Input;
const FormSelect = Form.Select;
const Option = FormSelect.Option;
```

The Field level component provided by Form, its `value` (or other properties specified by `valueKey`), onChange (or other callback functions specified by `onKeyChangeFnName`)
Properties are hijacked by Form, so

<Notice type="primary" title="Notice">
    <div>1. No longer need to manually bind the onChange event and update the value as controled component. But you can continue to listen onChange events for the latest values if you want</div>
    <div>2. You cannot set the state of component with attributes such as `value`, `defaultValue`, `checked`, `defaultChecked`, etc. The default value can be set by Field's `initValue` or Form's `unitValues`</div>
    <div>3. You should not modify the value of Form State directly, all changes to the data in the Form should be done by providing `formApi`, `fieldApi`</div>
</Notice>

## Demos

### Various ways to declare form

Semi Form supports multiple writing at the same time.

#### Basic Usage

Add `field` property to each field component.
You can also set `label` properties for each field, by default is the same as field

`label` can be passed in a string directly, or declared in the form of an object, configure `extra`, `required`, `optional` and other attributes to deal with more complex scenarios

<Notice type='primary' title='Notice'>
    The field attribute is required props
</Notice>


```jsx live=true dir="column"
import React from 'react';
import { Form, Tooltip } from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';

() => (
    <Form layout='horizontal'>
        <Form.Input field='username' label='UserName' style={{ width: 80 }}/>
        <Form.Input
            field='password'
            label={{ 
                text: 'Password',
                extra: <Tooltip content='More info xxx'><IconHelpCircle style={{ color: 'var(--semi-color-text-2)' }}/></Tooltip> 
            }}
            style={{ width: 176 }}
        />
        <Form.Select
            field="role"
            label={{ text: 'Role', optional: true }}
            style={{ width: 176 }}
            optionList={[
                { label: 'Admin', value: 'admin' },
                { label: 'User', value: 'user' },
                { label: 'Guest', value: 'guest' },
            ]}
        >
        </Form.Select>
    </Form>
);
```

#### Other declaration methods

When you need to get `formState`, `formApi`, `values`, etc. directly inside the Form structure, you can use the following writing

#### Via render props

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => (
    <Form render={({ formState, formApi, values }) => (
        <>
            <Form.Select field="role" label='Role' style={{ width: 120 }}>
                <Form.Select.Option value="admin">Admin</Form.Select.Option>
                <Form.Select.Option value="user">User</Form.Select.Option>
                <Form.Select.Option value="guest">Guest</Form.Select.Option>
            </Form.Select>
            <Form.Input field='userName' label='UserName' />
            <Form.Input field='password' label='Password' />
            <code style={{ marginTop: 30 }}>{JSON.stringify(formState)}</code>
        </>
    )} layout='horizontal'>
    </Form>
);
```

#### Via children function

declare children as a function that returns all field components

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => (
    <Form layout='horizontal'>
        {
            ({ formState, values, formApi }) => (
                <>
                    <Form.Select field="role" label='Role' style={{ width: 120 }}>
                        <Form.Select.Option value="admin">Admin</Form.Select.Option>
                        <Form.Select.Option value="user">User</Form.Select.Option>
                        <Form.Select.Option value="guest">Guest</Form.Select.Option>
                    </Form.Select>
                    <Form.Input field='userName' label='UserName' />
                    <Form.Input field='password' label='Password' />
                    <code style={{ marginTop: 30 }}>{JSON.stringify(formState)}</code>
                </>
            )
        }
    </Form>
);
```

#### Via props.component

Pass the entire internal structure directly in the form through `component` attribute.

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor() { super(); }
    render() {
        const fields = ({ formState, formApi, values }) => (
            <>
                <Form.Input field='Role'/>
                <Form.Input field='UserName' />
                <Form.Input field='Password' />
                <code style={{ marginTop: 30 }}>{JSON.stringify(formState)}</code>
            </>
        );
        return <Form component={fields} layout='horizontal'/>;
    }
}
```

### All supported field components

```jsx live=true dir="column"
import React from 'react';
import { Form, Col, Row, Button } from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';

class BasicDemoWithInit extends React.Component {
    constructor() {
        super();
        this.state = {
            initValues: {
                name: 'semi',
                business: ['ulikeCam'],
                role: 'ued',
                switch: true,
                files: [
                    {
                        uid: '1',
                        name: 'vigo.png',
                        status: 'success',
                        size: '130KB',
                        preview: true,
                        url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/vigo.png'
                    },
                    {
                        uid: '2',
                        name: 'resso.jpeg',
                        status: 'validateFail',
                        size: '222KB',
                        percent: 50,
                        preview: true,
                        fileInstance: new File([new ArrayBuffer(2048)], 'resso.jpeg', { type: 'image/jpeg' }),
                        url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png'
                    },
                    {
                        uid: '3',
                        name: 'dy.jpeg',
                        status: 'uploading',
                        size: '222KB',
                        percent: 50,
                        preview: true,
                        fileInstance: new File([new ArrayBuffer(2048)], 'dy.jpeg', { type: 'image/jpeg' }),
                        url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png'
                    }
                ]
            }
        };
    }


    render() {
        const { Input, InputNumber, AutoComplete, Select, TreeSelect, Cascader, DatePicker, TimePicker, TextArea, CheckboxGroup, Checkbox, RadioGroup, Radio, Slider, Rating, Switch, TagInput, Section } = Form;
        const { initValues } = this.state;
        const plainOptions = ['A', 'B', 'C'];
        const style = { width: '90%' };
        const treeData = [
            {
                label: 'Asia',
                value: 'Asia',
                key: '0',
                children: [
                    {
                        label: 'China',
                        value: 'China',
                        key: '0-0',
                        children: [
                            {
                                label: 'Beijing',
                                value: 'Beijing',
                                key: '0-0-0',
                            },
                            {
                                label: 'Shanghai',
                                value: 'Shanghai',
                                key: '0-0-1',
                            },
                        ],
                    },
                ],
            },
            {
                label: 'North America',
                value: 'North America',
                key: '1',
            }
        ];

        return (
            <Form
                initValues={initValues}
                style={{ padding: 10, width: '100%' }}
                onValueChange={(v)=>console.log(v)}
            >
                <Section text={'Basic Info'}>
                    <Row>
                        <Col span={12}>
                            <Input
                                field="name"
                                label="Name（Input）"
                                initValue={'mikeya'}
                                style={style}
                                trigger='blur'
                            />
                        </Col>
                        <Col span={12}>
                            <DatePicker field="date" label='Date（DatePicker）' style={style} initValue={new Date()} placeholder='Choose data' />
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Select field="role" style={style} label='Role（Select）' placeholder='Choose role'>
                                <Select.Option value="qa">Quality Assurance</Select.Option>
                                <Select.Option value="rd">Software Engineer</Select.Option>
                                <Select.Option value="pm">Product Manager</Select.Option>
                                <Select.Option value="ued">Designer</Select.Option>
                            </Select>
                        </Col>
                        <Col span={12}>
                            <Select
                                field="business"
                                multiple
                                style={style}
                                placeholder='Choose application'
                                label="Application（Multiple Select）"
                            >
                                <Select.Option value="semi">Semi</Select.Option>
                                <Select.Option value="ulikeCam">UlikeCam</Select.Option>
                                <Select.Option value="xigua">BuzzVideo</Select.Option>
                            </Select>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Form.Cascader
                                placeholder="Choose Area"
                                treeData={treeData}
                                field='area'
                                label='Area（Cascader）'
                                style={style}
                            >
                            </Form.Cascader>
                        </Col>
                        <Col span={12}>
                            <Form.TreeSelect
                                field="tree"
                                style={style}
                                label='Node（TreeSelect）'
                                placeholder='Select Service Node'
                                treeData={treeData}
                                filterTreeNode
                            >
                            </Form.TreeSelect>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <TagInput 
                                field="product"
                                label='Product（TagInput）'
                                initValue={['abc', 'ulikeCam']}
                                placeholder='Type and choose product name'
                                style={style}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col span={24}>
                            <Form.Upload
                                field='files'
                                label='Files（Upload）'
                                action='//semi.design/api/upload'
                            >
                                <Button icon={<IconUpload />} theme="light">
                                    Click to upload
                                </Button>
                            </Form.Upload>
                        </Col>
                    </Row>
                </Section>
                <Section text='Source Detail'>
                    <Row>
                        <Col span={12}>
                            <TextArea
                                style={style}
                                field='description'
                                label='Apply Reason（TextArea）'
                            />
                        </Col>
                        <Col span={12}>
                            <CheckboxGroup
                                field="type"
                                label='Apply type（CheckboxGroup）'
                                initValue={['user', 'admin']}
                                rules={[
                                    { Requested: true }
                                ]}
                            >
                                <Checkbox value="admin">admin</Checkbox>
                                <Checkbox value="user">user</Checkbox>
                                <Checkbox value="guest">guest</Checkbox>
                                <Checkbox value="root">root</Checkbox>
                            </CheckboxGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <RadioGroup field="isMonopolize" label='Whether exclusive resources（Radio）'>
                                <Radio value={1}>Yes</Radio>
                                <Radio value={0}>No</Radio>
                            </RadioGroup>
                        </Col>
                        <Col span={12}>
                            <CheckboxGroup options={plainOptions} field="checkbox" label='Type（CheckboxGroup）' direction='horizontal'/>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <TimePicker field="time" label='End Time（TimePicker）' style={{ width: '90%' }}/>
                        </Col>
                        <Col span={12}>
                            <InputNumber field='number' label='Number of applications（InputNumber）' initValue={20} style={style}/>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Slider field="range" label='Resource usage alarm threshold(%)（Slider）' initValue={10} style={{ width: '90%' }}/>
                        </Col>
                        <Col span={12}>
                            <Switch field='switch' label='Switch(Switch)'/>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={12}>
                            <Rating field="rating" label='Satisfaction(Rating)' initValue={2} style={{ width: '90%' }}/>
                        </Col>
                    </Row>
                </Section>
                <Checkbox value="false" field="agree" noLabel={true}>
                    I have read and understood the relevant regulations（Checkbox）
                </Checkbox>
                <Button type="primary" htmlType="submit" className="btn-margin-right">Submit</Button>
                <Button htmlType="reset">Reset</Button>
            </Form>
        );
    }
}
```

### Field binding syntax

Every Field component must have a `field` property. This is how the form manages the state of this field.
See the field syntax section below for additional details on what you can pass in for field.

The field can be a simple string, can be contained`.`Or`[]`String that supports multi-level nesting  
Below is an example of the field name and their mapping path in FormState

| Field                  | Resolution                         |
| ---------------------- | ---------------------------------- |
| username               | formState.values.username          |
| user\[0\]              | formState.values.user\[0\]         |
| siblings.1             | formState.values.siblings\[1\]     |
| siblings\['2'\]        | formState.values.siblings\[2\]     |
| parents\[0\].name      | formState.values.parents\[0\].name |
| parents\[1\]\['name'\] | formState.values.parents\[1\].name |

```jsx live=true dir="column"
import React from 'react';
import { Form, Row, Col, Toast, TextArea } from '@douyinfe/semi-ui';

() => (
    <Form
        onSubmit={values => Toast.info({ content: JSON.stringify(values) })}
    >
        {
            ({ formState, values, formApi }) => (
                <Row>
                    <Col span={12}>
                        <Form.Input field='username' placeholder='Try input something'/>
                        <Form.Input field='user[0]' placeholder='Try input something'/>
                        <Form.Input field='siblings.1' placeholder='Try input something'/>
                        <Form.Input field="siblings['2']" placeholder='Try input something'/>
                        <Form.Input field='parents[0].name' placeholder='Try input something'/>
                        <Form.Input field="parents[1]['name']" placeholder='Try input something'/>
                    </Col>
                    <Col span={10} offset={1} style={{ marginTop: 12 }}>
                        <Form.Label text='formState.values in real time：'></Form.Label>
                        <TextArea value={JSON.stringify(formState.values)}></TextArea>
                    </Col>
                </Row>
            )
        }
    </Form>
);
```

### Form layout

-   Vertical Layout: Arrange each field vertically （By default）  
     Semi Design recommends a vertical layout.

```jsx live=true dir="column"
import React from 'react';
import { Form, Button, Toast } from '@douyinfe/semi-ui';

() => {
    const handleSubmit = (values) => {
        console.log(values);
        Toast.info('Submit Success');
    };
    return (
        <Form onSubmit={values => handleSubmit(values)} style={{ width: 400 }}>
            {({ formState, values, formApi }) => (
                <>
                    <Form.Input field='phone' label='PhoneNumber' style={{ width: '100%' }} placeholder='Enter your phone number'></Form.Input>
                    <Form.Input field='password' label='Password' style={{ width: '100%' }} placeholder='Enter your password'></Form.Input>
                    <Form.Checkbox field='agree' noLabel>I have read and agree to the terms of service</Form.Checkbox>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p>
                            <span>Or</span><Button theme='borderless' style={{ color: 'var(--semi-color-primary)', marginLeft: 10, cursor: 'pointer' }}>Sign up</Button>
                        </p>
                        <Button disabled={!values.agree} htmlType='submit' type="tertiary">Log in</Button>
                    </div>
                </>
            )}
        </Form>
    );
};
```

-   Horizontal Layout: Arrange each field horizontally
    You can use the horizontal layout by setting `layout='horizontal'`

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => (
    <Form layout='horizontal'>
        <Form.Input field='phone' label='PhoneNumber' placeholder='Enter your phone number'></Form.Input>
        <Form.Input field='password' label='Password' placeholder='Enter your password'></Form.Input>
    </Form>
);
```

-   Label Position, Label Align  
     You can control the position of the label in the Field and the direction of text alignment by setting `labelPosition`, `labelAlign`

```jsx live=true dir="column"
import React from 'react';
import { Form, Select, Checkbox, Radio } from '@douyinfe/semi-ui';


class BasicDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            labelPosition: 'left',
            labelAlign: 'left',
        };
    }

    render() {
        const { labelPosition, labelAlign } = this.state;
        const labelWidth = 120;
        return (
            <>
                <div style={{ borderBottom: '1px solid var(--semi-color-text-3)', paddingBottom: 10 }}>
                    <Form
                        labelPosition='inset'
                        layout='horizontal'
                        initValues={{ labelPosition: 'left', labelAlign: 'left' }}
                        onValueChange={values => this.setState(values)}
                    >
                        <Form.Select 
                            field='labelPosition'
                            style={{ width: 240 }}
                            label='Current Label Position:'
                            optionList={[
                                { label: 'top', value: 'top' },
                                { label: 'left', value: 'left' },
                            ]}
                        />
                        <Form.Select 
                            field='labelAlign'
                            style={{ width: 240 }}
                            label='Current Label Align:'
                            optionList={[
                                { label: 'left', value: 'left' },
                                { label: 'right', value: 'right' },
                            ]}
                        />
                    </Form>
                </div>
                <Form
                    labelPosition={labelPosition}
                    labelWidth={labelWidth}
                    labelAlign={labelAlign}
                    style={{ padding: '10px', width: 600 }}>
                    <Form.Input
                        field="input"
                        label="PhoneNumber"
                        trigger='blur'
                        style={{ width: 200 }}
                        rules={[
                            { required: true, message: 'required Error' },
                            { type: 'string', message: 'type error' },
                            { validator: (rule, value) => value === 'semi', message: 'not semi' }
                        ]}
                    />
                    <Form.Switch label="Agree" field='agree'/>
                    <Form.InputNumber field='price' label='price' style={{ width: 200 }}/>
                    <Form.Select label="Name" field='name' style={{ width: 200 }}>
                        <Form.Select.Option value="mike">mike</Form.Select.Option>
                        <Form.Select.Option value="jane">jane</Form.Select.Option>
                        <Form.Select.Option value="kate">kate</Form.Select.Option>
                    </Form.Select>
                    <Form.CheckboxGroup label="Role" field='role' direction='horizontal'>
                        <Checkbox value="admin">admin</Checkbox>
                        <Checkbox value="user">user</Checkbox>
                        <Checkbox value="guest">guest</Checkbox>
                        <Checkbox value="root">root</Checkbox>
                    </Form.CheckboxGroup>
                    <Form.RadioGroup field="Sex">
                        <Radio value="1">man</Radio>
                        <Radio value="2">woman</Radio>
                    </Form.RadioGroup>
                </Form>
            </>
        );
    }
}

```

-   A more complex layout.  
    You can also combine the `Row` and `Col` provided by the `Grid` to arrange the form structure as you want.

```jsx live=true dir="column"
import React from 'react';
import { Form, Row, Col } from '@douyinfe/semi-ui';

() => (
    <Form
        labelPosition='top'
        getFormApi={this.getFormApi}
        style={{ padding: '10px' }}>
        <Row>
            <Col span={8}>
                <Form.Input
                    field="nickName1"
                    label="NickName"
                    style={{ width: '250px' }}
                    trigger='blur'
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'not semi' }
                    ]}
                />
            </Col>
            <Col span={8}>
                <Form.DatePicker field='date1' label='Valid Date' style={{ width: '250px' }}/>
            </Col>
            <Col span={8}>
                <Form.Select label="Application" field='business1' style={{ width: '250px' }}>
                    <Form.Select.Option value="abc">Semi</Form.Select.Option>
                    <Form.Select.Option value="hotsoon">Vigo</Form.Select.Option>
                    <Form.Select.Option value="xigua">BussVideo</Form.Select.Option>
                </Form.Select>
            </Col>
        </Row>
        <Row>
            <Col span={6}>
                <Form.Input
                    field="nickName2"
                    label="NickName"
                    style={{ width: '200px' }}
                    trigger='blur'
                    rules={[
                        { required: true, message: 'required error' },
                        { type: 'string', message: 'type error' },
                        { validator: (rule, value) => value === 'semi', message: 'not semi' }
                    ]}
                />
            </Col>
            <Col span={6}>
                <Form.DatePicker field='date2' label='Valid Date' style={{ width: '200px' }}/>
            </Col>
            <Col span={6}>
                <Form.Select label="Application" field='business2' style={{ width: '250px' }}>
                    <Form.Select.Option value="abc">Semi</Form.Select.Option>
                    <Form.Select.Option value="hotsoon">Vigo</Form.Select.Option>
                    <Form.Select.Option value="xigua">BussVideo</Form.Select.Option>
                </Form.Select>
            </Col>
            <Col span={6}>
                <Form.Select field="role" style={{ width: '250px' }} label='Role（Select）' placeholder='Choose role'>
                    <Form.Select.Option value="qa">Quality Assurance</Form.Select.Option>
                    <Form.Select.Option value="rd">Software Engineer</Form.Select.Option>
                    <Form.Select.Option value="pm">Product Manager</Form.Select.Option>
                    <Form.Select.Option value="ued">Designer</Form.Select.Option>
                </Form.Select>
            </Col>
        </Row>
    </Form>
);
```

### wrapper Col / label Col

When you need to set a uniform layout for all Fields in a Form, you can set `wrapperCol` and `labelCol` on the `Form` to quickly generate the layout. No need to manually use `Row`, `Col` manual layout.  
`wrapperCol`,`labelCol`Property Configuration Reference [Col components](/en-US/basic/grid#Col)

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => (
    <Form
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 2 }}
        labelPosition='left'
        labelAlign='right'
    >
        <Form.Input field='name' style={{ width: 250 }} label='Name' placeholder='Input Name' trigger='blur' />
        <Form.Select field="role" label='Role' placeholder='Choose Role' style={{ width: 250 }}>
            <Form.Select.Option value="qa">Quality Assurance</Form.Select.Option>
            <Form.Select.Option value="rd">Software Engineer</Form.Select.Option>
            <Form.Select.Option value="pm">Product Manager</Form.Select.Option>
            <Form.Select.Option value="ued">Designer</Form.Select.Option>
        </Form.Select>
    </Form>
);
```

### Remove automatically added Label

Form will automatically insert `Label` for Field control. If you don't need to automatically insert the Label module, you can turn off the automatic label insertion function by setting `noLabel=true` in the Field (at this time, the Field still has the ability to automatically display ErrorMessage, so the DOM structure is still different from the original component)  
If you want to keep the DOM structure consistent with the original component, you can use `pure=true`. At this time, the DOM structure will not change except that the data flow is taken over (you need to be responsible for the rendering of ErrorMessage, and it cannot be used by formProps.wrapperCol property impact)

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => (
    <Form onSubmit={(values) => console.log(values)} style={{ width: 400 }}>
        <Form.Input
            field='name'
            label='Name'
            trigger='blur'
            noLabel={true}
            style={{ width: 250 }}
            validate={val => val !== 'semi' ? 'not semi' : '' }
            placeholder='Type your name'
        />
        <Form.Input field='purename' pure placeholder='DOM same as origin Input component'/>
    </Form>
);
```

### Embedded Label

A Label can be inlined in a field control by setting labelPosition to `inset`. Components currently supporting this feature include `Input`, `InputNumber`, `DatePicker`, `TimePicker`, `Select`, `TreeSelect`, `Cascader`, `TagInput`

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => (
    <Form labelPosition='inset' layout='horizontal'>
        <Form.Input field='name' label='Name' trigger='blur' style={{ width: 250 }} initValue='semi'/>
        <Form.Select field="role" label='Role' style={{ width: '250px' }} initValue='rd'>
            <Form.Select.Option value="operate">operate</Form.Select.Option>
            <Form.Select.Option value="rd">rd</Form.Select.Option>
            <Form.Select.Option value="pm">pm</Form.Select.Option>
            <Form.Select.Option value="ued">ued</Form.Select.Option>
        </Form.Select>
        <Form.DatePicker field="date" label='StartDate' style={{ width: '250px' }} initValue={new Date()}>
        </Form.DatePicker>
    </Form>
);
```

### Export Label, ErrorMessage use

When the built-in Label and ErrorMessage layout does not meet the business requirements, you need to combine the positions yourself, but you want to use the default styles of Label and ErrorMessage directly.  
you can import them from the `Form` module, and combine `Form.Label` / `Form.ErrorMessage` by yourself.  
For details of their API, refer to [Label](#Form.Label) / [ErrorMessage](#Form.ErrorMessage)

```jsx
import { Form } from '@douyinfe/semi-ui';
const { Label, ErrorMessage } = Form;
```

### Use Form.Slot

When your custom component needs to maintain the same layout style as the Field component, you can place your custom component in `Form.Slot`  
`labelWidth`, `labelAlign`, `wrapperCol`, `labelCol` set on the Form component automatically acts on `Form.Slot`  
For the Slot property configuration, refer to [Form.Slot](#Form.Slot)

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

class AssistComponent extends React.Component {
    render() {
        return (
            <Form
                onChange={v=>console.log(v)}
                onSubmit={v=>console.log(v)}
                style={{ width: 600 }}
                labelPosition='left'
                labelWidth={100}
            >
                <Form.Input field='effectName' label='EffectName' style={{ width: 250 }}/>
                <Form.ErrorMessage />
                <Form.Slot label={{ text: 'SlotA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {`I'm Semi Form SlotA, a custom ReactNode`}
                    </div>
                </Form.Slot>
                <Form.Slot label={{ text: 'SlotB', width: 160, align: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {`I'm Semi Form SlotA, i have different labelWidth and textAlign.`}
                    </div>
                </Form.Slot>
            </Form>
        );}
}
```


### Use helpText、extraText set prompt information

You can place custom prompt information through `helpText`, and display it in the same block as the verification information (error). When both have values, the verification information will be displayed first.  
Additional prompt information can be placed through `extraText`. When the error message and prompt text need to appear at the same time, this configuration can be used. It is always displayed and located after helpText/error  
When `validateStatus` is passed in, the UI style corresponding to the value of validateStatus will be displayed first. If not passed in, the internal verification status of the field shall prevail.  

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => {
    const [helpText, setHelpText] = useState('');
    const [validateStatus, setValidateStatus] = useState('default');
    const formRef = useRef();

    const validate = (val, values) => {
        if (!val) {
            setValidateStatus('error');
            return <span>Password can not be blank</span>;
        } else if (val && val.length <= 3) {
            setValidateStatus('warning');
            setHelpText(<span style={{ color: 'var(--semi-color-warning)' }}>Password Strength: Weak</span>); // show helpText
            return ''; // validate pass
        } else {
            setHelpText('');
            setValidateStatus('success');
            return '';
        }
    };

    const random = () => {
        let pw = (Math.random() * 100000).toString().slice(0, 5);
        formRef.current.formApi.setValue('Password', pw);
        formRef.current.formApi.setError('Password', '');
        setHelpText('');
        setValidateStatus('success');
    };

    return (
        <Form
            showValidateIcon={true}
            ref={formRef}
            onSubmit={(value) => console.log('submit success')}
            onSubmitFail={(errors) => console.log(errors)}
        >
            <Form.Input
                validate={validate}
                field="Password"
                validateStatus={validateStatus}
                helpText={helpText}
                extraText={
                    <div
                        style={{
                            color: 'var(--semi-color-link)',
                            fontSize: 14,
                            userSelect: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={random}
                    >
                        Don't have a suitable password? Click to generate a random
                    </div>
                }
            ></Form.Input>
        </Form>
    );
};
```

By configuring `extraTextPosition`, you can control the display position of extraText. Optional values `bottom`, `middle`  
For example, when you want to display the extraText prompt information between the Label and Field component.  
This attribute can be configured uniformly on the Form or individually on each Field. When passing in at the same time, the configuration of the Field shall prevail.  

```jsx live=true dir="column"
import React from 'react';
import { Form } from '@douyinfe/semi-ui';

() => {
    const options = [
        { label: 'Lark Notification', value: 'lark' },
        { label: 'Email Notification', value: 'email' },
        { label: 'Banner Notification', value: 'notification' }
    ];
    const notifyText = "When unchecked, the default is a red dot reminder, and the message enters the recipient's message list by default. For important notifications, you can check the corresponding notification methods at the same time";
    const forceText = "For dialog notifications, you can specify that the message must wait for a specified amount of time before it can be marked as read.";
    return (
        <Form extraTextPosition='middle'>
            <Form.CheckboxGroup
                direction='horizontal'
                field='notify'
                label='Method to informe'
                extraText={notifyText}
                options={options}
            />
            <Form.InputNumber field='force' label='Force read (optional)' placeholder='seconds' extraText={forceText} extraTextPosition='bottom'/>
        </Form>
    );
};


```

### Using Input Group

When you need to combine some fields to use, you can use `Form.InputGroup` to wrap them.  
In Semi Form, when you using field components like `Form.Input`、`Form.Select`, Form will insert Label module automatically for them.  
But usually, in`InputGroup` you only need a Label belonging to the entire Group.
You can set the label property in the `InputGroup` to insert a Label belonging to the Group  
`label` configurable properties, see [Label](#Form.Label)

```jsx live=true dir="column"
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

() => (
    <Form onSubmit={(values) => console.log(values)} labelPosition='top' style={{ width: 400 }}>
        <Form.InputGroup label={{ text: (<span>PhoneNumber</span>), required: true }} labelPosition='top'>
            <Form.Select style={{ width: 150 }} field='phonePrefix' initValue='+86' rules={[{ required: true }]} showClear>
                <Form.Select.Option value='+1'>USA +1</Form.Select.Option>
                <Form.Select.Option value='+86'>China +86</Form.Select.Option>
                <Form.Select.Option value='+81'>Japan+81</Form.Select.Option>
            </Form.Select>
            <Form.Input initValue='18912345678' style={{ width: 250 }} field='phoneNumber' rules={[{ required: true }]} showClear/>
        </Form.InputGroup>
        <Form.Input field='name' trigger='blur' initValue='Semi' label='Name'></Form.Input>
        <Button htmlType='submit'>Submit</Button>
    </Form>
);
```

### Form in the Modal pop-up layer

You can place the Form in Modal and load it as a popup.  
When submitting, use `formApi.validate()` to centrally verify the Field

```jsx live=true dir="column"
import React from 'react';
import { Form, Modal, Select, Button, Row, Col } from '@douyinfe/semi-ui';


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
        this.formApi.validate()
            .then((values) => {
                console.log(values);
            })
            .catch((errors) => {
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
        let message = 'Required';
        return (
            <>
                <Button onClick={this.showDialog}>Open Dialog</Button>
                <Modal
                    title="New"
                    visible={visible}
                    onOk={this.handleOk}
                    style={{ width: 600 }}
                    onCancel={this.handleCancel}
                >
                    <Form
                        getFormApi={this.getFormApi}
                    >
                        <Row>
                            <Col span={7}>
                                <Form.Select
                                    field='region'
                                    label="Country/Region"
                                    style={{ width: 120 }}
                                    rules={[
                                        { required: true, message },
                                    ]}
                                    optionList={[
                                        { label: 'China', value: 'China' },
                                        { label: 'USA', value: 'US' },
                                        { label: 'Europe', value: 'Europe' },
                                        { label: 'Japan', value: 'Japan' },
                                    ]}
                                >
                                </Form.Select>
                            </Col>
                            <Col span={17}>
                                <Form.Input
                                    field='owner'
                                    label="Owner"
                                    trigger='blur'
                                    rules={[
                                        { required: true, message },
                                    ]}
                                />
                            </Col>
                            <Col span={7}>
                                <Form.Select
                                    field='area'
                                    label="Area"
                                    placeholder='Choose Area'
                                    style={{ width: 120 }}
                                    rules={[
                                        { required: true, message },
                                    ]}
                                >
                                    <Form.Select.Option value="China">China</Form.Select.Option>
                                    <Form.Select.Option value="US">USA</Form.Select.Option>
                                    <Form.Select.Option value="Europe">Europe</Form.Select.Option>
                                    <Form.Select.Option value="Japan">Japan</Form.Select.Option>
                                </Form.Select>
                            </Col>
                            <Col span={17}>
                                <Form.Input
                                    field='department'
                                    label="Department"
                                    trigger='blur'
                                    rules={[
                                        { required: true, message },
                                    ]}
                                />
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            </>
        );
    }
}
```

### Configure initial values and verification rules

-   You can configure check rules for each Field through `rules`  
     The verification library inside the Form is based on `async-validator`, and more configuration rules can be found in its [official documentation](https://github.com/yiminghe/async-validator)
-   You can uniformly set the initial value for the entire form through the `initValues` of form, or you can set the initial value through `initValue` in each field (the latter has a higher priority)
-   You can configure different verification trigger timings for each Field through `trigger`, and the default is `change` (that is, when onChange is triggered, the verification is performed automatically). Also supports `change`, `blur`, `mount`, `custom` or a combination of the above. After v2.42, it supports unified configuration through FormProps. If both are configured, FieldProps shall prevail
-   You can use the `stopValidateWithError`` switch to decide whether to continue to trigger the validation of subsequent rules when the first rule that fails the validation is encountered. After v2.42, unified configuration through FormProps is supported. If both are configured, FieldProps shall prevail


```jsx live=true dir="column"
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

() => {
    
    const initValues = {
        name: 'semi',
        shortcut: 'se'
    };
    
    const style = { width: '100%' };
    
    const { Select, Input } = Form;

    return (
        <Form initValues={initValues}>
            <Input
                field="name"
                style={style}
                trigger='blur'
                rules={[
                    { required: true, message: 'required error' },
                    { type: 'string', message: 'type error' },
                    { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                    { validator: (rule, value) => Boolean(value && value.startsWith('se')), message: 'should startsWith se' }
                ]}
            />
            <Input
                field="shortcut"
                style={style}
                stopValidateWithError
                rules={[
                    { required: true, message: 'required error' },
                    { type: 'string', message: 'type error' },
                    { validator: (rule, value) => value === 'semi', message: 'should be semi' },
                    { validator: (rule, value) => Boolean(value && value.startsWith('se')), message: 'should startsWith se' }
                ]}
            />
            <Button htmlType='submit'>提交</Button>
        </Form>
    );
};
```

### Custom Validate (Form Level)

You can set a custom validation function validateFields for the `form` as a whole, which will be called when submit

#### Synchronous Validate

When validate success, you should return an empty string.  
When validate fails, you should return the error message (Object, key is fieldName, value is the corresponding error message)

```jsx live=true dir="column"
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

class FormLevelValidateSync extends React.Component {
    constructor() {
        super();
        this.syncValidate = this.syncValidate.bind(this);
    }

    syncValidate(values) {
        const errors = {};
        if (values.name !== 'mike') {
            errors.name = 'you must name mike';
        }
        if (values.sex !== 'female') {
            errors.sex = 'must be woman';
        }
        errors.familyName = [
            { before: 'before errror balabala ', after: 'after error balabala' },
            'familyName[1] error balabala'
        ];
        return errors;
    }

    render() {
        return (
            <Form validateFields={this.syncValidate} layout='horizontal'>
                <Form.Input field='name' trigger='blur'></Form.Input>
                <Form.Input field='familyName[0].before' trigger='blur'></Form.Input>
                <Form.Input field='familyName[0].after' trigger='blur'></Form.Input>
                <Form.Input field='familyName[1]' trigger='blur'></Form.Input>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <Button type="primary" htmlType="submit" className="btn-margin-right">
                        Submit
                    </Button>
                    <Button htmlType="reset">reset</Button>
                </div>
            </Form >
        );
    }
}
```

#### Asynchronous Validate

For asynchronous validation, you should return a promise. In promise.then() you need to return the corresponding error message.

```jsx live=true dir="column"
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

class FormLevelValidateAsync extends React.Component {
    constructor() {
        super();
        this.asyncValidate = this.asyncValidate.bind(this);
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
            return errors;
        });
    }

    render() {
        return (
            <Form validateFields={this.asyncValidate} layout='horizontal'>
                <Form.Input field='name' trigger='blur'></Form.Input>
                <Form.Input field='familyName[0].before' trigger='blur'></Form.Input>
                <Form.Input field='familyName[1]' trigger='blur'></Form.Input>
                <Form.Input field='sex' trigger='blur'></Form.Input>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <Button type="primary" htmlType="submit" className="btn-margin-right">
                        Submit
                    </Button>
                    <Button htmlType="reset">reset</Button>
                </div>
            </Form >
        );
    }
}
```

### Custom Validate (Field Level)

You can specify a custom validation function for field. Supports synchronous and asynchronous validation (by returning promises)

```jsx live=true dir="column"
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

class FieldLevelValidateDemo extends React.Component {
    constructor() {
        super();
        this.validateName = this.validateName.bind(this);
        this.asyncValidate = this.asyncValidate.bind(this);
    }

    validateName(val) {
        if (!val) {
            return '【sync】can\'t be empty';
        } else if (val.length <= 5) {
            return '【sync】must more than 5';
        }
        return '';
    }

    asyncValidate(val, values) {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        return sleep(2000).then(() => {
            if (!val) {
                return '【async】can\'t be empty';
            } else if (val.length <= 5) {
                return '【async】must more than 5';
            } else {
                return '';
            }
        });
    }

    render() {
        return (
            <Form>
                <Form.Input field='name' label='【name】asyncValidate after 2s' validate={this.asyncValidate} trigger='blur'></Form.Input>
                <Form.Input field='familyName' label='【familyName】syncValidate' validate={this.validateName} trigger='blur'></Form.Input>
                <Button htmlType="reset">reset</Button>
            </Form >
        );
    }
}
```

### Manually Trigger specified validation
When you want to manually trigger the validation of some specific Field, you can do it through `formApi.validate`.  
 When no parameters are passed in, all Fields are checked by default. When parameters are passed in, the parameters specified shall prevail  


```jsx live=true dir="column"
import React from 'react';
import { Form, Button, Space } from '@douyinfe/semi-ui';
class PartValidAndResetDemo extends React.Component {
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
            return 'can\'t be empty';
        } else if (val.length <= 5) {
            return (<span>i am incoming reactNode</span>);
        }
        return;
    }

    validatePartial(type) {
        let scope = this.formApi.getValue('validateScope');
        !scope ? scope = [] : null;
        type === 'all' ? scope = ['a', 'b', 'c', 'd', 'b.name'] : null;
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
            <Form getFormApi={this.getFormApi} autoScrollToError layout='horizontal'>
                {
                    ({ formState, values, formApi }) => (
                        <>
                            <div>
                                <Form.Input field="a[1]" validate={this.validate} trigger="blur" />
                                <Form.Input field="a[0]" validate={this.validate} trigger="blur" />
                                <Form.Input field="b.name[0]" validate={this.validate} trigger="blur" />
                                <Form.Input field="b.name[1]" validate={this.validate} trigger="blur" />
                                <Form.Input field="b.type" validate={this.validate} trigger="blur" />
                                <Form.Input field="c" validate={this.validate} trigger="blur" />
                                <Form.Input field="d" validate={this.validate} trigger="blur" />
                            </div>
                            <div>
                                <Form.CheckboxGroup options={options} field="validateScope" label="The Field you want to validate currently" initValue={['a', 'b']} direction="horizontal" />
                                <Form.CheckboxGroup options={options} field="resetScope" label="The Field you want to reset currently" direction="horizontal" />
                                <Space>
                                    <Button htmlType="reset">reset</Button>
                                    <Button onClick={() => this.validatePartial('all')}>all validate</Button>
                                    <Button onClick={() => this.validatePartial()}>partial validate {JSON.stringify(values.validateScope)}</Button>
                                    <Button onClick={this.resetPartial}>partial reset</Button>
                                </Space>
                            </div>
                        </>
                    )
                }
            </Form>
        );
    }
}
```

### Linkage Fields

You can achieve the linkage between Fields by listening to the `onChange` of Field and then using formApi to make modifications.

```jsx live=true dir="column"
import React from 'react';
import { Form, Button, Row } from '@douyinfe/semi-ui';

class LinkFieldForm extends React.Component {
    constructor() {
        super();
        this.getFormApi = this.getFormApi.bind(this);
        this.handleSelectChange = this.handleSelectChange.bind(this);
    }

    handleSelectChange(value) {
        let text = value === 'male' ? 'Hi male' : 'Hi female!';
        this.formApi.setValue('Note', text);
    }

    getFormApi(formApi) { this.formApi = formApi; }

    render() {
        return (
            <Form getFormApi={this.getFormApi} onValueChange={values => console.log(values) } style={{ width: 300 }}>
                <Form.Input field="Note" style={{ width: 300 }} placeholder='Automatically update after choose Sex'/>
                <Form.Select field="Sex" onChange={this.handleSelectChange} style={{ width: 300 }}>
                    <Form.Select.Option value="female">female</Form.Select.Option>
                    <Form.Select.Option value="male">male</Form.Select.Option>
                </Form.Select>
                <Row>
                    <Button type="primary" htmlType="submit" className="btn-margin-right">
                        Submit
                    </Button>
                    <Button htmlType="reset">reset</Button>
                </Row>
            </Form>
        );
    }
}
```

### Dynamic form

#### Dynamically add and delete fields

```jsx live=true dir="column"
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

() => (
    <Form style={{ width: 450 }}>
        {({ formState }) => (
            <React.Fragment>
                <Form.Input field="name" label='Name' />
                <Form.RadioGroup field="isAnchor" label='Is registered anchor'>
                    <Form.Radio value="yes">yes</Form.Radio>
                    <Form.Radio value="no">no</Form.Radio>
                </Form.RadioGroup>
                {formState.values.isAnchor === 'yes' ? (
                    <Form.Input field="liveRoom" label='Live room name' />
                ) : null}
                <Button htmlType="submit">Submit</Button>
            </React.Fragment>
        )}
    </Form>
);
```

### ArrayField Usage

For array items that are dynamically added or deleted, we provide the `ArrayField` component to simplify the operation of add / remove

For the detailed API of ArrayField, please refer to [ArrayField Props](#arrayfield-props) below

> Note: The initValue type of ArrayField must be an array

```jsx live=true dir="column"
import React from 'react';
import { ArrayField, TextArea, Form, Button, useFormState } from '@douyinfe/semi-ui';
import { IconPlusCircle, IconMinusCircle } from '@douyinfe/semi-icons';

class ArrayFieldDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            data: [
                { name: 'Semi D2C', role: 'Engineer' },
                { name: 'Semi C2D', role: 'Designer' },
            ]
        };
    }

    render() {
        let { data } = this.state;
        const ComponentUsingFormState = () => {
            const formState = useFormState();
            return (
                <TextArea style={{ marginTop: 10 }} value={JSON.stringify(formState)} />
            );
        };
        return (
            <Form style={{ width: 800 }} labelPosition='left' labelWidth='100px' allowEmpty>
                <ArrayField field='rules' initValue={data}>
                    {({ add, arrayFields, addWithInitValue }) => (
                        <React.Fragment>
                            <Button onClick={add} icon={<IconPlusCircle />} theme='light'>Add new line</Button>
                            <Button icon={<IconPlusCircle />} onClick={() => {addWithInitValue({ name: 'Semi DSM', type: 'Designer' });}} style={{ marginLeft: 8 }}>Add new line with init value</Button>
                            {
                                arrayFields.map(({ field, key, remove }, i) => (
                                    <div key={key} style={{ width: 1000, display: 'flex' }}>
                                        <Form.Input
                                            field={`${field}[name]`}
                                            label={`${field}.name`}
                                            style={{ width: 200, marginRight: 16 }}
                                        >
                                        </Form.Input>
                                        <Form.Select
                                            field={`${field}[role]`}
                                            label={`${field}.role`}
                                            style={{ width: 120 }}
                                            optionList={[
                                                { label: 'Engineer', value: 'Engineer' },
                                                { label: 'Designer', value: 'Designer' },
                                            ]}
                                        >
                                        </Form.Select>
                                        <Button
                                            type='danger'
                                            theme='borderless'
                                            icon={<IconMinusCircle />}
                                            onClick={remove}
                                            style={{ margin: 12 }}
                                        />
                                    </div>
                                ))
                            }
                        </React.Fragment>
                    )}
                </ArrayField>
                <ComponentUsingFormState />
            </Form>
        );
    }
}

```


#### Nesting ArrayField

ArrayField supports multi-level nesting. The following is an example of two-level nesting.

```jsx live=true dir="column" noInline=true
import { Form, ArrayField, Button, Card, Typography, } from "@douyinfe/semi-ui";
import { IconPlusCircle, IconMinusCircle } from "@douyinfe/semi-icons";
import React from "react";

const initValue = {
    group: [
        {
            name: "Email filtering rule 1",
            rules: [
                { itemName: "Sender address", type: "include" },
                { itemName: "Email Title", type: "exclude" },
            ],
        },
        {
            name: "Email filtering rule 2",
            rules: [
                { itemName: "Send time", type: "include" }
            ],
        },
    ]
};

const NestedField = (props) => {
    const rowStyle = {
        marginTop: 12,
        marginLeft: 12,
    };
    return (
        <ArrayField field={`${props.field}.rules`}>
            {({ add, arrayFields, addWithInitValue }) => (
                <React.Fragment>
                    {arrayFields.map(({ field, key, remove }, i) => (
                        <div style={{ display: "flex" }} key={key}>
                            <Form.Input
                                field={`${field}[itemName]`}
                                label={`${field}.itemName`}
                                noLabel
                                style={{ width: 140, marginRight: 12 }}
                            ></Form.Input>
                            <Form.Select
                                field={`${field}[type]`}
                                label={`${field}.type`}
                                noLabel
                                style={{ width: 140 }}
                                optionList={[
                                    { label: "Include", value: "include" },
                                    { label: "Exclude", value: "exclude" },
                                ]}
                            ></Form.Select>
                            <Button
                                type="danger"
                                theme="borderless"
                                style={rowStyle}
                                icon={<IconMinusCircle />}
                                onClick={remove}
                            />
                            <Button
                                icon={<IconPlusCircle />}
                                style={rowStyle}
                                disabled={i !== arrayFields.length - 1}
                                onClick={() => {
                                    addWithInitValue({
                                        itemName: `Condition ${arrayFields.length + 1}`,
                                        type: "include",
                                    });
                                }}
                            />
                        </div>
                    ))}
                </React.Fragment>
            )}
        </ArrayField>
    );
};

const NestArrayFieldDemo = () => {
    return (
        <Form
            onValueChange={(values) => console.log(values)}
            initValues={initValue}
            labelPosition="left"
            style={{ textAlign: "left" }}
            allowEmpty
        >
            <ArrayField field="group" >
                {({ add, arrayFields, addWithInitValue }) => (
                    <React.Fragment>
                        <Button
                            icon={<IconPlusCircle />}
                            theme="solid"
                            onClick={() => {
                                addWithInitValue({
                                    name: "New Rule",
                                    rules: [
                                        { itemName: "Main Text", type: "include" },
                                        { itemName: "Accessory name", type: "include" },
                                    ],
                                });
                            }}
                        >
                            Add receiving rules
                        </Button>
                        {arrayFields.map(({ field, key, remove }, i) => (
                            <div
                                key={key}
                                style={{ width: 1000, display: "flex", flexWrap: "wrap" }}
                            >
                                <Form.Input
                                    field={`${field}[name]`}
                                    labelPosition="top"
                                    label={"RuleName"}
                                    style={{ width: "600px" }}
                                ></Form.Input>
                                <Button
                                    type="danger"
                                    theme="borderless"
                                    style={{ margin: "36px 0 0 12px" }}
                                    icon={<IconMinusCircle />}
                                    onClick={remove}
                                />
                                <Typography.Text strong style={{ flexBasis: "100%" }}>
                                    When the mail arrives, the following conditions are met:
                                </Typography.Text>
                                <Card
                                    shadow="hover"
                                    style={{
                                        width: 620,
                                        margin: "12px 0 0 24px",
                                    }}
                                >
                                    <NestedField field={field} />
                                </Card>
                            </div>
                        ))}
                    </React.Fragment>
                )}
            </ArrayField>
        </Form>
    );
};

render(NestArrayFieldDemo);
```


#### Add or delete form items dynamically - by use formApi

If you don't use ArrayField, you can use the provided formApi to manually add or delete formState.

```jsx live=true dir="column"
import React from 'react';
import { Form, Button, TextArea } from '@douyinfe/semi-ui';

class ArrayDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            initValues: {
                effects: [
                    { name: 'Face stickers', type: '2D', key: 1 },
                    { name: 'Background sticker', type: '3D', key: 2 },
                ]
            }
        };
        this.id = 3;
        this.getFormApi = this.getFormApi.bind(this);
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
        this.renderItems = this.renderItems.bind(this);
    }
    getFormApi(formApi) {
        this.formApi = formApi;
    }
    add(obj) {
        let effects = this.formApi.getValue('effects');
        if (!effects) {
            effects = [];
        }
        effects.push({ name: '', type: '', key: this.id++ });
        this.formApi.setValue('effects', effects);
    }
    remove(key) {
        let effects = this.formApi.getValue('effects');
        effects = effects.filter((effect, index) => key !== effect.key);
        if (!effects.length) {
            effects = undefined;
        }
        this.formApi.setValue('effects', effects);
    }
    renderItems(formState, values) {
        return values.effects && values.effects.map((effect, i) => (
            <div key={effect.key} style={{ width: 1000, display: 'flex' }}>
                <Form.Input field={`effects[${i}].name`} style={{ width: 200, marginRight: 12 }}></Form.Input>
                <Form.Select field={`effects[${i}].type`} style={{ width: 90 }}>
                    <Form.Select.Option value='2D'>2D</Form.Select.Option>
                    <Form.Select.Option value='3D'>3D</Form.Select.Option>
                </Form.Select>
                <Button type='danger' onClick={() => this.remove(effect.key)} style={{ margin: 12 }}>Remove</Button>
            </div>
        ));
    }
    render() {
        let { initValues } = this.state;
        return (
            <Form
                getFormApi={this.getFormApi}
                initValues={initValues}
                style={{ width: 500 }}
                labelPosition='left'
                labelWidth='180px'
            >
                {({ formState, values }) => (
                    <>
                        <Button onClick={this.add}>add</Button>
                        {this.renderItems(formState, values)}
                        <TextArea style={{ marginTop: 10 }} value={JSON.stringify(formState.values)} />
                    </>
                )}
            </Form>
        );
    }
}
```

### Use of Hook

We provide four Hooks so that you can easily access Form internal state and call Form and Field related api in Functional Component which placed inside the Form structure without passing through props.

```jsx
import { useFormApi, useFormState, useFieldApi, useFieldState } from '@douyinfe/semi-ui';
```

#### useFormApi

`useFormApi` allows you to directly access the formApi of the parent Form component within Functional Component via hook

```jsx live=true dir="column" noInline=true
import React from 'react';
import { useFormApi, Form, Button } from '@douyinfe/semi-ui';

const ComponentUsingFormApi = () => {
    const formApi = useFormApi();
    const change = () => {
        formApi.setValue('name', Math.random());
    };
    return (
        <Button onClick={change}>ChangeName By【formApi】</Button>
    );
};

class UseFromApiDemo extends React.Component {
    render() {
        return (
            <Form>
                <Form.Input field='name' initValue='mike'></Form.Input>
                <ComponentUsingFormApi />
            </Form>
        );
    }
}

render(UseFromApiDemo);
```

#### useFormState

`useFormState` allows you to directly access the form State of the parent Form component within Functional Component via hook

```jsx live=true dir="column" noInline=true
import React from 'react';
import { useFormState, Form } from '@douyinfe/semi-ui';

const ComponentUsingFormState = () => {
    const formState = useFormState();
    return (
        <pre>
            <code>{JSON.stringify(formState)}</code>
        </pre>
    );
};

class UseFromStateDemo extends React.Component {
    render() {
        return (
            <Form>
                <Form.Input field='name' initValue='mike'></Form.Input>
                <h5>FormState read by 【useFormState】：</h5>
                <ComponentUsingFormState />
            </Form>
        );
    }
}

render(UseFromStateDemo);
```

#### useFieldApi

`useFieldApi` allows you to call the api of the specified Field directly within Functional Component via hook

```jsx live=true dir="column" noInline=true
import React from 'react';
import { useFieldApi, Form, Button } from '@douyinfe/semi-ui';

const ComponentUsingFieldApi = () => {
    const nameFieldApi = useFieldApi('name');
    const change = () => {
        nameFieldApi.setValue(Math.random());
    };
    return (
        <Button onClick={change}>Click Me!!! changeNameBy【fieldApi】</Button>
    );
};

class UseFieldApiDemo extends React.PureComponent {
    render() {
        return (
            <Form>
                <Form.Input field='name' initValue='mike'></Form.Input>
                <ComponentUsingFieldApi />
            </Form>
        );
    }
}

render(UseFieldApiDemo);
```
#### useFieldState

`useFieldState` allows you to directly access the State of the specified Field within Functional Component via hook

```jsx live=true dir="column" noInline=true
import React from 'react';
import { useFieldState, Form } from '@douyinfe/semi-ui';

const ComponentUsingFieldState = props => {
    const fieldState = useFieldState(props.field);
    return (
        <div style={props.style}>
            <span>【{props.field}】FieldState read by 【useFieldState】：</span>
            <code>{JSON.stringify(fieldState)}</code>
        </div>
    );
};
class UseFieldStateDemo extends React.PureComponent {
    render() {
        return (
            <Form>
                <Form.Input field='name' initValue='mike'></Form.Input>
                <Form.Input field='role' initValue='designer'></Form.Input>
                <div style={{ width: 500, marginTop: 12 }}>
                    <ComponentUsingFieldState field='name' style={{ marginTop: 0 }} />
                    <ComponentUsingFieldState field='role' style={{ marginTop: 12 }} />
                </div>
            </Form>
        );
    }
}

render(UseFieldStateDemo);


```

### Use of HOC

We provided two HOC: `withFormApi`、`withFormState`, you can access the API of the Form and the internal state within other components  
Provided HOC: `withField`, to encapsulating custom components as Field that conform the Semi Form data flow.

```jsx
import { withFormApi, withFormState, withField } from '@douyinfe/semi-ui';
```

#### HOC - withFormApi

You can encapsulate the component via `withFormApi` HOC so that the formApi of the parent Form component can be called directly inside the component  
Note that the encapsulated components must be placed inside the Form structure.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { withFormApi, Form, Button } from '@douyinfe/semi-ui';

const SomeComponetInsideForm = props => (
    <Button onClick={() => {
        props.formApi.setValue('name', Math.random());
    }}>Click Me!!! ChangeName By【formApi】</Button>
);
const ComponentWithFormApi = withFormApi(SomeComponetInsideForm);

class WithFormApiDemo extends React.Component {
    render() {
        return (
            <Form>
                <Form.Input field='name' initValue='semi'></Form.Input>
                <Form.Input field='familyName' initValue='design'></Form.Input>
                <Button htmlType='submit' style={{ marginRight: 4 }}>submit</Button>
                <ComponentWithFormApi />
            </Form>
        );
    }
}

render(WithFormApiDemo);
```

#### HOC - withFormState

You can encapsulate the component via `withFormState` HOC so that the component has direct access to the Form State of the parent Form component.  
Note that the encapsulated components must be placed inside the Form structure.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { withFormState, Form } from '@douyinfe/semi-ui';

const SomeComponentInsideForm = props => (
    <code>{JSON.stringify(props.formState)}</code>
);
const ComponentWithFormState = withFormState(SomeComponentInsideForm);

class WithFormStateDemo extends React.Component {
    render() {
        return (
            <Form>
                <Form.Input field='name' initValue='semi'></Form.Input>
                <Form.Input field='familyName' initValue='design'></Form.Input>
                <ComponentWithFormState />
            </Form>
        );
    }
}

render(WithFormStateDemo);
```

### Take over custom components

Via `withField`, you can extend other custom components into Field. Form will taking over its behavior.


<Notice type="primary" title="Notice">
   Custom components must be controlled components.
</Notice>

With Field did the following things.

-   Take over the `value` of the component (or other properties specified by valueKey), `onChange` (or other callback functions specified by onKeyChangeFnName)
-   Insert Field's `<Form.Label>`above the field
-   Insert Field's `<ErrorMessage>` under the field
-   Insert Field's extraText under the field

With Field Options specific configuration can be consulted [withFieldOption](#WithFieldOption)

Your custom controlled component needs to do the following:
- When the value changes, call `props.onChange` and use the latest value as an input parameter
- Respond to changes in `props.value` and update your component UI rendering results

```jsx
withField(YourComponent, withFieldOption);
```

```jsx live=true dir="column" noInline=true
import React from 'react';
import { withField, Form } from '@douyinfe/semi-ui';

// encapsulated html native input
const htmlInput = (props) => {
    let value = props.value || '';
    let { validateStatus, ...rest } = props; // prevent props being transparently transmitted to DOM
    return <input {...rest} value={value} />; 
};
const CustomInput = withField(htmlInput, { valueKey: 'value', onKeyChangeFnName: 'onChange', valuePath: 'target.value' });

// This component is used as an example, you can observe the formState here to see if the input data flow has been taken over by the form
const ComponentUsingFormState = () => {
    const formState = useFormState();
    return (
        <pre>
            <code>{JSON.stringify(formState)}</code>
        </pre>
    );
};

class WithFieldDemo1 extends React.Component {
    render() {
        return (
            <Form>
                <CustomInput field='name' />
                <ComponentUsingFormState />
            </Form>
        );
    }
}

render(WithFieldDemo1);
```


```jsx live=true dir="column" noInline=true
import React from 'react';
import { withField, Input, Select, Form } from '@douyinfe/semi-ui';

const MyComponent = (props) => {
    const { onChange, value } = props;
    const { name, role } = value || {};
    const handleChange = (v, type) => {
        let newValue = { ...value, [type==='name' ? 'name' : 'role']: v };
        onChange(newValue);
    };
    return (
        <div className='customField'>
            <Input prefix='Name' value={name} onChange={v => handleChange(v, 'name')} style={{ width: 180, marginRight: 12 }} />
            <Select
                prefix='Role'
                value={role}
                onChange={v => handleChange(v, 'role')}
                style={{ width: 200 }}
                optionList={[{ value: 'rd', label: 'Engineer' }, { value: 'UED', label: 'Designer' }]}
            />
        </div>
    );
};
const CustomField = withField(MyComponent, { valueKey: 'value', onKeyChangeFnName: 'onChange' });

const ComponentUsingFormState = () => {
    const formState = useFormState();
    return (
        <pre>
            <code>{JSON.stringify(formState)}</code>
        </pre>
    );
};

class WithFieldDemo2 extends React.Component {
    render() {
        return (
            <Form>
                <CustomField field='baseInfo' label={{ text: 'Basic info', required: true }} />
                <ComponentUsingFormState />
            </Form>
        );
    }
}

render(WithFieldDemo2);
```

## API reference

## Form Props

| Properties        | Instructions                                                                                                                                                                                                                                                                                                        | Type                                            | Default    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| autoScrollToError | If setting true，when submit or call formApi.validate () fails verification, it will automatically scroll to the wrong field, object config refer to [options](https://github.com/stipsan/scroll-into-view-if-needed#options)                                                                                       | boolean\| object                                | false      |
| allowEmpty        | Whether to keep the key of the null field in the values, keep the key when true, and remove the key when false    | boolean                                         | false      |
| component         | For declaring fields, not used at the same time as render, props.children                                                                                                                                                                                                                                           | ReactNode                                       |
| className         | Classname for form tag                                                                                                                                                                                                                                                                                              | string                                          |
| disabled          | If true, all fields inside the form structure will automatically inherit the disabled attribute                                                                                                                                                                                                                     | boolean                                         | false      |
| extraTextPosition | The extraTextPosition property applied to each Field uniformly controls the display position of extraText. Middle (the vertical direction is displayed in the order of Label, extraText, and Field), bottom (the vertical direction is displayed in the order of Label, Field, and extraText) | string                                          | 'bottom'   |
| getFormApi        | This function will be executed once when the form is mounted and returns formApi. <br/>formApi can be used to modify the internal state of the form (value, touched, error)                                                                                                                                         | function (formApi: object)                      |            |
| initValues        | Used to uniformly set the initial value of the form <br/>(will be consumed only once when form is mount)                                                                                                                                                                                                            | object                                          |            |
| layout            | The layout of fields, optional `horizontal` or `vertical`                                                                                                                                                                                                                                                           | string                                          | 'vertical' |
| labelCol          | Uniformly applied to the label label layout of each Field, with [Col Component](/en-US/basic/grid#Col), <br/>set `span`, `span` values, such as {span: 6, selected: 2}                                                                                                                     | object                                          |
| labelAlign        | Text-align value of label                                                                                                                                                                                                                                                                                           | string                                          | 'left'     |
| labelPosition     | Location of label in Field, optional 'top', 'left', 'inset' <br/> (inset label only partial component support)                                                                                                                                                                                                      | string                                          | 'top'      |
| labelWidth        | Width of field'r label                                                                                                                                                                                                                                                                                              | string\|number                                  |            |
| onChange          | Callback invoked when form update, including Fields mount/unmount / value change / <br/> blur / validation status change / error status change.                                                                                                                                                                     | function (formState: object)                    |            |
| onErrorChange     | Callback when the validation state of form updated. The first parameter: formState.errors, second parameter: name of the field that has changed and it's error message (available after v2.66)                                                       | function(values:object, changedError: object) |            |
| onValueChange     | Callback invoked when form values update. The first parameter: formState.values, second parameter: name of the field and it's value                                                                                                                                                                                                                                                                            | function (values: object, changedValue: object) |
| onReset           | Callback invoked after clicked on reset button or executed `formApi.reset()`                                                                                                                                                                                                                                        | function ()                                     |            |
| onSubmit          | Callback invoked after clicked on submit button or executed `formApi.submit()`, <br/>and all validation pass.                                                                                                                                                                                                        | function (values: object, e: event)                       |            |
| onSubmitFail      | Callback invoked after clicked on submit button or executed `formApi.submit()`,<br/> but validate failed.                                                                                                                                                                                                            | function (error: object, values: object, e: event)               |            |
| render            | For declaring fields, not used at the same time as component, props.children                                                                                                                                                                                                                                        | function                                        |
| showValidateIcon  | Whether the verification information block in the field automatically adds the corresponding status icon display                                                                                                                                                                               | boolean                                         | true       |
| style             | inline style of form element                                                                          | object                                        |
| stopValidateWithError | Apply stopValidateWithError to each Field uniformly. For usage instructions, see the API of the same name in Field props (available after v2.42)                                                                            | boolean                             | false     |
| stopPropagation | Whether to prevent submit or reset events from bubbling. This is used in nested Form scenarios to prevent events from propagating outwards when the inner Form submits or resets, triggering events in the outer Form. The default is `{ reset: false, submit: false }`(available after v2.63)                                                                              | object                             |      |
| trigger  | Apply the trigger uniformly to each Field to control the timing of verification. For detailed instructions, see the API of the same name in Field props.(available after v2.42)                                               | string\|array                            |  'change'  |
| validateFields    | Form-level custom validate functions are called at submit or formApi.validate(). <br/>Supported synchronous / asynchronous function                                                                                                                                                                                 | function (values)                               |            |
| wrapperCol        | Uniformly apply the layout on each Field, with [Col component](/en-US/basic/grid#Col), <br/>set `span`, `span` values, such as {span: 20, offset: 4}                                                                                                                                     | object                                          |

## FormState

FormState stores all the state values within the Form, including the values of each field, error information, touched status

| Name    | Instructions                                                                                                                     | Initial value | Example                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------- |
| values  | Value Collection of the form                                                                                                     | {}            | {fieldA: 'str', fieldB: true} |
| errors  | Form error information collection, you can decide whether to allow users to submit by judging whether there is error information | {}            | {fieldA: 'length not valid'}  |
| touched | The collection of fields the user has clicked on                                                                                 | {}            | {fieldA: true}                |

### How to access the form state

-   By calling `formApi.getFormState()`
-   By declaring fields through [child render function](/en-US/input/form#Various%20ways%20to%20declare%20form),  formState will injected as a parameter
-   By declaring fields through [render props](/en-US/input/form#Various%20ways%20to%20declare%20form), formState will injected as a parameter
-   Via [useFormState](#useFormState) hook
-   Via [withFormState](#withFormState) HOC

## FormApi

We provide FormApi. You have easy access to FormApi both inside and outside the Form, which allows you to use getter and setter to get and manipulate the values of FormState.   
The table below describes the features available in the formApi.


<Notice title='About scope isolation'>
 In order to prevent the user from accidentally modifying the internal state of the Form component after reading the internal state of formState, values  
 Semi will automatically execute deepClone once for  input parameters of `formApi.setValue` and `setValues` and the return results of `formApi.getFormState`, `getValue` and `getValues ` 
</Notice>


| Function      | Description                                                                        | example                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |-------------------------------------------------------------------------------------------------------------------------------|
| getFormProps  | Get Form Component Props, support after v2.57.0                                                                                                                                                                                                                                                                                                                      | formApi.getFormProps(propNames?: string[])                                                                                                        |
| getFormState  | Get FormState                                                                                                                                                                                                                                                                                                                      | formApi.getFormState()                                                                                                        |
| submitForm    | Manually submit form operation                                                                                                                                                                                                                                                                                               | formApi.submitForm()                                                                                                          |
| reset         | Reset the form manually                                                                                                                                                                                                                                                                                                            | formApi.reset(fields?: Array <string\>)                                                                                      |
| validate      | Manually trigger validation of the entire form. the verification of the entire Field will be triggered by default when no parameters are passed , if you want to trigger the verification of some fields, pass in the target field array <br/><br/> After the Form level validator is configured, the Field level validator will not be triggered again when submit or formApi.validate()  | formApi.validate() <br/>.then(values ​​=> {})<br/>.catch(errors => {})<br/>OR formApi.validate(['fieldA','fieldB'])           |
| setValues ​​  | Set the values ​​of the entire form. The isOverride in the second parameter is false by default. <br/> By default, only the values ​​of the existing field in the Form are updated from `newValues` to`formState.values`. <br/> When isOverride is `true`, the newValues ​​will be overwritten and assigned to formState.values ​​ | formApi.setValues(newValues: object, {isOverride: boolean})                                                                   |
| getValues ​​  | Get the values of all Field                                                                                                                                                                                                                                                                                                        | formApi.getValues()                                                                                                           |
| setValue      | provides direct modification of formState.values ​​method.<br/>The difference from `setValues` ​​is that it only modifies a single field.                                                                                                                                                                                          | formApi.setValue(field: string, newFieldValue: any)                                                                           |
| getValue      | Get the value of all / single Field                                                                                                                                                                                                                                                                                                | formApi.getValue()<br/>formApi.getValue(field: string)                                                                        |
| setTouched    | Modify formState.touched                                                                                                                                                                                                                                                                                                           | formApi.setTouched(field: string, isTouched: boolean)<br/>                                                                    |
| getTouched    | Get the touched state of the Field                                                                                                                                                                                                                                                                                                 | formApi.getTouched(field: string)                                                                                             |
| setError      | Modify the error information of a field                                                                                                                                                                                                                                                                                            | formApi.setError(field: string, fieldErrorMessage: string)                                                                    |
| getError      | Get Error Status of Field                                                                                                                                                                                                                                                                                                          | formApi.getError(field: string)                                                                                               |
| getFieldExist | Get whether the field exists in the Form                                                                                                                                                                                                                                                                                           | formApi.getFieldExist(field: string)                                                                                          |
| scrollToField | Scroll to the specified field, the second input parameter will be passed to scroll-into-view-if-needed | formApi.scrollToField(field: string, scrollOpts: [ScrollIntoViewOptions](https://github.com/stipsan/scroll-into-view-if-needed#options))                                                            |
| scrollToError | Scroll to the field with validation error. You can pass a specified field or index. If you pass index, scroll to the index-th error DOM. If you do not pass any parameters, scroll to the first validation error position in the DOM tree. Available after v2.61.0  | formApi.scrollToError(<ApiType detail='{field?: string; index?: number; scrollOpts?: ScrollIntoViewOptions }'>ScrollToErrorOptions</ApiType>) 

### How to access formApi

-   The Form component in the `ComponentDidMount` phase will execute the `getFormApi` callback passed in by props. You can save a reference to formApi in the callback function for subsequent calls (example code below)
    In addition, we provide other ways to get formApi, and you can choose different ways of calling according to your preference.
-   Use reference to get form instance，you can access form instance & its formApi
-   By declaring fields through "child render function", formApi will injected as a parameter
-   By declaring fields through "render props", formApi will injected as a parameter
-   Via [useFormApi](#useFormApi) hook for children component of Form
-   Via [withFormApi](#withFormApi) HOC for children component of Form

```jsx
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

class FormApiDemo extends React.Component {
    constructor() {
        super();
        this.getFormApi = this.getFormApi.bind(this);
        this.formBRef = React.createRef();
    }
    getFormApi(formApi) {
        this.formApi = formApi;
        // After getting the formApi object, you can use it to make any changes you want to the form
    }

    changeValues() {
        // use formApi to update formA
        this.formApi.setValues({ a: 1 });
        // use formApi to update formB
        this.formBRef.current.formApi.setValues({ b: 2 });
    }

    render() {
        return (
            <>
                <Form getFormApi={this.getFormApi} />
                <Form ref={this.formBRef} />
                <Button onClick={()=>this.changeValues()}>Change</Button>
            </>
        );
    }
}
```

```jsx
import React from 'react';
import { Form, Button } from '@douyinfe/semi-ui';

() => {
    // functional compoentn usage
    const api = useRef();

    return (
        <>
            <Form getFormApi={formApi => api.current = formApi}>
                <Form.Input field='a' />
                <Button onClick={()=>{console.log(api);}}>log</Button>
            </Form>
        </>
    );
};
```
## Field Props

<Notice type="primary" title="About Field ref">
    Versions before v1.30.0, the Field component will not do ref forwarding<br/>
    After v1.30, the underlying component instance can be obtained directly through ref, such as specifying ref to Form.Input and Form.Select, and directly obtaining the ref reference of the underlying original Input and Select components
</Notice>

| Properties            | Description                                                                                                                                                                                                                              | Type                                   | Default   | Examples                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------- | ------------------------------------------------------------------ |
| field                 | The mapping path of the field's value in formState.values. Form will use this value to distinguish the internal form control. <br/> **Required!!!**                                                                                      | string                                 |           |                            |
| label                 | The label text for this field. When not passed, it defaults to the same name as field                                                                                                                                                    | string                                 |           |
| labelPosition         | Label position of this field, optional 'top' / 'left' / 'inset'                                                                                                                                                                          | string                                 |           |
| labelAlign            | Text-align of the label text of this field                                                                                                                                                                                               | string                                 |           |
| labelWidth            | The width of the label text of this field                                                                                                                                                                                                | string\|number                         |           |
| noLabel               | When you don't need to add label automatically, you can set this value to true                                                                                                                                                           | boolean                                |           |
| name                  | Field name. When passed in, the corresponding className will be automatically added to the field wrapper div, such as: money => '.semi-form-field-money'. After v2.24, the name will also be transparently transmitted to the underlying component for consumption. For example, you can configure the name attribute of input                                                                           | string                                 |           |
| fieldClassName        | The className of the entire fieldWrapper is the same as the name parameter, except that the prefix is ​​not automatically appended                                                                                                       | string                                 |           |
| fieldStyle            | The inline style of the entire fieldWrapper <br/>**since v1.9.0**                                                                                                      | object                                 |           |
| initValue             | The initial value of the field (consumed only once when Field mounted, subsequent updates are invalid), it has higher priority than the values ​​in Form's initValues ​​                                                                 | any(type depends on current component) |           |
| validate              | The custom validation function for this form control. Supports synchronous and asynchronous verification. <br/> Rules does not take effect when validate is set                                                                           | function(fieldValue, values)           |           | (fieldValue) => fieldValue.length>5? 'error balabala': ''          |
| rules                 | validation rules, validation library based on [async-validator](https://github.com/yiminghe/async-validator)                                                                                                                             | array                                  |           | const rules = \[{type:' string ', message:' invalidate string'} \] |
| validateStatus        | The validation result status of this form control, optional: `success` / `error` / `warning` / `default`                                                                                                                                 | string                                 | 'default' |
| trigger               | The timing of triggering the verification, optional: `blur` / `change` / `custom` / `mount` <br/> 1. When set to custom, only formApi will trigger the verification <br/> 2.mount (triggered once when mounting)                          | string                                 | 'change'  |
| onChange              | Callback invoked when this field value changes                                                                                                                                                                                           |
| transform             | transform field values before validation                                                                                                                                                                                                 | function(fieldValue)                   |           | (value) => Number(value)                                           |
| allowEmptyString      | Whether to allow values to be empty strings. <br/>When the value is '' by default, the key corresponding to this field will be removed from `values`. <br/>If you want to keep the key, you need to set allowEmptyString to true           | boolean                                |           | false                                                              |
| convert               | After the field value changes, before rerender, update the value of filed                                                                                                                                                                | function(fieldValue)                   |           | (value) => newValue                                        |
| stopValidateWithError | When it is true, the rules check is used. After encountering the first rule that fails the check, it will no longer trigger the check of subsequent rules<br/>**since v0.35.0**                                                          | boolean                                |           | false                                                              |
| helpText              | Custom prompt information, which is displayed in the same block as the verification information. When both have values, the verification information is displayed first<br/>**since v1.0.0**                                             | ReactNode                              |           |                                                                    |
| extraText             | Additional prompt information, you can use this when both error information and prompt copy are required, after helpText/errorMessage<br/>**since v1.0.0**                                                                               | ReactNode                              |           |                                                                    |
| pure                  | Whether to only take over the data stream, when true, it will not automatically insert modules such as ErrorMessage, Label, extraText, etc. The style and DOM structure are consistent with the original components<br/>**since v1.1.0** | boolean                                | false     |                                                                    |
| extraTextPosition     | controls the display position of extraText. Middle (the vertical direction is displayed in the order of Label, extraText, and Field), bottom (the vertical direction is displayed in the order of Label, Field, and extraText) <br/>**since v1.9.0** | string                                | 'bottom'     |                                                                    |
| ...other              | The other configurable properties of the component can be passed in together with the above properties, such as the size / placeholder of Input，**Field passes it to the component itself**                                             |

## Field Api

We also provide `fieldApi`, most of which is similar to `formApi`, with the difference that fieldApi limits the scope of modification, and it can only modify the bound field

| Function   | Instructions                                      | example                                    |
| ---------- | ------------------------------------------------- | ------------------------------------------ |
| setValue   | Modify the value of the current Field             | fieldApi.setValue(newValue: any)           |
| getValue   | Gets the value of the current Field               | fieldApi.getValue()                        |
| setTouched | Modify the value of the current Field             | fieldApi.setTouched(true)                  |
| getTouched | Get Field's status                                | fieldApi.getTouched()                      |
| setError   | Modify the error information of the current Field | fieldApi.setError(newErrorMessage: string) |
| getError   | Gets field's error status                         | fieldApi.getError()                        |


## ArrayField Props
For dynamically added and deleted array form items, we provide the ArrayField scope to simplify add/remove operations

| Properties            | Description                                                              | Type      | Default     |
| --------------------- | ---------------------------------------------------------------- | -------- | --------- |
| field                 | The mapping path of the value of the form control in formState.values<br/>Required, for example, there is an ArrayField responsible for rendering a[0].name, a[1].name, a[2].name three lines, their The parent is a, here props.field should be `a`                                         | string                                                                                        |           |
| initValue             | The initial value of ArrayField, if the initial value is configured in both formProps.initValues and arrayFieldProps.initValue, the priority of the latter is higher | Array                        | []
| children              | The content of ArrayField, the type is Function, the function input parameters are operation functions such as add, addWithInitValue and arrayFields, and it should return ReactNode after execution | Function(ArrayFieldChildrenProps) => ReactNode  | 

```ts
interface ArrayFieldChildrenProps {
    arrayFields: ArrayFieldItem<>;                               // The current array form, which can be used to perform map operations to render each row
    add: () => void;                                             // Add blank line
    addWithInitValue: (lineObject: Record<string, any>) => void; // Add a new row with an initial value
}

interface ArrayFieldItem {
    key: string;        // A key used to identify the current row, which should be bound to the wrapper of the current row
    field: string;      // This row fieldPath, which is equivalent to ArrayFieldProps.field + [index]
    remove: () => void; // Remove operation function of this line, when called, this line will be deleted directly
}
```
## Form.Section

```jsx
import { Form } from '@douyinfe/semi-ui';
const { Section } = Form;
```

| Properties | Description       | Type      |
| ---------- | ------------------ | --------- |
| text       | Title of section   | ReactNode |
| className  | Classname          | string    |
| style      | Inline style       | object    |
| children   | Content of section | ReactNode |

## Form.Label

By default, `Label` is self-inserted into each `Field` by `Form`.  
If you need to self-insert Label elsewhere, we have provided the `Label` component for you.

```jsx
import { Form } from '@douyinfe/semi-ui';
const { Label } = Form;
```

| Properties | Description                    | Type      | Default |
| ---------- | ------------------------------- | --------- | ------- |
| text       | Label content                   | ReactNode |         |
| required   | Whether to show the required \* | boolean   | false   |
| extra      | Content after required          | ReactNode |         |
| align      | Text-align                      | string    | 'left'  |
| className  | Classname of label wrapper      | string    |         |
| style      | Inline style                    | string    |         |
| width      | Label width                     | number    |         |
| optional  | Whether to automatically append the "(optional)" text mark after the text (automatically switch the same semantic text according to different languages configured by Locale). When this item is true, the required \* will no longer be displayed.  | boolean    | false | v2.18.0 |

## Form.InputGroup

| Properties             | Description                                                      | Type                     | Default | Version |
| ---------------- | --------------------------------------------------------- | ------------------------ |--- |--- |
| className        | Classname of Form.InputGroup                                                  | string                   | |
| style            | Inline style                                                 | object                   ||
| label            | Label text of Form.InputGroup                      |  Label \| string                 | |
| labelPosition    | Label position，optional: 'top'/'left'/'inset'. When Form and InputGroup are passed in at the same time, the InputGroup props shall prevail | string     | 'top'|
| extraText        | Additional prompt information, when the error message and prompt text need to appear at the same time, you can use this, located after errorMessage | ReactNode | | v2.29.0 |
| extraTextPosition| Control the display position of extraText, optional `middle` (vertical direction is displayed in the order of Label, extraText, Group), `bottom` (vertical direction is displayed in the order of Label, Group, extraText)| string | 'bottom' | v2.29.0|

When extraTextPositon is middle and labelPosition is left. Since extraText is allowed to be ReactNode, the height of the content is variable, and the Label will no longer ensure that it can be aligned with the first line of text in the Field / InputGroup.

## Form.Slot

```jsx
import { Form } from '@douyinfe/semi-ui';
const { Slot } = Form;
```

| Properties | Instructions                                                                                                                                                                                            | Type           | Default |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------- |
| label      | Slot's [Label configuration](#Form.Label), for example {text: 'semi', align: 'left'}; can also be passed directly into string, inside the Slot will be automatically encapsulated in legal Label format | object\|string |         |
| className  | Classname of Slot Wrapper                                                                                                                                                                              | string         |         |
| style      | Slot inline style                                                                                                                                                                                       | object         |         |
| children   | Content of slot. You can place your custom component here                                                                                                                                               | ReactNode      |         |
| error      | ErrorMessage of Slot       | ErrorMessage\|ReactNode      |

## Form.ErrorMessage

```jsx
import { Form } from '@douyinfe/semi-ui';
const { ErrorMessage } = Form;
```

-   When the error is React Node, String, boolean, render directly
-   When the error is an array, the join operation is automatically performed to aggregate the error information in the array

| Properties | Instructions                      | Type                     |
| ---------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| error            | Error message content                                                                      | array\|ReactNode\|boolean         |
| className        | Classname of ErrorMessage wrapper                                                          | string                            |
| style            | Inline style                                                                               | object                            |
| showValidateIcon | Whether to automatically add the icon corresponding to validateStatus                      | boolean                           |
| validateStatus   | The verification status of the information, optional: default/error/warning/success (success is generally recommended to be the same as default) | string|


## withFieldOption

| key               | Description                                                                                                                                                                                                                                                                                                                                                                 | Default    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| valueKey          | The component represents the property of the value, such as Switch, Radio is' checked 'and Input is' value '                                                                                                                                                                                                                                                                | 'value'    |
| onKeyChangeFnName | The callback function when the component value changes, generally 'onChange'                                                                                                                                                                                                                                                                                                | 'onChange' |
| valuePath         | The path of the value attribute to the first parameter in the callback function, such as Radio's onChange (e.target. checked), then the value needs to be set to target .checked; Radio Group's onChange (e.target. value), which is' target .value '; if the first parameter is the value itself, there is no need to take the value down, the item does not need to be set |            |
| withCursor        | Do you need to maintain a cursor for Input class components                                                                                                                                                                                                                                                                                                                 | false      |

## Accessibility

### ARIA

- [aria-labelledby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-labelledby)、for
  - Field component will automatically add label DOM. The for attribute of label is the same as `props.id` or `props.name` or `props.field`; the `id` attribute of label is determined by `props.id` or `props.name` or `props.field`, and the value format is `${props.field}-label`;
  - When the props.labelPosition of the Form or Field is set to `inset`, there is no label tag at this time, but a div tag. The div tag corresponding to insetLabel will be automatically appended with `id`, the value is the same as the id of the above label, corresponding to the `aria-labelledby` of the Field component
  - The Field component will be automatically appended with `aria-labelledby`, the value is the same as the id of the above label
- [aria-required](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-required_attribute)
  - When the Field is configured with required fields (that is, props.rules contains require: true or props.label is configured with required: true), the Field component will be automatically appended with `aria-required = true` (except Form.Switch, Form.CheckboxGroup)
- [aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-invalid_attribute) 、[aria-errormessage](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-errormessage) 
  - When the Field check fails, the Field component will be automatically added with the `aria-invalid` = true attribute, except for Form.CheckboxGroup.
  - When the Field check fails, the Field component will be automatically appended with the `aria-errormessage` attribute, the value of which is the id of the DOM element corresponding to the errorMessage (format like: `${props.field}-errormessage`), except for Form.CheckboxGroup.
- [aria-describedby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-describedby_attribute)
  - When the Field is configured with `helpText` or `extraText`, the Field component will be automatically added with the `aria-describedby` attribute, whose value is the id of the DOM element corresponding to helpText and extraText (format like: `${props.field}-helpText` , `${props.field}-extraText`)

## Content Guidelines

- Form title
  - The title of the form needs to follow the writing specification of the title
- Form label
  - The label is a short description of the input box. The label is not a help text, so it should not be a description of the input
  - Labels must:
    - Place it above or below the input box
    - Short (1-3 words)
    - Use case conventions for statements (first letter uppercase, others lowercase)
- Help text
  - Help text use statement writing conventions, capitalized
- Form button
  - For the content Guidelines of the form button, refer to [Button component](/en-US/input/button) 

## Design Tokens

<DesignToken/>

## FAQ

-   **Why did I declare the form, modify the value, and the data is not automatically mapped to formState.values?**  
    Check that the field has been passed correctly, and the `field` attribute on the Field component is a must-fill property !

-   **Why doesn't the passed `defaultValue` or `defaultChecked` take effect?**  
    Refer to the beginning of the document [Field](#Field). The Form.Field component unifies the default value. You should pass the default value using `initValue` or `initValues`

-   **Why did the component not change and the value not take effect after `initValue` and `initValues` were updated asynchronously?**  
    `initValue`, `initValues` are only consumed once when Field and Form mount, and subsequent asynchronous updates will not take effect.  
    If your initial value needs to be taken remotely, you can update it using `formApi.setValue / setValues` after you get the value  
    Or send a new `key` directly to Form or Field to force it to remount.

-   **Why can't getValues get a certain field?**

    If the field has no initial value, `getValues` cannot get this item. You can set `initValues`/`initValue` or set the `allowEmpty` attribute to the form.

-   **Why does hitting enter on the input box trigger the form's submit?**

    This is standard HTML behavior. We do not plan to intervene and we will remain the same as the HTML. If there is really only one input element in the form, and you don't want to trigger the submit callback when you press Enter, it is recommended to use preventDefault for the enter of the keydown event of input to prevent the default behavior.

    Click <a href="https://github.com/DouyinFE/semi-design/issues/767" target="_blank">#767</a> for background and content.

-   **The form will automatically save the historical input items, what should I do if I don't want this function?**    
    Before v2.3, Form did not configure `for`, `name`, `id` and other attributes for input controls strictly according to the A11y accessibility standard, so this function was not available in previous versions. After v2.3, we implemented it strictly according to the W3C standard. If you don't want the browser to automatically save history input items, you can also turn it off by setting `autoComplete=off` at the Form level or Field level

-   **[🔍 🧾 More FAQ](https://bytedance.feishu.cn/docs/doccnNKaGhZMqyu0FufD1JGHOjf)**