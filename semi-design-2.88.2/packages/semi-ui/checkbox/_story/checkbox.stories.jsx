import React, { useCallback, useMemo, useState } from 'react';
import Button from '../../button';
import Popover from '../../popover';
import Tag from '../../tag';
import Cascader from '../../cascader';
import Checkbox from '../index';
import CheckboxGroup from '../checkboxGroup';
import { Col, Input, Row } from '../../index';
import { IconClose } from '@douyinfe/semi-icons';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';

export default {
  title: 'Checkbox',
}

export const CheckboxDefault = () => {
  return (
    <div>
      <Checkbox value={1} onChange={v => console.log(v)}>
        hello
      </Checkbox>
      <br />
      <Checkbox checked>这是一个受控的checked=true的checkbox,没有配onChange</Checkbox>
      <br />
      <Checkbox defaultChecked>这是一个不受控的defaultChecked=true的checkbox</Checkbox>
      <br />
      <Checkbox disabled>这是一个受控的disabled=true的checkbox</Checkbox>
      <br />
      <Checkbox checked disabled>
        既checked又disabled
      </Checkbox>
      <br />
      <Checkbox indeterminate>indeterminate</Checkbox>
      <Checkbox value={1} onChange={v => console.log(v)}>
      </Checkbox>
    </div>
  );
};

export const CheckboxWithoutText = () => {
  return (
    <div>
      <Checkbox aria-label='选择框示例' onChange={e => console.log(e)} />
    </div>
  );
};

