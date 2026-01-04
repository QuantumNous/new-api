import React, { useState } from 'react';
import Button from '../../button';
import Space from '../../space';

import { Col, Row } from '../../grid';
import { Form, Radio, RadioGroup, Tooltip } from '../../index';
import './radio.scss';

export default {
  title: 'Radio'
}

export const _Radio = () => {
  let cssStyle = {
    width: '200px',
  };
  return (
    <div style={cssStyle}>
      <Radio value="1">
        Experts say the abandonment of book reading may have some unappealing consequences for
        cognition. “People are clearly reading fewer books now than they used to, and that has to
        have a cost because we know book reading is very good cognitive exercise,” says Ken Pugh,
        director of research at the Yale-affiliated Haskins Laboratories, which examines the
        importance of spoken and written language.
      </Radio>
    </div>
  );
};

_Radio.story = {
  name: 'radio',
};

export const RadioWithExtra = () => {
  return (
    <>
      <Radio value="1" extra="这是辅助的文本，同厂辅助文本会更长一些，甚至还可能换行" name="demo-radio-1">
        示例文本
      </Radio>
      <Radio
        style={{ width: 200 }}
        value="1"
        extra="这是辅助的文本，同厂辅助文本会更长一些，甚至还可能换行"
        name="demo-radio-2"
      >
        示例文本
      </Radio>
    </>
  );
};

RadioWithExtra.story = {
  name: 'radio with extra',
};

export const RadioChecked = () => {
  return (
    <div>
      {'受控的checked = true'}
      <Radio value="1" checked>
        111
      </Radio>
      <br />
      {'受控的checked = false'}
      <Radio value="1" checked={false}>
        111
      </Radio>
      <br />
      {'不受控的defaultChecked = true'}
      <Radio value="1" defaultChecked={true}>
        111
      </Radio>
      <br />
      {'不受控的defaultChecked = false'}
      <Radio value="1" defaultChecked={false}>
        111
      </Radio>
    </div>
  );
};

RadioChecked.story = {
  name: 'radio checked',
};

export const RadioDisabled = () => {
  return (
    <div>
      <Radio value="1" checked disabled>
        111
      </Radio>
      <Radio value="1" disabled>
        111
      </Radio>
    </div>
  );
};

RadioDisabled.story = {
  name: 'radio disabled',
};

class RadioControl extends React.Component {
  state = {
    checked: true,
    disabled: false,
  };

  toggleChecked = () => {
    this.setState({ checked: !this.state.checked });
  };

  toggleDisable = () => {
    this.setState({ disabled: !this.state.disabled });
  };

  onChange = e => {
    console.log('checked = ', e.target.checked);
    this.setState({
      checked: e.target.checked,
    });
  };

  render() {
    const label = `${this.state.checked ? 'Checked' : 'Unchecked'}-${
      this.state.disabled ? 'Disabled' : 'Enabled'
    }`;
    return (
      <div>
        <p style={{ marginBottom: '20px' }}>
          <Radio
            checked={this.state.checked}
            disabled={this.state.disabled}
            onChange={this.onChange}
          >
            {label}
          </Radio>
        </p>
        <p>
          <Button type="primary" size="small" onClick={this.toggleChecked}>
            {!this.state.checked ? 'Check' : 'Uncheck'}
          </Button>
          <Button
            style={{ marginLeft: '10px' }}
            type="primary"
            size="small"
            onClick={this.toggleDisable}
          >
            {!this.state.disabled ? 'Disable' : 'Enable'}
          </Button>
        </p>
      </div>
    );
  }
}

export const RadioControlledDisabledChecked = () => <RadioControl />;

RadioControlledDisabledChecked.story = {
  name: 'Radio controlled disabled & checked',
};

