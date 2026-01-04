import React, { useEffect, useRef, useState } from 'react';
import { Form, Row, Col } from '@douyinfe/semi-ui';

import MyRadio from './myRadio';

export default function Demo() {
    const formRef = useRef(null);
    const [checkboxValue, setValue] = useState(false);

    useEffect(() => {
        console.log('didMount outer');
    }, []);

    return (
        <Form
            ref={formRef}
            style={{ padding: 10, width: '100%' }}
        >
            <Row>
                <Col span={12}>
                    {/* 为了避免子组件重新mount，需要在函数为抽取为单独的组件，或者在函数内useMemo、useCallback下 */}
                    {/* 否则setState引起子组件重新mount会重新消费initValue，可能会造成不符合预期的结果 */}
                    {/* 如点击Radio后并没有选中点击项，而选中的是initValue */}
                    <MyRadio formRef={formRef} setValue={setValue} />
                </Col>
            </Row>
            <div>checkboxValue: {`${checkboxValue}`}</div>
        </Form>
    );
}