import React, { useState, useLayoutEffect } from 'react';
import { storiesOf } from '@storybook/react';
import {
    Form,
    Button,
    Modal,
    TreeSelect,
    Row,
    Col,
    Avatar,
    Select as BasicSelect,
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
    Icon
} from '../../../index';
import { ComponentUsingFormState } from './Hook/hookDemo';
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

// 