const RadioGroup1 = () => {
  const [state, setChecked] = useState('1');
  console.log(state);

  return (
    <div>
      <Radio.Group
        value={state}
        onChange={evt => {
          setChecked(evt.target.value);
        }}
      >
        <Radio value="1" grouped>
          1
        </Radio>
        <Radio value="2" grouped>
          2
        </Radio>
      </Radio.Group>
      点击触发state变化，state变化触发展示变化
      <Radio.Group
        value={state}
        onChange={evt => {
          setChecked(evt.target.value);
        }}
      >
        <Radio value="2" grouped>
          2
        </Radio>
        <Radio value="1" grouped>
          1
        </Radio>
      </Radio.Group>
    </div>
  );
};
class RadioWithControlled extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: false,
    };
  }

  onChange(value) {
    this.setState({
      value: value.target.value,
    });
  }

  render() {
    return (
      <RadioGroup name="apple" value={this.state.value} onChange={this.onChange.bind(this)}>
        <Radio value={true}>111</Radio>
        <Radio value={false}>222</Radio>
      </RadioGroup>
    );
  }
}

export const _RadioGroup = () => {
  let onChange = data => {
    console.log('change', data);
  };

  return (
    <div>
      value=1
      <RadioGroup name="pie1" value="1" onChange={onChange}>
        <Radio value="1">111</Radio>
        <Radio value="2">222</Radio>
      </RadioGroup>
      <br />
      defaultValue=1
      <RadioGroup name="pie2" defaultValue="1" onChange={onChange}>
        <Radio value="1">111</Radio>
        <Radio value="2">222</Radio>
      </RadioGroup>
      <br />
      value+onchange
      <RadioWithControlled />
      <br />
      联动
      <RadioGroup1 />
    </div>
  );
};

_RadioGroup.story = {
  name: 'radio group',
};

export const RadioWithVertical = () => {
  return (
    <Radio.Group direction="vertical">
      <Radio value="A">
        无限长的一串字The Storybook webapp UI can be customised with this addon. It can be used to
        change the header, show/hide various UI elements and to enable full-screen mode by default.
      </Radio>
      <Radio value="C">
        C
      </Radio>
      <Radio value="D">
        D
      </Radio>
      <Radio value="E">
        E
      </Radio>
    </Radio.Group>
  );
};

RadioWithVertical.story = {
  name: 'radio with vertical',
};

export const RadioGroupWithOptions = () => {
  const plainOptions = ['Apple', 'Pear', 'Orange'];
  const options = [
    { label: 'Apple', value: 'Apple' },
    { label: 'Pear', value: 'Pear' },
    { label: 'Orange', value: 'Orange', disabled: true },
  ];
  const optionsWithDisabled = [
    { label: 'Apple', value: 'Apple' },
    { label: 'Pear', value: 'Pear' },
    { label: 'Orange', value: 'Orange', disabled: false },
  ];

  const optionsWithAddonStyle = [
    { label: 'Apple', value: 'Apple', addonStyle: { color: 'red' } },
    { label: 'Pear', value: 'Pear' },
    { label: 'Orange', value: 'Orange', disabled: true },
  ];

  function onChange(event) {
    console.log(event);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <RadioGroup name="apple" options={plainOptions} onChange={onChange} />
      <RadioGroup name="apple" options={options} onChange={onChange} />
      <RadioGroup name="apple" disabled options={optionsWithDisabled} onChange={onChange} />
      <span>自定义样式</span>
      <RadioGroup name="apple" options={optionsWithAddonStyle} onChange={onChange} />
      <span>PureCard 自定义样式</span>
      <RadioGroup type='pureCard' name="apple" options={optionsWithAddonStyle} onChange={onChange} />
    </div>
  );
};

RadioGroupWithOptions.story = {
  name: 'radio group with options',
};

