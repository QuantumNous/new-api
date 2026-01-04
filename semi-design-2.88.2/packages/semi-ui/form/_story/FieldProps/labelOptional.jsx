import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Modal, TreeSelect, Row, Col, Avatar, Tabs, TabPane, Badge, LocaleProvider } from '@douyinfe/semi-ui';
import {
    Form,
} from '../../index';

const { Input, Select, DatePicker, Switch, Slider, CheckboxGroup, Checkbox, RadioGroup, Radio, TimePicker } = Form;


const LableOptionalDemo = () => {
    const helpText = <span style={{ color: 'var(--semi-color-warning)' }}>密码强度：弱</span>;
    return (
        <Form>
            <Form.Input
                field="semi"
                label={{ text: 'semi', optional: true }}
                helpText={helpText}
            />
            <Form.Input
                field="label2"
                label={{ text: 'semi', optional: true }}
                helpText={helpText}
            />
        </Form>
    );
};

export { LableOptionalDemo };