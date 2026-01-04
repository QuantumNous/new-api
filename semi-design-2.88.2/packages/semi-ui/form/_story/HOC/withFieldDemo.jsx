import React, { useState, useLayoutEffect, Component } from 'react';
import { storiesOf } from '@storybook/react';
import {
    Button,
    Modal,
    TreeSelect,
    Row,
    Col,
    Avatar,
    Select as BasicSelect,
    Form,
    useFormState,
    useFormApi,
    useFieldApi,
    useFieldState,
    withFormState,
    withFormApi,
    withField,
    ArrayField,
    AutoComplete
} from '../../../index';

import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';

import { ComponentUsingFormState, CustomStringify } from '../Hook/hookDemo';

const {
    Input,
    Select,
    DatePicker,
    Switch,
    Slider,
    CheckboxGroup,
    Checkbox,
    RadioGroup,
    Radio,
    TimePicker,
    InputNumber,
    InputGroup,
} = Form;

// 这里将html原生的input封装
const htmlInput = props => {
    let { validateStatus, ...rest } = props;
    let value = props.value || '';
    return <input {...rest} value={value} />;
};
const CustomInput = withField(htmlInput, {
    valueKey: 'value',
    onKeyChangeFnName: 'onChange',
    valuePath: 'target.value',
});

class CustomFieldDemo extends React.PureComponent {
    render() {
        // 观察formState，看input的数据流是否已被form接管
        const ComponentUsingFormState = () => {
            const formState = useFormState();
            return (
                <pre>
                    <code>{CustomStringify(formState)}</code>
                </pre>
            );
        };
        return (
            <Form>
                <CustomInput field="name" />
                <div>test</div>
                <ComponentUsingFormState />
            </Form>
        );
    }
}

const StateFulSelect = ({ value, onChange, onBlur, validateStatus }) => {
    const [song, setSong] = useState([]);

    const onSearch = inputValue => {
        if (inputValue === '') {
            setSong([]);
        } else {
            let songs = ['@XiamiMusic', '@TmeMusic', '@NeteaseMusic'].map(company => ({
                value: String(inputValue) + company,
                label: String(inputValue) + company,
            }));
            setSong(songs);
        }
    };
    return (
        <div>
            <BasicSelect
                value={value}
                style={{ width: 300 }}
                onChange={onChange}
                onSearch={onSearch}
                optionList={song}
                filter
                placeholder="type someting to search"
            />
        </div>
    );
};

class StatefulSelectClass extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            songs: [],
        };
    }

    onSearch = inputValue => {
        if (inputValue === '') {
            this.setState({ songs: [] });
        } else {
            let songs = ['@XiamiMusic', '@TmeMusic', '@NeteaseMusic'].map(company => ({
                value: String(inputValue) + company,
                label: String(inputValue) + company,
            }));
            this.setState({ song: songs });
        }
    };

    render() {
        let { value, onChange } = this.props;
        let { song } = this.state;
        return (
            <BasicSelect
                value={value}
                style={{ width: 300 }}
                onChange={onChange}
                onSearch={this.onSearch}
                optionList={song}
                filter
                multiple
                placeholder="type someting to search"
            />
        );
    }
}

let SelectField = withField(StateFulSelect);
let CSelectField = withField(StatefulSelectClass);

class WithFieldDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            visible: true,
        };
        this.formApi = null;
        this.validate = this.validate.bind(this);
        this.saveFormApi = this.saveFormApi.bind(this);
    }
    saveFormApi(formApi) {
        this.formApi = formApi;
    }

    validate() {
        this.formApi.validate().then(() => {
            // debugger;
        });
    }

    render() {
        return (
            <Form getFormApi={this.saveFormApi}>
                <SelectField field="name" />
                <CSelectField field="name2" />
                <ComponentUsingFormState />
                <Button onClick={() => this.validate()}>validate</Button>
            </Form>
        );
    }
}

class PureTest extends React.PureComponent {
    render() {
        console.log('render: test');
        return <div>test</div>;
    }
}
const PureTextWithField = withField(PureTest);

let NumberRange = props => {
    const { onChange = () => {} } = props || {};

    let value = props && props.value ? props.value : [null, null];
    let label = props && props.labelText ? props.labelText : null;
    let style = props && props.style ? props.style : null;
    console.log(props);
    const rangeChange = v => {
        onChange(v);
    };
    const oc1 = v => {
        rangeChange([v, value[1]]);
    };
    const oc2 = v => {
        rangeChange([value[0], v]);
    };


    return (
        <div className="number-range" style={{ width: 280 }}>
            {label ? <span className={`${BASE_CLASS_PREFIX}-select-inline-label`}>{label}</span> : null}
            <InputNumber style={{ width: 90 }} value={value[0]} onChange={oc1} min={0} />
            <span style={{ margin: '0 5px' }}>~</span>
            <InputNumber style={{ width: 90 }} value={value[1]} onChange={oc2} min={0} />
        </div>
    );
};

NumberRange = withField(NumberRange);

export { CustomFieldDemo, WithFieldDemo, NumberRange };
