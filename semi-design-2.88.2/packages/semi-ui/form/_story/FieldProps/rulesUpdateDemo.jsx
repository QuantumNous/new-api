
import React, { useLayoutEffect, useRef, useContext, useState, Component } from 'react';
import { Button, Form, Select } from '@douyinfe/semi-ui';

const ApiContext = React.createContext({});

const HOC = Component => props => {
    let { text } = props;
    let { field } = props;

    const parentApi = useContext(ApiContext);

    const ref = useRef(props);

    const logProps = () => {
        // 通过props取，只能是当次render时的值
        console.log(`props: ${props.text}`);
        // 通过ref取，始终是最新的值
        // console.log(`ref.current: ${ref.current.text}`);
    };

    let content = (() => (
        <>
            {Component}
            <span>Props.text:</span> {text}
            <Button onClick={logProps}>子级自己内部触发log</Button>
        </>
    ))();

    useLayoutEffect(() => {
        ref.current = props;
    }, [props]);

    useLayoutEffect(() => {
        parentApi.register(field, {
            log: logProps,
        });

        return () => {};
    }, [field]);

    return content;
};

let D = HOC(<div />);

class UpdateDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            text: 'semi',
        };
        this.change = this.change.bind(this);
        this.triggerChildLog = this.triggerChildLog.bind(this);
        this.fields = {};
    }

    change() {
        this.setState({ text: Math.random() });
    }

    register(field, fieldApi) {
        this.fields.name = {
            func: fieldApi,
        };
    }

    triggerChildLog() {
        this.fields.name.func.log();
    }

    render() {
        const { text } = this.state;
        const api = {
            register: this.register.bind(this),
        };
        return (
            <div>
                <ApiContext.Provider value={api}>
                    <div>
                        <D text={text} field="name" />
                    </div>
                    <Button onClick={this.change}>父级动态改变子级props</Button>
                    <Button onClick={this.triggerChildLog}>由父级触发子级的log函数</Button>
                </ApiContext.Provider>
            </div>
        );
    }
}

const RuleupdateDemo = () => {
    const [val, setVal] = useState(['fefe']);
    const change = () => {
        let arr = [];
        arr[0] = Math.random();
        setVal(arr);
        return false;
    };
    return (
        <Form layout="horizontal">
            {({ formState, values, formApi }) => (
                <>
                    <Form.Input field="UserName" label="用户名" test={val} rules={ values.required ? [{ required: values.required }]: [] } />
                    {/* <Form.Input field="UserName" label="用户名" test={val} rules={ [{ required: values.required }] } /> */}
                    <Form.Switch field="required" />
                    <Button onClick={change}>change</Button>
                    <Button htmlType="submit">submit</Button>
                    <code style={{ marginTop: 30 }}>{JSON.stringify(formState)}</code>
                </>
            )}
        </Form>
    );
};

export { UpdateDemo, RuleupdateDemo };
