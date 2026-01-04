import React from 'react';

import './demo.scss';
import { Col, Row } from '../index';

export default {
  title: 'Grid'
}

export const GridDefault = () => (
  <div>
    <Row>
      <Col span={24}>col-24</Col>
    </Row>
    <Row>
      <Col span={12}>col-12</Col>
      <Col span={12}>col-12</Col>
    </Row>
    <Row>
      <Col span={8}>col-8</Col>
      <Col span={8}>col-8</Col>
      <Col span={8}>col-8</Col>
    </Row>
    <Row>
      <Col span={6}>col-6</Col>
      <Col span={6}>col-6</Col>
      <Col span={6}>col-6</Col>
      <Col span={6}>col-6</Col>
    </Row>
  </div>
);


export const GridWithGutter = () => (
  <div className="gutter-example">
    <p>横向间距16</p>
    <hr />
    <Row gutter={16}>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
    </Row>
    <p>横向间距16，纵向间距48</p>
    <hr />
    <Row gutter={[16, 48]}>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
    </Row>
    <p>横向间距16，纵向间距24</p>
    <hr />
    <Row gutter={[16, 24]}>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
      <Col className="gutter-row" span={6}>
        <div className="gutter-box">col-6</div>
      </Col>
    </Row>
  </div>
);

export const GridWithOffset = () => (
  <div>
    <Row>
      <Col span={8}>col-8</Col>
      <Col span={8} offset={8}>
        col-8
      </Col>
    </Row>
    <Row>
      <Col span={6} offset={6}>
        col-6 col-offset-6
      </Col>
      <Col span={6} offset={6}>
        col-6 col-offset-6
      </Col>
    </Row>
    <Row>
      <Col span={12} offset={6}>
        col-12 col-offset-6
      </Col>
    </Row>
  </div>
);

export const GridWithPullPush = () => (
  <div>
    <Row>
      <Col span={18} push={6}>
        col-18 col-push-6
      </Col>
      <Col span={6} pull={18}>
        col-6 col-pull-18
      </Col>
    </Row>
  </div>
);

export const GridWithTypeFlex = () => (
  <div>
    <p>sub-element align left</p>
    <Row type="flex" justify="start">
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
    </Row>

    <p>sub-element align center</p>
    <Row type="flex" justify="center">
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
    </Row>

    <p>sub-element align right</p>
    <Row type="flex" justify="end">
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
    </Row>

    <p>sub-element monospaced arrangement</p>
    <Row type="flex" justify="space-between">
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
    </Row>

    <p>sub-element align full</p>
    <Row type="flex" justify="space-around">
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
      <Col span={4}>col-4</Col>
    </Row>
  </div>
);

const DemoBox = props => <p className={`height-${props.value}`}>{props.children}</p>;

export const GridWithFlexChildVerticalAlign = () => (
  <div className="demo5">
    <p>Align Top</p>
    <Row type="flex" justify="center" align="top">
      <Col span={4}>
        <DemoBox value={100}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={50}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={120}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={80}>col-4</DemoBox>
      </Col>
    </Row>

    <p>Align Center</p>
    <Row type="flex" justify="space-around" align="middle">
      <Col span={4}>
        <DemoBox value={100}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={50}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={120}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={80}>col-4</DemoBox>
      </Col>
    </Row>

    <p>Align Bottom</p>
    <Row type="flex" justify="space-between" align="bottom">
      <Col span={4}>
        <DemoBox value={100}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={50}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={120}>col-4</DemoBox>
      </Col>
      <Col span={4}>
        <DemoBox value={80}>col-4</DemoBox>
      </Col>
    </Row>
  </div>
);

export const GridWithFlexOrder = () => (
  <div>
    <Row type="flex">
      <Col span={6} order={4}>
        1 col-order-4
      </Col>
      <Col span={6} order={3}>
        2 col-order-3
      </Col>
      <Col span={6} order={2}>
        3 col-order-2
      </Col>
      <Col span={6} order={1}>
        4 col-order-1
      </Col>
    </Row>
  </div>
);

export const GridBootstrap = () => (
  <div>
    <Row>
      <Col xs={2} sm={4} md={6} lg={8} xl={10}>
        Col
      </Col>
      <Col xs={20} sm={16} md={12} lg={8} xl={4}>
        Col
      </Col>
      <Col xs={2} sm={4} md={6} lg={8} xl={10}>
        Col
      </Col>
    </Row>
    <Row>
      <Col xs={{ span: 5, offset: 1 }} lg={{ span: 6, offset: 2 }}>
        Col
      </Col>
      <Col xs={{ span: 11, offset: 1 }} lg={{ span: 6, offset: 2 }}>
        Col
      </Col>
      <Col xs={{ span: 5, offset: 1 }} lg={{ span: 6, offset: 2 }}>
        Col
      </Col>
    </Row>
  </div>
);