class CheckboxControl extends React.Component {
  state = {
    checked: true,
    disabled: false,
  };
  toggleChecked = () => {
    this.setState({
      checked: !this.state.checked,
    });
  };
  toggleDisable = () => {
    this.setState({
      disabled: !this.state.disabled,
    });
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
        <p
          style={{
            marginBottom: '20px',
          }}
        >
          <Checkbox
            checked={this.state.checked}
            disabled={this.state.disabled}
            onChange={this.onChange}
          >
            {label}
          </Checkbox>
        </p>
        <p>
          <Button type="primary" size="small" onClick={this.toggleChecked}>
            {!this.state.checked ? 'Check' : 'Uncheck'}
          </Button>
          <Button
            style={{
              marginLeft: '10px',
            }}
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

export const CheckboxControlledDisabledChecked = () => <CheckboxControl />;

CheckboxControlledDisabledChecked.story = {
  name: 'checkbox controlled disabled & checked',
};

class GroupDemo extends React.Component {
  constructor() {
    super();
    this.state = {
      value: [],
    };
    this.onChange = this.onChange.bind(this);
  }

  onChange(value) {
    console.log(value);
    this.setState({
      value: value,
    });
  }

  render() {
    let { value } = this.state;
    return (
      <>
        水平Group
        <Checkbox.Group direction="horizontal" onChange={v => console.log(v)}>
          <Checkbox value="dy">抖音</Checkbox>
          <Checkbox value="hotsoon">火山</Checkbox>
          <Checkbox value="toutiao">今日头条</Checkbox>
          <Checkbox value="xigua">西瓜视频</Checkbox>
        </Checkbox.Group>
        <br />
        <br />
        垂直Group
        <Checkbox.Group onChange={v => console.log(v)}>
          <Checkbox value="dy">抖音</Checkbox>
          <Checkbox value="hotsoon">火山</Checkbox>
          <Checkbox value="toutiao">今日头条</Checkbox>
          <Checkbox value="xigua">西瓜视频</Checkbox>
        </Checkbox.Group>
        <br />
        <br />
        默认Group
        <Checkbox.Group direction="horizontal" defaultValue={['xigua']} onChange={console.log}>
          <Checkbox value="dy">抖音</Checkbox>
          <Checkbox value="hotsoon">火山</Checkbox>
          <Checkbox value="toutiao">今日头条</Checkbox>
          <Checkbox value="xigua">西瓜视频</Checkbox>
        </Checkbox.Group>
        <br />
        <br />
        受控Group
        <Checkbox.Group direction="horizontal" value={value} onChange={console.log}>
          <Checkbox value="dy">抖音</Checkbox>
          <Checkbox value="hotsoon">火山</Checkbox>
          <Checkbox value="toutiao">今日头条</Checkbox>
          <Checkbox value="xigua">西瓜视频</Checkbox>
        </Checkbox.Group>
        <br />
        <br />
        受控Group+onChange
        <Checkbox.Group direction="horizontal" value={value} onChange={this.onChange}>
          <Checkbox value="dy">抖音</Checkbox>
          <Checkbox value="hotsoon">火山</Checkbox>
          <Checkbox value="toutiao">今日头条</Checkbox>
          <Checkbox value="xigua">西瓜视频</Checkbox>
        </Checkbox.Group>
        <br />
        <br />
        disabled
        <Checkbox.Group disabled>
          <Checkbox value="dy">抖音</Checkbox>
          <Checkbox value="hotsoon">火山</Checkbox>
          <Checkbox value="toutiao">今日头条</Checkbox>
          <Checkbox value="xigua">西瓜视频</Checkbox>
        </Checkbox.Group>
      </>
    );
  }
}

export const CheckboxGroupDemo = () => <GroupDemo />;

export const CheckboxGroupWithOptions = () => {
  function onChange(checkedValues) {
    console.log('checked = ', checkedValues);
  }

  const plainOptions = ['green', 'red', 'pink'];
  const options = [
    {
      label: 'green',
      value: 'green',
    },
    {
      label: 'red',
      value: 'red',
    },
    {
      label: 'pink',
      value: 'pink',
      disabled: true,
    },
  ];
  const optionsWithDisabled = [
    {
      label: 'green',
      value: 'green',
    },
    {
      label: 'red',
      value: 'red',
    },
    {
      label: 'pink',
      value: 'pink',
      disabled: false,
    },
  ];
  return (
    <div>
      default
      <CheckboxGroup options={plainOptions} defaultValue={['green']} onChange={onChange} />
      <br />
      <br />
      受控
      <CheckboxGroup options={plainOptions} value={['green']} onChange={onChange} />
      <br />
      最后一个disabled
      <br />
      <CheckboxGroup options={options} defaultValue={['red']} onChange={onChange} />
      <br />
      全体disabled， 优先父级disabled，次选子级disabled
      <br />
      <CheckboxGroup
        options={optionsWithDisabled}
        disabled
        defaultValue={['green']}
        onChange={onChange}
      />
    </div>
  );
};

export const CheckboxGroupWithOtherTypeChild = () => {
  return (
    <CheckboxGroup>
      <div className="test">
        <Checkbox value="green" extra="苹果">
          green
        </Checkbox>
        <Checkbox value="red" extra="梨">
          red
        </Checkbox>
        <Checkbox value="pink" extra="橙子">
          pink
        </Checkbox>
      </div>
    </CheckboxGroup>
  );
};

CheckboxGroupWithOtherTypeChild.story = {
  name: 'checkboxGroup-直接后代是其他类型Node',
};

export const CheckboxExtra = () => {
  let options = [
    {
      label: 'green',
      value: 'green',
      extra: '苹果',
    },
    {
      label: 'red',
      value: 'red',
      extra: '梨',
    },
    {
      label: 'pink',
      value: 'pink',
      disabled: true,
      extra: '橙子',
    },
  ];
  return (
    <div>
      checkbox
      <Checkbox
        onChange={e => console.log(e)}
        extra="我是副文本，这是辅助的文本，辅助文本会更长一些，甚至还可能换行"
      >
        我是主文本
      </Checkbox>
      <Checkbox
        style={{
          width: 200,
        }}
        onChange={e => console.log(e)}
        extra="我是副文本，这是辅助的文本，辅助文本会更长一些，甚至还可能换行"
      >
        我是主文本
      </Checkbox>
      <br />
      <br />
      checkboxGroup
      <CheckboxGroup>
        <Checkbox value="green" extra="苹果">
          green
        </Checkbox>
        <Checkbox value="red" extra="梨">
          red
        </Checkbox>
        <Checkbox value="pink" extra="橙子">
          pink
        </Checkbox>
      </CheckboxGroup>
      <br />
      <br />
      checkboxGroup with options
      <CheckboxGroup options={options}></CheckboxGroup>
    </div>
  );
};

export const CheckboxGrid = () => {
  return (
    <Checkbox.Group
      style={{
        width: '100%',
      }}
      onChange={v => console.log(v)}
    >
      <Row>
        <Col span={8}>
          <Checkbox value="A">
            无限长的一串字The Storybook webapp UI can be customised with this addon. It can be used
            to change the header, show/hide various UI elements and to enable full-screen mode by
            default.
          </Checkbox>
        </Col>
        <Col span={8}>
          <Checkbox value="B">B</Checkbox>
        </Col>
        <Col span={8}>
          <Checkbox value="C">C</Checkbox>
        </Col>
        <Col span={8}>
          <Checkbox value="D">D</Checkbox>
        </Col>
        <Col span={8}>
          <Checkbox value="E">E</Checkbox>
        </Col>
      </Row>
    </Checkbox.Group>
  );
};

CheckboxGrid.story = {
  name: 'checkbox + grid',
};

export const IndeterminateDemo = () => {
  const options = ['yellow', 'green', 'red'];
  const defaultCheckedColors = ['yellow', 'red'];

  const [checkedList, setCheckList] = useState(defaultCheckedColors);
  const [indeterminate, setIndeterminate] = useState(true);
  const [checkAll, setCheckAll] = useState(false);

  const onCheckListChange = checkedList => {
    setCheckList([...checkedList]);
    setIndeterminate(!!checkedList.length && checkedList.length < options.length);
    setCheckAll(checkedList.length === options.length);
  };

  const onCheckAllChange = e => {
    setCheckList([...(e.target.checked ? options : [])]);
    setIndeterminate(false);
    setCheckAll(e.target.checked);
  };

  return (
    <div>
      <div
        style={{
          borderBottom: '1px solid #E9E9E9',
        }}
      >
        <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
          Check all
        </Checkbox>
      </div>
      <br />
      <CheckboxGroup options={options} value={checkedList} onChange={onCheckListChange} />
    </div>
  );
};

export const CheckboxRenderInDiv = () => (
  <>
    <div
      onClick={(...args) => {
        console.log('clicked checkbox outer: ', ...args);
      }}
    >
      <Checkbox
        aria-label='checkbox demo'
        onChange={(...args) => {
          console.log('clicked checkbox: ', ...args);
        }}
      />
    </div>
  </>
);

export const CheckboxInPopover = () => (
  <div>
    <Popover
      content={
        <div>
          <Checkbox>选项一</Checkbox>
          <Checkbox defaultChecked>选项二</Checkbox>
          <Checkbox>选项三</Checkbox>
        </div>
      }
    >
      <Button>click me</Button>
    </Popover>
  </div>
)

const SwitchCheckedFromTrue2Undefined = () => {
  const [props, setProps] = useState();
  const [flag, setFlag] = useState(0);

  const change = () => {
    if (flag === 0) {
      setFlag(1);
      setProps({ checked: true });
    } else {
      setFlag(0);
      setProps({ checked: false });
    }
  };

  return (
    <>
      <Checkbox {...props}>123</Checkbox>
      <Button onClick={() => change()}>switch</Button>
    </>
  );
};

export const CheckboxSwitchCheckedTrueUndefined = () => <SwitchCheckedFromTrue2Undefined />;

CheckboxSwitchCheckedTrueUndefined.story = {
  name: 'checkbox switch checked: true => undefined',
};

const TransformSelect = props => {
  const { onChange, value, options = [], defaultValue = [], placeholder } = props;
  const [currentValue, setCurrentValue] = useState([]);
  const [inputValue, setInputValue] = useState(''); // 变化

  const onSelectChange = useCallback(() => {
    setCurrentValue(currentValue);
    onChange && onChange(currentValue);
  }, []); // 选择某一个

  const removeValue = useCallback(
    currentIndex => {
      currentValue.splice(currentIndex, 1);
      onSelectChange([...currentValue]);
    },
    [currentValue]
  ); // 选择所有

  const selectAllValue = useCallback(() => {
    const value = options.map(option => option.value);
    onSelectChange(value);
  }, [options]);
  const viewsOptions = useMemo(() => {
    if (inputValue) {
      const newOptions = options.filter(option => option.label.indexOf(inputValue) !== -1);
      return newOptions;
    }

    return options;
  }, [options, inputValue]);
  return (
    <div>
      <div>
        <div>
          <Input
            aria-label='input'
            value={inputValue}
            prefix="search"
            clearable
            onChange={value => setInputValue(value)}
            placeholder={placeholder}
          />
        </div>
        <div>
          <span>{`共 ${options.length} 项`}</span>
          <Button type="tertiary" size="small" theme="borderless" onClick={() => selectAllValue()}>
            全选
          </Button>
        </div>
        <div>
          <CheckboxGroup
            aria-label='checkbox group box'
            options={viewsOptions}
            value={currentValue}
            onChange={onSelectChange}
            direction="vertical"
          />
        </div>
      </div>
      <div>
        <div>
          <span>{`已选 ${currentValue.length} 项`}</span>
          <Button
            type="tertiary"
            size="small"
            theme="borderless"
            onClick={() => onSelectChange([])}
          >
            清空
          </Button>
        </div>
        <div>
          {currentValue.length > 0 ? (
            currentValue.map((value, idx) => {
              // 不存在不需要展示
              const option = options.find(option => option.value === value);
              return (
                <div key={option.key ? option.key : idx}>
                  <span>{option.label}</span>
                  <span onClick={() => removeValue(idx)}>
                    <IconClose size="small" />
                  </span>
                </div>
              );
            })
          ) : (
            <div>暂无内容，可从左侧勾选</div>
          )}
        </div>
      </div>
    </div>
  );
};

export const BugDemo = () => <TransformSelect />;

export const CheckboxGroupCardStyle = () => (
  <>
    <div>常见情况</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' type="card" direction="horizontal" defaultValue={['1']}>
      <Checkbox value="1" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>Checkbox disabled</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' type="card" direction="horizontal" defaultValue={['1']}>
      <Checkbox value="1" disabled extra="disabled+checked" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" disabled extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>checkboxGroup disabled</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' type="card" direction="horizontal" disabled defaultValue={['1']}>
      <Checkbox value="1" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>文字很长，并且没有设置宽度，因此换行显示</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' type="card" direction="horizontal" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>设置了width=180</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' type="card" direction="horizontal" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>没有extra，width=180</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' type="card" direction="horizontal" defaultValue={['1']}>
      <Checkbox value="1" style={{ width: 180 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" style={{ width: 180 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" style={{ width: 180 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>没有标题，width=380</div>
    <CheckboxGroup key={getUuidShort({ prefix: 'test' })} aria-label='group demo' type="card" direction="horizontal" defaultValue={['1']}>
      <Checkbox
        value="1"
        aria-label='checkbox demo'
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Checkbox>
      <Checkbox
        value="2"
        aria-label='checkbox demo'
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Checkbox>
      <Checkbox
        value="3"
        aria-label='checkbox demo'
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <hr />
    <div>下面是垂直的情况：</div>
    <div>常见情况</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' direction="vertical" type="card" defaultValue={['1']}>
      <Checkbox value="1" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>没有设置宽度</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' direction="vertical" type="card" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>设置了width=380</div>
    <CheckboxGroup key={getUuidShort({ prefix: '' })} aria-label='group demo' direction="vertical" type="card" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
  </>
);

export const CheckboxGroupPureCardStyle = () => (
  <>
    <div>常见情况</div>
    <CheckboxGroup type="pureCard" defaultValue={['1']}>
      <Checkbox value="1" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>Checkbox disabled</div>
    <CheckboxGroup type="pureCard" defaultValue={['1']}>
      <Checkbox value="1" disabled extra="disabled+checked" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" disabled extra="disabled+unchecked" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>checkboxGroup disabled</div>
    <CheckboxGroup type="pureCard" disabled defaultValue={['1']}>
      <Checkbox value="1" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>文字很长，并且没有设置宽度，因此换行显示</div>
    <CheckboxGroup type="pureCard" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>设置了width=180</div>
    <CheckboxGroup type="pureCard" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 180 }}
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>没有extra，width=180</div>
    <CheckboxGroup type="pureCard" defaultValue={['1']}>
      <Checkbox value="1" style={{ width: 180 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" style={{ width: 180 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" style={{ width: 180 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>没有标题，width=380</div>
    <CheckboxGroup type="pureCard" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      ></Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <hr />
    <div>下面是垂直的情况：</div>
    <div>常见情况</div>
    <CheckboxGroup direction="vertical" type="pureCard" defaultValue={['1']}>
      <Checkbox value="1" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="2" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
      <Checkbox value="3" extra="Semi Design" style={{ width: 280 }}>
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>没有设置宽度</div>
    <CheckboxGroup direction="vertical" type="pureCard" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
    <br />
    <br />
    <div>设置了width=380</div>
    <CheckboxGroup direction="vertical" type="pureCard" defaultValue={['1']}>
      <Checkbox
        value="1"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="2"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Checkbox>
      <Checkbox
        value="3"
        extra="Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统"
        style={{ width: 380 }}
      >
        多选框标题
      </Checkbox>
    </CheckboxGroup>
  </>
);

export const CheckboxOnChangeEvent = () =>  (
  <div style={{marginLeft: 100}}>
      <div>查看 onChange 入参</div>
      <Checkbox onChange={e => console.log(e)}>
          Apple
      </Checkbox>
      <div style={{marginTop: 30}}>Popover 内套 Popover, 且 content 为 checkbox</div>
      <Popover
          trigger={'click'}
          onClickOutSide={e => console.log('onClickOutSide')}
          content={
              <Popover
                  trigger='click'
                  content={
                      <Checkbox
                          onChange={e => {
                              console.log('checkbox onChange', e);
                              e.stopPropagation();
                              e.nativeEvent && e.nativeEvent.stopImmediatePropagation();
                          }}
                      >
                          Semi Design
                      </Checkbox>
                  }
              >
                  trigger
              </Popover>
          }
      >
          <Tag>点击此处</Tag>
      </Popover>
      <div style={{marginTop: 30}}>Popover 内套 Cascader 多选</div>
      <Popover
          trigger={'click'}
          content={
              <Cascader
                  defaultValue={['zhejiang', 'ningbo', 'jiangbei']}
                  style={{ width: 300 }}
                  treeData={[
                      {
                          label: '浙江省',
                          value: 'zhejiang',
                          children: [
                              {
                                  label: '杭州市',
                                  value: 'hangzhou',
                                  children: [
                                      {
                                          label: '西湖区',
                                          value: 'xihu',
                                      },
                                  ],
                              },
                          ],
                      }
                  ]}
                  placeholder="请选择所在地区"
                  multiple
              />
          }
      >
          <Tag>点击此处</Tag>
      </Popover>
  </div>
);

CheckboxOnChangeEvent.story = {
  name: 'checkbox onChange event',
};