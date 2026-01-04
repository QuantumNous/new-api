import React from 'react';
import { storiesOf } from '@storybook/react';
import { Col, Row } from '../index';

const stories = storiesOf('Grid', module);

stories.add('grid default', () => (
    <>
        <Row>
            <Col span={12}>col-24</Col>
            <Col span={12}>col-12</Col>
            <Col span={12}>col-12</Col>
        </Row>
    </>
));
