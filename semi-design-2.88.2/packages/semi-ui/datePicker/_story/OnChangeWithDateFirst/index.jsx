import React, { useCallback, useState } from 'react';
import { DatePicker, Form, Button } from '../../../index';

export default function Demo() {
    const log = (...args) => console.log(...args);
    const [date, setDate] = useState();

    const onChangeControlled = (date, dateStr) => {
        log(date, dateStr);
        setDate(date);
    };

    return (
        <div>
            <div>
                <h5>Uncontrolled</h5>
                <DatePicker onChange={log} onChangeWithDateFirst />
            </div>
            <div>
                <h5>Controlled</h5>
                <DatePicker value={date} onChange={onChangeControlled} onChangeWithDateFirst />
            </div>
            <div>
                <h5>Controlled in form</h5>
                <Form onSubmit={log}>
                    <Form.DatePicker
                        field={'date'}
                        initValue={date}
                        onChange={onChangeControlled}
                        onChangeWithDateFirst
                    />
                    <Button htmlType={'submit'}>提交</Button>
                </Form>
            </div>
        </div>
    );
}
