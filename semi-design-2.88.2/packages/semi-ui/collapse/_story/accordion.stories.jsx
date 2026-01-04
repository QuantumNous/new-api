import React from 'react';
import Collapse from '..';
import { IconCopy } from '@douyinfe/semi-icons';

const Panel = Collapse.Panel;

const text = `
  A dog is a type of domesticated animal.
  Known for its loyalty and faithfulness,
  it can be found:a welcome guest in many households across the world.
`;

export default {
  title: 'Collapse',
}

export const RegularCollapse = () => (
  <div>
    <Collapse onChange={k => console.log(k)}>
      <Panel header="This is panel header 1" itemKey="1" showArrow={false}>
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 2" itemKey="2">
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 3" itemKey="3" disabled>
        <p>{text}</p>
      </Panel>
    </Collapse>
    <br />
    <Collapse defaultActiveKey={'124'} onChange={k => console.log(k)}>
      <Panel header="This is panel header 1" itemKey="1">
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 2" itemKey="124" disabled>
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 3" itemKey="3" disabled>
        <p>{text}</p>
      </Panel>
    </Collapse>
  </div>
);

export const Accordion = () => (
  <div>
    <Collapse defaultActiveKey={'123'} accordion onChange={k => console.log(k)}>
      <Panel header="This is panel header 1" itemKey="123">
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 2" itemKey="234">
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 3" itemKey="3" disabled>
        <p>{text}</p>
      </Panel>
    </Collapse>
  </div>
);

export const ExtraRendering = () => (
  <div>
    <Collapse activeKey={'123'} onChange={k => console.log(k)}>
      <Panel header="This is panel header 1" itemKey="123" extra="1234">
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 2" itemKey="2" extra={<IconCopy />}>
        <p>{text}</p>
      </Panel>
      <Panel header="This is panel header 3" itemKey="3" disabled>
        <p>{text}</p>
      </Panel>
    </Collapse>
  </div>
);

class ControlledDemo extends React.Component {
  constructor() {
    super();
    this.state = {
      value: [],
    };
  }

  onChange(value) {
    console.log(value);
    this.setState({
      value,
    });
  }

  render() {
    return (
      <Collapse activeKey={this.state.value} onChange={k => this.onChange(k)}>
        <Panel header="This is panel header 1" itemKey="123" extra="1234">
          <p>{text}</p>
        </Panel>
        <Panel header="This is panel header 2" itemKey="2" extra={<IconCopy />}>
          <p>{text}</p>
        </Panel>
        <Panel header="This is panel header 3" itemKey="3" disabled>
          <p>{text}</p>
        </Panel>
      </Collapse>
    );
  }
}

export const ControlledComponent = () => <ControlledDemo />;

class ControlledDemoAccordion extends React.Component {
  constructor() {
    super();
    this.state = {
      value: [],
    };
  }

  onChange(value) {
    console.log(value);
    this.setState({
      value,
    });
  }

  render() {
    return (
      <Collapse activeKey={this.state.value} accordion onChange={k => this.onChange(k)}>
        <Panel header="This is panel header 1" itemKey="123" extra="1234">
          <p>{text}</p>
        </Panel>
        <Panel header="This is panel header 2" itemKey="2" extra={<IconCopy />}>
          <p>{text}</p>
        </Panel>
        <Panel header="This is panel header 3" itemKey="3" disabled>
          <p>{text}</p>
        </Panel>
      </Collapse>
    );
  }
}

export const ControlledComponentAccordion = () => <ControlledDemoAccordion />;
