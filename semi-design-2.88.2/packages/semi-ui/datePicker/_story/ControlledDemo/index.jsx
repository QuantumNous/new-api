import React, { useState, useMemo, useCallback, useEffect } from 'react';
import DatePicker from '../../index';
import { Button, Form, withField } from '../../../index';

const FormDatePicker = withField(props => {
    const { value, onChange, ...rest } = props;
    const mValue = !value ? null : +value; // number => Date 传入组件
    const mOnChange = (newValue, newDate) => {
        // 直接用第2个参数更方便
        // 当删除日期时，newDate为undefined
        if (!newDate) {
            props.onChange(undefined);
            return;
        }
        // Date => number 反映给上层
        props.onChange(+newDate);
    };
    return <DatePicker {...rest} value={mValue} onChange={mOnChange} />;
});

const Container = ({ children }) => {
    return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
};

const Item = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', marginBottom: 20 }}>{children}</div>
);

function Demo(props = {}) {
    const [value, setValue] = useState('2019-10-01');
    const onChange = v => {
        console.log(v);
        setValue(v);
    };
    const createOnChangeWithLog = setFn => (str, date) => {
        console.log(str, date);
        if (typeof setFn === 'function') {
            setFn(str);
        }
    };
    const printArgs = (...args) => {
        console.log('printArgs: ', ...args);
    };
    const [open, setOpen] = useState(true);
    const [value2, setValue2] = useState(new Date('2019-10-02 8:30:02'));
    const [value3] = useState(['2019-10-01', '20191002']);
    const [value4, setValue4] = useState(['2019-10-01', '2019-10-09']);
    const [value5] = useState(['2019-10-01', '20191109']);
    const [value6, setValue6] = useState(['2019-10-01', '20191109']);
    const [value7, setValue7] = useState(new Date('2019-11-02 11:32:11'));
    const [value8, setValue8] = useState('2019-11-02 11:32:11');

    return (
        <Container>
            {/* <span>参数open受控</span>
            <DatePicker
                type="date"
                value={value}
                onChange={onChange}
                open={open}
                // defaultOpen={open}
                motion={false}
                onOpenChange={status => {
                    printArgs(status);
                    // setOpen(status);
                }}
            />
            <br /> */}
            <Item>
                <span>date: value + onChange</span>
                <DatePicker type="date" value={value} onChange={onChange} />
            </Item>

            <Item>
                <span>dateTime: value </span>
                <DatePicker type="dateTime" value={value2} onChange={printArgs} />
            </Item>

            <Item>
                <span>dateTime: value + random + onChange </span>
                <DatePicker type="dateTime" value={value8} onChange={createOnChangeWithLog(setValue8)} />
                <Button onClick={() => setValue8(new Date())}>Random Value</Button>
            </Item>

            <Item>
                <span>dateTime: value + onChange + format </span>
                <DatePicker type="dateTime" format={'yyyy年MM月dd日 HH:mm:ss'} value={value7} onChange={setValue7} />
            </Item>

            <Item>
                <span>dateTime: value + onChange</span>
                <DatePicker
                    type="dateTime"
                    value={value2}
                    onChange={createOnChangeWithLog(setValue2)}
                    onBlur={printArgs}
                />
            </Item>

            <Item>
                <span>dateTime: value + onConfirm + needConfirm</span>
                <DatePicker type="dateTime" value={value2} onConfirm={setValue2} needConfirm />
            </Item>

            <Item>
                <span>date multiple: value</span>
                <DatePicker type="date" value={value3} multiple onChange={printArgs} />
            </Item>

            <Item>
                <span>date multiple: value + onChange</span>
                <DatePicker type="date" value={value4} onChange={setValue4} multiple />
            </Item>

            <Item>
                <span>dateRange: value</span>
                <DatePicker type="dateRange" value={value5} onChange={printArgs} />
            </Item>

            <Item>
                <span>dateRange: value + onChange</span>
                <DatePicker type="dateRange" value={value6} onChange={setValue6} />
            </Item>

            <Item>
                <span>Form.DatePicker dateTime initValue + onChange</span>
                <Form>
                    <Form.DatePicker initValue={new Date()} type={'dateTime'} />
                </Form>
            </Item>

            <Item>
                <span>withFied DatePicker dateTime initValue + onChange</span>
                <Form>
                    <FormDatePicker
                        field={'date'}
                        initValue={new Date()}
                        type={'dateTime'}
                        inputReadOnly
                        noLabel
                        rules={[{ required: true, message: '值不能为空' }]}
                    />
                </Form>
            </Item>
        </Container>
    );
}

export default Demo;
