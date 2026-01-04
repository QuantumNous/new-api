import { Button, Form, Toast, Switch } from '@douyinfe/semi-ui';
import React, { useCallback, useRef, useState } from 'react';

const UnmountValidate = () => {
    const formRef = useRef();
    const [showInput, setShowInput] = useState(true);
    const [t, setT] = useState('xxxx');

    const test = useCallback(() => {
        setShowInput(false);
        setTimeout(() => {
            console.log('100ms, show input');
            setShowInput(true);
        }, 100);
    }, []);

    return (
        <Form layout="horizontal" onValueChange={values => console.log(values)} ref={formRef}>
            {({ formState, values, formApi }) => (
                <>
                    <Switch value={showInput} onChange={e => setShowInput(e)}></Switch>
                    {JSON.stringify(formState)}
                    {/* <Button
                        onClick={() => {
                            formRef.current.formApi.setError('input', `error by formApi${Math.random()}`);
                        }}
                    >
                        formApi setError
                    </Button> */}
                    {showInput && (
                        <Form.Input
                            label="输入te，然后组件会被卸载然后再挂载。卸载前触发的校验，异步结果后也不应该被写入"
                            field="input"
                            rules={[
                                {
                                    asyncValidator: (_, value) =>
                                        new Promise((resolve, reject) => {
                                            console.log('asyncValidator');
                                            // 测试
                                            if (value === 'te') {
                                                test();
                                            }
                                            if (value === 'ggg') {
                                                reject('这也是一个error值');
                                            }
                                            setTimeout(() => {
                                                if (value === 'te') {
                                                    console.log('asyncValidator reject');
                                                    debugger;
                                                    reject('不能输入 te（该错误返回时，组件已被卸载后重新挂载，旧的校验不应该再被写入）');
                                                } else {
                                                    console.log('asyncValidator resolve');
                                                    resolve();
                                                }
                                            }, 1000);
                                        }),
                                },
                            ]}
                        />
                    )}
                </>
            )}
        </Form>
    );
};

export default UnmountValidate;