const RadioWithAdvancedMode = () => {
  const [state, setChecked] = useState([true]);

  return (
    <div>
      <Radio
        checked={state}
        mode="advanced"
        onChange={e => {
          console.log(e);
          setChecked(e.target.checked);
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        111
      </Radio>
    </div>
  );
};
export const _RadioWithAdvancedMode = () => <RadioWithAdvancedMode />;

_RadioWithAdvancedMode.story = {
  name: 'radio with advanced mode',
};

export const RadioGroupWithAdvancedMode = () => {
  function onChange(evt) {
    console.log(evt);
  }

  return (
    <>
      <RadioGroup mode="advanced" onChange={onChange}>
        <Radio value="1">111</Radio>
        <Radio value="2">222</Radio>
        <Radio value="3">333</Radio>
      </RadioGroup>
      <br />
      <br />
      <RadioGroup mode="advanced" onChange={onChange} direction="horizontal">
        <div className="block-radio-wrapper">
          <Radio value="1">111</Radio>
        </div>
        <div className="block-radio-wrapper">
          <Radio value="2">222</Radio>
        </div>
        <div className="block-radio-wrapper">
          <Radio value="3">333</Radio>
        </div>
      </RadioGroup>
    </>
  );
};

RadioGroupWithAdvancedMode.story = {
  name: 'radio group with advanced mode',
};

export const RadioGrid = () => {
  return (
    <Radio.Group style={{ width: '100%' }}>
      <Row>
        <Col span={8}>
          <Radio value="A">
            无限长的一串字The Storybook webapp UI can be customised with this addon. It can be used
            to change the header, show/hide various UI elements and to enable full-screen mode by
            default.
          </Radio>
        </Col>
        <Col span={8}>
          <Radio value="B">B</Radio>
        </Col>
        <Col span={8}>
          <Radio value="C">C</Radio>
        </Col>
        <Col span={8}>
          <Radio value="D">D</Radio>
        </Col>
        <Col span={8}>
          <Radio value="E">E</Radio>
        </Col>
      </Row>
    </Radio.Group>
  );
};

RadioGrid.story = {
  name: 'radio + grid',
};

export const DynamicRadioGroup = () => {
  const Demo = () => {
    const [value, setValue] = useState(1);
    const onChange = e => {
      console.log('radio checked', e.target.value);

      setValue(e.target.value);
    };
    return (
      <RadioGroup onChange={onChange} value={value}>
        {value !== 4 ? <Radio value={1}>A</Radio> : null}
        <Radio value={2}>B</Radio>
        <Radio value={3}>C</Radio>
        <Radio value={4}>D</Radio>
      </RadioGroup>
    );
  };

  return <Demo />;
};
DynamicRadioGroup.style = {
  name: 'dynamic radioGroup'
};

export const RadioGroupButtonStyle = () => {
  const Demo = () => {
    const [value1, setValue1] = useState(1);
    const [value2, setValue2] = useState(2);
    const [value3, setValue3] = useState(3);
    const onChange1 = e => {
      setValue1(e.target.value);
    };
    const onChange2 = e => {
      setValue2(e.target.value);
    };
    const onChange3 = e => {
      setValue3(e.target.value);
    };

    const options = [
      { label: 'semi', value: 1 },
      { label: 'design', value: 2 },
      { label: 'designToCode', value: 3 },
      { label: 'dsm', value: 4 },
    ];
    
    const rowStyle = { marginBottom: 12 }

    const type = 'button';

    return (
      <Row>
        {/* default button radio */}
        <Col span={12}>
            <div style={rowStyle}>
              <RadioGroup type={type} buttonSize="small" onChange={onChange1} options={options} value={value1} name="demo-radio-button-1" />
            </div>
            <div style={rowStyle}>
              <RadioGroup type={type} buttonSize="middle" onChange={onChange2} options={options} value={value2} name="demo-radio-button-2" />
            </div>
            <div style={rowStyle}>
              <RadioGroup type={type} buttonSize="large" onChange={onChange3} options={options}  value={value3} name="demo-radio-button-3" />
            </div>
        </Col>

        {/* form radio button */}
        <Col span={12}>
            <Form>
                <div style={rowStyle}>
                  <Form.RadioGroup field='test1' type={type} buttonSize="small" onChange={onChange1} options={options}  value={value1} name="demo-radio-button-1">
                  </Form.RadioGroup>
                </div>
                <div style={rowStyle}>
                  <Form.RadioGroup field='test2' type={type} buttonSize="middle" onChange={onChange2} options={options}  value={value2} name="demo-radio-button-2">
                  </Form.RadioGroup>
                </div>
                <div style={rowStyle}>
                  <Form.RadioGroup field='test3' type={type} buttonSize="large" onChange={onChange3} options={options}  value={value3} name="demo-radio-button-3">
                  </Form.RadioGroup>
                </div>
            </Form>
        </Col>
      </Row>
    );
  };

  return <Demo />;
};
RadioGroupButtonStyle.story = {
  name: 'radioGroup button style'
};


export const RadioGroupCardStyle = () => (
  <>
    <div>常见情况</div>
    <RadioGroup type="card" defaultValue={1}>
      <Radio value={1} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>radio disabled</div>
    <RadioGroup type="card" defaultValue={1}>
      <Radio value={1} disabled extra="disabled+checked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} disabled extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>radioGroup disabled</div>
    <RadioGroup type="card" disabled defaultValue={1}>
      <Radio value={1} extra="disabled+checked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>文字很长，并且没有设置宽度，因此换行显示</div>
    <RadioGroup type="card" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>设置了width=180</div>
    <RadioGroup type="card" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>没有extra，width=180</div>
    <RadioGroup type="card" defaultValue={1}>
      <Radio value={1} style={{ width: 180 }}>
        多选框标题
      </Radio>
      <Radio value={2} style={{ width: 180 }}>
        多选框标题
      </Radio>
      <Radio value={3} style={{ width: 180 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>没有标题，width=380</div>
    <RadioGroup type="card" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Radio>
    </RadioGroup>
    <br />
    <br />
    <hr />
    <div>下面是垂直的情况：</div>
    <div>常见情况</div>
    <RadioGroup direction="vertical" type="card" defaultValue={1}>
      <Radio value={1} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>没有设置宽度</div>
    <RadioGroup direction="vertical" type="card" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>设置了width=380</div>
    <RadioGroup direction="vertical" type="card" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Radio>
    </RadioGroup>
  </>
);

RadioGroupCardStyle.story = {
  name: 'radioGroup card style'
}

export const RadioGroupPureCardStyle = () => (
  <>
    <div>常见情况</div>
    <RadioGroup type="pureCard" defaultValue={1}>
      <Radio value={1} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>radio disabled</div>
    <RadioGroup type="pureCard" defaultValue={1}>
      <Radio value={1} disabled extra="disabled+checked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} disabled extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>radioGroup disabled</div>
    <RadioGroup type="pureCard" disabled defaultValue={1}>
      <Radio value={1} extra="disabled+checked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>文字很长，并且没有设置宽度，因此换行显示</div>
    <RadioGroup type="pureCard" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>设置了width=180</div>
    <RadioGroup type="pureCard" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>没有extra，width=180</div>
    <RadioGroup type="pureCard" defaultValue={1}>
      <Radio value={1} style={{ width: 180 }}>
        多选框标题
      </Radio>
      <Radio value={2} style={{ width: 180 }}>
        多选框标题
      </Radio>
      <Radio value={3} style={{ width: 180 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>没有标题，width=380</div>
    <RadioGroup type="pureCard" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Radio>
    </RadioGroup>
    <br />
    <br />
    <hr />
    <div>下面是垂直的情况：</div>
    <div>常见情况</div>
    <RadioGroup direction="vertical" type="pureCard" defaultValue={1}>
      <Radio value={1} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={2} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
      <Radio value={3} extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>没有设置宽度</div>
    <RadioGroup direction="vertical" type="pureCard" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Radio>
    </RadioGroup>
    <br />
    <br />
    <div>设置了width=380</div>
    <RadioGroup direction="vertical" type="pureCard" defaultValue={1}>
      <Radio
        value={1}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={2}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Radio>
      <Radio
        value={3}
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Radio>
    </RadioGroup>
  </>
);
RadioGroupPureCardStyle.story = {
  name: 'radioGroup pureCard style'
}

export const FixWithFieldLossRef = () => {
  return (
    <Form>
        <Tooltip visible trigger="custom" content={'hi bytedance'}>
            <Form.Radio>Semi</Form.Radio>
        </Tooltip>
    </Form>
  );
}
FixWithFieldLossRef.storyName = '修复 Form Field 丢失 ref 问题 #384';


export const SwitchValueToNaN = () => {
  const [val, setVal] = useState(1);

  return (
    <>
      <RadioGroup direction="vertical" aria-label="单选组合示例" value={val}>
          <Radio value={1}>A</Radio>
          <Radio value={2}>B</Radio>
          <Radio value={3}>C</Radio>
          <Radio value={4}>D</Radio>
      </RadioGroup>
      <Space>
        <Button onClick={() => setVal(NaN)}>NaN</Button>
        <Button onClick={() => setVal(2)}>2</Button>
      </Space>
    </>
  );
}
SwitchValueToNaN.storyName = 'SwitchValueToNaN';