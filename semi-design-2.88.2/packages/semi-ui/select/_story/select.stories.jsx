import React, { useState, useRef, useEffect } from 'react';

import './select.scss';
import { Input, Select, Button, Icon, Avatar, Checkbox, Form, withField, Space, Tag, Switch, Divider, RadioGroup } from '../../index';
import CustomTrigger from './CustomTrigger';
import classNames from 'classnames';
const Option = Select.Option;
import { IconSearch, IconGift } from '@douyinfe/semi-icons';

export default {
  title: 'Select',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

let Test = () => {
  let [options, setOptions] = useState([1, 2, 3, 4]);

  function add() {
    let newOptions = Array.from(
      {
        length: Math.floor(Math.random() * 10),
      },
      (v, i) => i + 1
    );
    setOptions(newOptions);
  }

  let style = {
    width: 150,
    margin: 20,
  };
  let slotStyle = {
    backgroundColor: 'whitesmoke',
    height: '40px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '0 0 6px 6px',
  };
  let outSlotStyle = {
    backgroundColor: 'whitesmoke',
    height: '29px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  };

  const click = e => {};

  let outSlotNode = (
    <div onClick={e => click(e)}>
      <Checkbox>sendLarkNotification</Checkbox>
      <div>
        <Button theme="solid">confirm</Button>
      </div>
    </div>
  );
  return (
    <>
      <Select
        style={style}
        dropdownClassName="test-dropdown"
        dropdownStyle={{
          width: 150,
        }}
        filter
        placeholder="fefe"
        position="rightTop"
        innerBottomSlot={
          <div style={slotStyle}>
            <Button
              size="small"
              style={{
                margin: 0,
              }}
            >
              申请其他地区权限
            </Button>
          </div>
        }
      >
        {options.map(option => (
          <Option value={option} key={option} className="fefe">
            {option}
          </Option>
        ))}
      </Select>
      <Select
        style={{
          marginTop: 20,
          width: 200,
        }}
        dropdownClassName="test-dropdown"
        dropdownStyle={{
          width: 150,
        }}
        filter
        placeholder="fefe"
        position="rightTop"
        outerBottomSlot={outSlotNode}
      >
        {options.map(option => (
          <Option value={option} key={option} className="fefe">
            {option}
          </Option>
        ))}
      </Select>
    </>
  );
};

const AutoFocusDemo = () => {
  return (
    <>
      <Select
        autoFocus
        style={{
          width: 200,
        }}
        onFocus={() => console.log('onFocus')}
        onBlur={() => console.log('onBlur')}
      >
        <Option value="abc" data-test-id='douyin' data-shortcut='dy'>抖音</Option>
        <Option value="hotsoon" data-test-id='hotsoon'>火山</Option>
        <Option value="capcut" data-test-id='capcut'>剪映</Option>
        <Option value="duoshan" data-test-id='duoshan'>多闪</Option>
        <Option value="xigua" data-test-id='xigua'>西瓜视频</Option>
      </Select>
      <div className="test-div">test-div</div>
    </>
  );
};

export const AutoFocus = () => <AutoFocusDemo />;

AutoFocus.story = {
  name: 'autoFocus',
};

export const InnerBottomSlotOuterBottomSlot = () => <Test />;

InnerBottomSlotOuterBottomSlot.story = {
  name: 'innerBottomSlot / outerBottomSlot',
};

export const InnerTopSlotOuterTopSlot = () => {
  const slot = <div>未找到应用？</div>;
  return (
    <div>
      innerTopSlot
      <div>
        <Select
          innerTopSlot={slot}
          style={{
            width: 250,
          }}
          maxHeight={150}
        >
          <Option value="abc">抖音</Option>
          <Option value="hotsoon">火山</Option>
          <Option value="pipixia">皮皮虾</Option>
          <Option value="duoshan">多闪</Option>
          <Option value="xigua">西瓜视频</Option>
        </Select>
      </div>
      outerTopSlot
      <div>
        <Select
          outerTopSlot={slot}
          style={{
            width: 250,
          }}
          maxHeight={150}
        >
          <Option value="abc">抖音</Option>
          <Option value="hotsoon">火山</Option>
          <Option value="pipixia">皮皮虾</Option>
          <Option value="duoshan">多闪</Option>
          <Option value="xigua">西瓜视频</Option>
        </Select>
      </div>
    </div>
  );
};

InnerTopSlotOuterTopSlot.story = {
  name: 'innerTopSlot / outerTopSlot',
};

export const OneOptionJsxWithOtherOptionArray = () => (
  <Select
    defaultValue={'all'}
    style={{
      width: 250,
    }}
  >
    <Option value="all" key="all">
      all
    </Option>
    {[1, 2, 3].map(item => (
      <Option value={`type${item}`} key={item}>{`type${item}`}</Option>
    ))}
  </Select>
);

OneOptionJsxWithOtherOptionArray.story = {
  name: 'one option jsx with other option array',
};

let options = [
  {
    value: 'all',
    label: '全部',
    otherKey: 'all semi',
  },
  {
    value: 'abc',
    label: '抖音',
    otherKey: 'abc semi',
  },
  {
    value: 'hotsoon',
    label: '火山小视频',
    otherKey: 'hostsoom semi',
  },
  {
    value: 'pipixia',
    label: '皮皮虾',
    otherKey: 'pif',
  },
  {
    value: 'toutiao',
    label: '今日头条',
    otherKey: 'toutiao semi',
  },
  {
    value: 'rd',
    label: 'rd',
    otherKey: 'semi rd',
  },
  {
    value: 'ued',
    label: 'ued',
    otherKey: 'semi ued',
  },
  {
    value: 'ued',
    label: 'japan',
    otherKey: 'semi ued',
  },
  {
    value: '+86',
    label: '+86',
    otherKey: 'semi',
  },
];
let longOptions = options.concat({
  value: 'long',
  label: 'Semi Design 是一个设计系统，它定义了一套中后台设计与前端基础组',
});

export const SelectSize = () => (
  <div
    style={{
      margin: 20,
    }}
  >
    <h4>
      使用方不设width时，下拉菜单根据内容自动适配宽度（不推荐这样使用，select的宽度会动态变化）
    </h4>
    <Select
      defaultValue={'all'}
      optionList={options}
      style={{
        margin: 10,
      }}
    ></Select>
    <Select
      defaultValue={'long'}
      optionList={longOptions}
      style={{
        margin: 10,
      }}
    ></Select>
    <Select
      defaultValue={'abc'}
      size="large"
      optionList={options}
      style={{
        margin: 10,
      }}
    ></Select>
    {/* <Select defaultValue={'+86'} size="large" optionList={options}  style={{margin: 10}}>
    </Select> */}
    <h4>通过style设width的</h4>
    90px:{' '}
    <Select
      defaultValue={'all'}
      style={{
        width: 90,
        marign: 10,
      }}
      optionList={options}
    ></Select>
    120px:{' '}
    <Select
      defaultValue={'all'}
      style={{
        width: 120,
        margin: 10,
      }}
      optionList={options}
    ></Select>
    400px:{' '}
    <Select
      defaultValue={'all'}
      style={{
        width: 400,
        margin: 10,
      }}
      optionList={options}
    ></Select>
    <br />
    100%:{' '}
    <Select
      defaultValue={'all'}
      style={{
        width: '100%',
        margin: 10,
      }}
      optionList={options}
    ></Select>
    <br />
    <h4>通过css设width的</h4>
    <Select defaultValue={'all'} className="test-width" optionList={options}></Select>
    <br />
    <h4>dropdownMatchSelectWidth</h4>
    <p>当该项设为true时，下拉菜单最小宽度会等于Select宽度（默认为true）</p>
    <div
      style={{
        margin: 10,
      }}
    >
      style方式指定90px：
      <Select
        defaultValue={'all'}
        optionList={options}
        dropdownMatchSelectWidth={true}
        style={{
          width: 90,
        }}
      />
    </div>
    <div
      style={{
        margin: 10,
      }}
    >
      css方式声明130px:
      <Select
        defaultValue={'all'}
        className="test-width"
        optionList={options}
        dropdownMatchSelectWidth={true}
      ></Select>
    </div>
    <div>
      <h4>需要强制下拉菜单与select同宽的时候</h4>
      <p>通过dropdownStyle覆盖min-width，将其设成与select的width同样的值</p>
      <Select
        defaultValue={'all'}
        style={{
          width: 300,
          margin: 10,
        }}
        dropdownStyle={{
          width: 300,
        }}
        optionList={options}
      />
    </div>
  </div>
);

SelectSize.story = {
  name: 'select size',
};

export const WithPrefixSuffixInsetLabelShowClearShowArrow = () => (
  <>
    <h4>prefix & suffix</h4>
    <Select
      style={{
        width: '250px',
      }}
      motion={false}
      filter
      optionList={options}
      prefix={<IconSearch />}
      suffix={<IconGift></IconGift>}
    ></Select>
    <Select
      style={{
        width: '250px',
      }}
      motion={false}
      filter
      optionList={options}
      prefix={"Prefix"}
      suffix={"Suffix"}
    ></Select>
    <h4>insetLabel</h4>
    <Select
      style={{
        width: '250px',
      }}
      optionList={options}
      insetLabel={'业务线'}
    ></Select>
    <h4>showClear</h4>
    <Select
      style={{
        width: '250px',
      }}
      optionList={options}
      showClear
    ></Select>
    <h4>showArrow = false</h4>
    <Select
      style={{
        width: '250px',
      }}
      optionList={options}
      showArrow={false}
    ></Select>

    <h4>defaultValue是不存在的值</h4>
    <Select
      style={{
        width: '250px',
      }}
      optionList={options}
      defaultValue="+85"
    ></Select>
  </>
);

WithPrefixSuffixInsetLabelShowClearShowArrow.story = {
  name: 'with prefix / suffix / insetLabel, showClear, showArrow',
};
WithPrefixSuffixInsetLabelShowClearShowArrow.parameters = {
  chromatic: { disableSnapshot: false },
};

export const WithDefaultSelected = () => (
  <Select
    style={{
      width: '250px',
    }}
    defaultValue={1}
  >
    <Option value={1}>opt1</Option>
    <Option value={2}>opt2</Option>
    <Option value={3}>opt3</Option>
    <Option value="4">opt4</Option>
  </Select>
);

WithDefaultSelected.story = {
  name: 'with default selected',
};

export const WithScrollbar = () => (
  <Select
    style={{
      width: '250px',
    }}
    defaultValue={1}
  >
    <Option value={1}>opt1</Option>
    <Option value={2}>opt2</Option>
    <Option value={3}>opt3</Option>
    <Option value="4">opt4</Option>
    <Option value={5}>opt5</Option>
    <Option value={6}>opt6</Option>
    <Option value={7}>opt7</Option>
    <Option value="8">opt8</Option>
    <Option value={9}>opt9</Option>
    <Option value={10}>opt10dfsdfsdfdsfdsfsdf</Option>
    <Option value={11}>opt11</Option>
    <Option value="12">opt12jfldsjflsdjlfldjslfjhifsdfdsfdsffdsodsjlfhjl</Option>
  </Select>
);

WithScrollbar.story = {
  name: 'with scrollbar',
};

class Link extends React.Component {
  get provinces() {
    return ['Sichuan', 'Guangdong'];
  }

  get maps() {
    return {
      Sichuan: ['Chengdu', 'Dujiangyan'],
      Guangdong: ['Guangzhou', 'Shenzhen', 'Dongguan'],
    };
  }

  constructor() {
    super();
    this.state = {
      provinces: this.provinces,
      maps: this.maps,
      citys: this.maps[this.provinces[0]],
      city: this.maps[this.provinces[0]][0],
    };
    this.provinceChange = this.provinceChange.bind(this);
    this.cityChange = this.cityChange.bind(this);
  }

  provinceChange(newProvince) {
    const { maps } = this.state;
    this.setState({
      citys: maps[newProvince],
      city: maps[newProvince][0],
    });
  }

  cityChange(city) {
    this.setState({
      city,
    });
  }

  render() {
    const { provinces, citys, city } = this.state;
    return (
      <React.Fragment>
        <Select
          style={{
            width: '150px',
            margin: '10px',
          }}
          onChange={this.provinceChange}
          defaultValue={provinces[0]}
        >
          {provinces.map(pro => (
            <Option value={pro} key={pro}>
              {pro}
            </Option>
          ))}
        </Select>
        <Select
          style={{
            width: '150px',
            margin: '10px',
          }}
          value={city}
          onChange={this.cityChange}
        >
          {citys.map(c => (
            <Option value={c} key={c}>
              {c}
            </Option>
          ))}
        </Select>
      </React.Fragment>
    );
  }
}

export const TwoSelectChangeAtTheSameTime = () => <Link />;

TwoSelectChangeAtTheSameTime.story = {
  name: 'two select change at the same time',
};

export const SelectMultiple = () => (
  <>
    <Select
      multiple={true}
      max={10}
      style={{
        width: '180px',
      }}
      placeholder="fefe"
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value="4">opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
    <br />
    <br />
    <Select
      multiple={true}
      style={{
        width: '300px',
      }}
      defaultValue={[1, 2, 3]}
      placeholder="fefe"
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value="4">opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
    <br />
    <br />
    <Select
      multiple={true}
      style={{
        width: '300px',
      }}
      defaultValue={[1, 2, 3]}
      placeholder="fefe"
      disabled
      onSelect={(...res) => console.log(res)}
      onDeselect={(...res) => console.log(res)}
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value="4">opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
    <br />
    <br />
    maxTagCount = 3
    <br />
    <Select
      multiple={true}
      maxTagCount={3}
      style={{
        width: '350px',
      }}
      defaultValue={[1, 2, 3]}
      placeholder="fefe"
      insetLabel="标签"
      onSelect={(...res) => console.log(res)}
      onDeselect={(...res) => console.log(res)}
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value="4">opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
    <br />
    <br />
    maxTagCount = 3, showRestTagsPopover
    <br />
    <Select
      multiple={true}
      maxTagCount={3}
      style={{
        width: '350px',
      }}
      defaultValue={[1, 2, 3]}
      placeholder="fefe"
      insetLabel="标签"
      onSelect={(...res) => console.log(res)}
      onDeselect={(...res) => console.log(res)}
      showRestTagsPopover={true}
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value="4">opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
    <br />
    <br />
    maxTagCount = 3, max=5
    <br />
    <Select
      multiple={true}
      maxTagCount={3}
      max={5}
      style={{
        width: '350px',
      }}
      defaultValue={[1, 2, 3]}
      placeholder="fefe"
      insetLabel="标签"
      onSelect={(...res) => console.log(res)}
      onDeselect={(...res) => console.log(res)}
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value="4">opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
  </>
);

SelectMultiple.story = {
  name: 'select multiple',
};
SelectMultiple.parameters =  {
  chromatic: { disableSnapshot: false },
};

export const SelectDisabled = () => (
  <Select
    disabled
    multiple={true}
    max={10}
    style={{
      width: '250px',
    }}
  >
    <Option value={1}>opt1</Option>
    <Option value={2} disabled>
      opt2
    </Option>
    <Option value={3}>opt3</Option>
    <Option value="4">opt4</Option>
  </Select>
);

SelectDisabled.story = {
  name: 'select disabled',
};

function filter(input, option) {
  console.log(option);
  return option.label.includes(input);
}

const spanStyle = {
  display: 'inline-block',
  marginRight: '8px',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  border: '1px solid var(--semi-color-bg-1)',
};
const colorOptions = [
  {
    value: 'grey-1',
    spanStyle: { ...spanStyle, backgroundColor: 'rgb(107, 116, 117)' },
  },
  {
    value: 'purple-5',
    spanStyle: { ...spanStyle, backgroundColor: 'rgb(158, 40, 179)' },
  },
  {
    value: 'pink-2',
    spanStyle: { ...spanStyle, backgroundColor: 'rgb(233, 30, 99)' },
  },
  {
    value: 'blue-3',
    spanStyle: { ...spanStyle, backgroundColor: 'rgb(0, 119, 250)' },
  },
];
const alignStyle = {
  display: 'flex',
  alignItems: 'center',
};

const customFilter = (input, option) => {
  return option.value.includes(input);
};

export const SelectFilterSingle = () => (
  <div>
    <h5>默认筛选</h5>
    <Select
      filter
      style={{
        width: '250px',
        margin: 10,
      }}
      showClear
      autoFocus
      placeholder='singe filter select'
      onSearch={(val) => console.log(`onSearch:${val}`)}
      onFocus={() => console.log('onFocus')}
      onBlur={() => console.log('onBlur')}
    >
      <Option value={1}>opt1</Option>
      <Option value={2} disabled>
        disabled
      </Option>
      <Option value={3}>Lucy</Option>
      <Option value="4">bay</Option>
      <Option value="5">sert</Option>
      <Option value="6">wym</Option>
      <Option value="7" disabled>
        meno
      </Option>
      <Option value="8">opts</Option>
    </Select>
    <h5>自定义筛选函数</h5>
    <Select
      style={{
        width: '250px',
        margin: 10,
      }}
      filter={filter}
      showClear
      onBlur={() => console.log('onBlur')}
      onSearch={val => console.log(val)}
      onFocus={() => console.log('onFocus')}
    >
      <Option value={1}>opt1(value:1)</Option>
      <Option value={2}>mike(value:2)</Option>
      <Option value={3}>Lucy(value:3)</Option>
      <Option value={4}>bay(value:4)</Option>
    </Select>
    <h5>filter为true，但option label为node时</h5>
    <Select
      style={{
        width: '250px',
        margin: 10,
      }}
      showClear
      filter={customFilter}
      onChange={v => console.log(v)}
      insetLabel="insetLabel"
      onFocus={() => console.log('onFocus')}
      onBlur={() => console.log('onBlur')}
      onSearch={(val) => console.log(val)}
    >
      {colorOptions.map(option => (
        <Option value={option.value} key={option.value}>
          <div style={alignStyle}>
            <span style={option.spanStyle}></span>
            {option.value}
          </div>
        </Option>
      ))}
    </Select>
  </div>
);

SelectFilterSingle.story = {
  name: 'select filter single',
};

export const SelectFilterMultiple = () => (
  <Space>
    <Select
      filter
      multiple={true}
      style={{
        width: '250px',
      }}
      size='small'
      placeholder="fefe"
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value={4}>opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
      <Option value={9}>opt9</Option>
      <Option value={10}>opt10</Option>
    </Select>
    <Select
      filter
      multiple={true}
      style={{
        width: '250px',
      }}
      placeholder="fefe"
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value={4}>opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
      <Option value={9}>opt9</Option>
      <Option value={10}>opt10</Option>
    </Select>
    <Select
      filter
      size='large'
      multiple={true}
      style={{
        width: '250px',
      }}
      placeholder="fefe"
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value={4}>opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
      <Option value={9}>opt9</Option>
      <Option value={10}>opt10</Option>
    </Select>
    <Select
      filter
      multiple={true}
      maxTagCount={3}
      style={{
        width: '270px',
      }}
      placeholder="fefe"
    >
      <Option value={1}>opt1</Option>
      <Option value={2}>opt2</Option>
      <Option value={3}>opt3</Option>
      <Option value={4}>opt4</Option>
      <Option value={5}>opt5</Option>
      <Option value={6}>opt6</Option>
      <Option value={7}>opt7</Option>
      <Option value={8}>opt8</Option>
    </Select>
  </Space>
);

SelectFilterMultiple.story = {
  name: 'select filter multiple',
};

const OptionLabelProp = () => {
  const [value, setValue] = useState(1);
  return (
    <>
      设置optionLabelProp属性(默认为'children')为'value'时，回填到选择框中的文本会是Option.value
      <br></br>
      <Select
        style={{
          width: '250px',
        }}
        defaultValue={1}
        optionLabelProp="value"
      >
        <Option value={1}>opt1</Option>
        <Option value={2}>opt2</Option>
        <Option value={3}>
          <span
            style={{
              color: 'pink',
            }}
          >
            opt3 Node
          </span>
        </Option>
        <Option value="4">
          <span
            style={{
              color: 'red',
            }}
          >
            testNode
          </span>
        </Option>
      </Select>
      <br />
      <br />
      <Select
        style={{
          width: '250px',
        }}
        value={value}
        optionLabelProp="value"
        onChange={setValue}
      >
        <Option value={1}>opt1</Option>
        <Option value={2}>opt2</Option>
        <Option value={3}>
          <span
            style={{
              color: 'pink',
            }}
          >
            opt3 Node
          </span>
        </Option>
        <Option value="4">
          <span
            style={{
              color: 'red',
            }}
          >
            testNode
          </span>
        </Option>
      </Select>
      <br />
      <br />
      <Select
        style={{
          width: '250px',
        }}
        defaultValue={1}
      >
        <Option value={1}>children Label Text 1</Option>
        <Option value={2}>opt2</Option>
        <Option value={3}>opt3</Option>
        <Option value="4">
          <span
            style={{
              color: 'red',
            }}
          >
            testNode
          </span>
        </Option>
      </Select>
      <Select
        style={{
          width: '250px',
        }}
        defaultValue={1}
        filter
        optionLabelProp="value"
      >
        <Option value={1}>children Label Text 1</Option>
        <Option value={2}>opt2</Option>
        <Option value={3}>opt3</Option>
        <Option value="4">
          <span
            style={{
              color: 'red',
            }}
          >
            testNode
          </span>
        </Option>
      </Select>
      <br />
      <br />
      多选
      <Select
        style={{
          width: '250px',
        }}
        multiple
        filter
        optionLabelProp="value"
      >
        <Option value={1}>children Label Text 1</Option>
        <Option value={2}>opt2</Option>
        <Option value={3}>opt3</Option>
        <Option value="4">
          <span
            style={{
              color: 'red',
            }}
          >
            testNode
          </span>
        </Option>
      </Select>
    </>
  );
};

class CustomRender extends React.Component {
  constructor() {
    super();
    this.state = {
      list: [
        {
          name: '夏可漫',
          email: 'xiakeman@example.com',
          abbr: 'XK',
          color: 'amber',
        },
        {
          name: '申悦',
          email: 'shenyue@example.com',
          abbr: 'SY',
          color: 'indigo',
        },
        {
          name: '曲晨一',
          email: 'quchenyi@example.com',
          abbr: 'CY',
          color: 'blue',
        },
        {
          name: '文嘉茂',
          email: 'wenjiamao@example.com',
          abbr: 'JM',
          color: 'cyan',
        },
      ],
    };
  }

  renderCustomOption(item, index) {
    const optionStyle = {
      display: 'flex',
    };
    return (
      <Option key={index} value={item.name} style={optionStyle} showTick={false} {...item}>
        <Avatar color={item.color} size="small">
          {item.abbr}
        </Avatar>
        <div
          style={{
            marginLeft: 4,
          }}
        >
          <p
            style={{
              fontSize: 14,
              margin: 4,
            }}
          >
            {item.name}
          </p>
          <p
            style={{
              margin: 4,
            }}
          >
            {item.email}
          </p>
        </div>
      </Option>
    );
  }

  renderSelectedItem(optionNode) {
    return (
      <div>
        <Avatar color={optionNode.color} size="small">
          {optionNode.abbr}
        </Avatar>
        <span
          style={{
            margin: 8,
          }}
        >
          {optionNode.email}
        </span>
      </div>
    );
  }

  renderMultipleSelectedItem(optionNode) {
    let content = (
      <div>
        <Avatar color={optionNode.color} size="small">
          {optionNode.abbr}
        </Avatar>
      </div>
    );
    return {
      isRenderInTag: true,
      content,
    };
  }

  renderMultipleWithoutTag(optionNode) {
    let content = (
      <div>
        <Avatar color={optionNode.color} size="small">
          {optionNode.abbr}
        </Avatar>
      </div>
    );
    return {
      isRenderInTag: false,
      content,
    };
  }

  render() {
    const { list } = this.state;
    return (
      <React.Fragment>
        <Select
          style={{
            width: 300,
            height: 40,
          }}
          onChange={this.provinceChange}
          defaultValue={'夏可漫'}
          renderSelectedItem={this.renderSelectedItem}
        >
          {list.map((item, index) => this.renderCustomOption(item, index))}
        </Select>
        <Select
          style={{
            width: 360,
            height: 60,
            marginTop: 20,
          }}
          onChange={this.provinceChange}
          defaultValue={['夏可漫', '申悦']}
          multiple
          renderSelectedItem={this.renderMultipleSelectedItem}
        >
          {list.map((item, index) => this.renderCustomOption(item, index))}
        </Select>
        <Select
          style={{
            width: 360,
            height: 60,
            marginTop: 20,
          }}
          onChange={this.provinceChange}
          defaultValue={['夏可漫', '申悦']}
          multiple
          renderSelectedItem={this.renderMultipleWithoutTag}
        >
          {list.map((item, index) => this.renderCustomOption(item, index))}
        </Select>
      </React.Fragment>
    );
  }
}

export const RenderSelectedItem = () => (
  <>
    renderSelectedItem
    <CustomRender />
    <br />
    <br />
    OptionLabelProp
    <OptionLabelProp />
  </>
);

RenderSelectedItem.story = {
  name: 'renderSelectedItem',
};

RenderSelectedItem.parameters =  {
  chromatic: { disableSnapshot: false },
};

const ControlledSelect = () => {
  const [filter, setFilter] = useState(true);
  const [value, setValue] = useState('nick');
  const [value2, setValue2] = useState('jerry');
  const [value3, setValue3] = useState();
  const [value4, setValue4] = useState(['nick']);
  const [value5, setValue5] = useState();
  return (
    <>
      <RadioGroup
        type='button'
        defaultValue={false}
        onChange={e => setFilter(e.target.value)}
        options={[
          { value: true, label: 'Filter enable' },
          { value: false, label: 'Filter disable' },
        ]}
      >
      </RadioGroup>
      <br />
      <br />
      <span>value + onChange</span>
      <Select
        value={value}
        filter={filter}
        onChange={setValue}
        style={{
          width: 200,
        }}
      >
        <Option value="nick">nick</Option>
        <Option value="jerry">jerry</Option>
        <Option value="mark">mark</Option>
      </Select>

      <br />
      <br />
      <span>只传value，不传onChange</span>
      <Select
        value={value2}
        filter={filter}
        style={{
          width: 200,
        }}
      >
        <Option value="nick">nick</Option>
        <Option value="jerry">jerry</Option>
        <Option value="mark">mark</Option>
      </Select>
      <br />
      <br />

      <span>value + onChange , 多选</span>
      <Select
        value={value3}
        onChange={setValue3}
        filter={filter}
        multiple
        style={{
          width: 200,
        }}
      >
        <Option value="nick">nick</Option>
        <Option value="jerry">jerry</Option>
        <Option value="mark">mark</Option>
        <Option value="nick2">nick2</Option>
        <Option value="jerry2">jerry2</Option>
        <Option value="mark2">mark2</Option>
      </Select>
      <br />
      <br />

      <span>value, 多选</span>
      <Select
        value={value4}
        multiple
        filter={filter}
        style={{
          width: 200,
        }}
      >
        <Option value="nick">nick</Option>
        <Option value="jerry">jerry</Option>
        <Option value="mark">mark</Option>
      </Select>

      <br />
      <h5>filter为true，但option label为node时</h5>
      <Select
        style={{
          width: '250px',
        }}
        filter={customFilter}
        insetLabel="insetLabel"
        value={value5}
        onChange={setValue5}
      >
        {colorOptions.map(option => (
          <Option value={option.value} key={option.value}>
            <div style={alignStyle}>
              <span style={option.spanStyle}></span>
              {option.value}
            </div>
          </Option>
        ))}
      </Select>
    </>
  );
};

export const Controlled = () => <ControlledSelect></ControlledSelect>;

Controlled.story = {
  name: 'controlled',
};

const UnControlledSelect = () => {
  const onChange = value => {
    console.log(value);
  };

  return (
    <>
      <h5>defaultValue在list中不存在</h5>
      <Select
        defaultValue={90}
        onChange={onChange}
        style={{
          width: 200,
        }}
      >
        <Option value={20}>nick</Option>
        <Option value={10}>jerry</Option>
        <Option value={5}>mark</Option>
      </Select>
      <h5>defaultValue在list中存在</h5>
      <Select
        defaultValue={10}
        onChange={onChange}
        style={{
          width: 200,
        }}
      >
        <Option value={20}>nick</Option>
        <Option value={10}>jerry</Option>
        <Option value={5}>mark</Option>
      </Select>
    </>
  );
};

export { UnControlledSelect };
UnControlledSelect.story = {
  name: '非受控组件'
};

export const TestScroll = () => (
  <div
    style={{
      marginTop: '600px',
      marginBottom: '50px',
    }}
  >
    <Select
      style={{
        width: '150px',
      }}
    >
      <Option value="tony">IronMan</Option>
      <Option value="Thor" disabled>
        Thor
      </Option>
      <Option value="steve">Caption</Option>
      <Option value="peter">SpiderBoy</Option>
    </Select>
  </div>
);

TestScroll.story = {
  name: 'test scroll',
};

let optionList = [
  {
    value: 'tony',
    label: 'Ironman',
  },
  {
    value: 'Thor',
    label: 'Thor',
  },
  {
    value: 'steve',
    label: 'Caption',
  },
  {
    value: 'peter',
    label: 'SpiderBoy',
  },
];

export const OptionList = () => (
  <Select
    style={{
      width: '100px',
    }}
    optionList={optionList}
  ></Select>
);

OptionList.story = {
  name: 'optionList',
};

export const InsetLabel = () => (
  <>
    <Select
      style={{
        width: 300,
      }}
      insetLabel="主播类型"
      placeholder="请选择"
      optionList={optionList}
    ></Select>
    <Select
      style={{
        width: 300,
      }}
      multiple
      insetLabel="主播类型"
      optionList={optionList}
    ></Select>
    <Select
      style={{
        width: 300,
      }}
      filter
      insetLabel="主播类型"
      optionList={optionList}
    ></Select>
    <Select
      style={{
        width: 300,
      }}
      filter
      multiple
      insetLabel="主播类型"
      optionList={optionList}
    ></Select>
  </>
);

InsetLabel.story = {
  name: 'insetLabel',
};

export const ChangeOptionDynamic = () => {
  function App() {
    let [options, setOptions] = useState([]);
    let [index, setIndex] = useState(0);

    const addOption = () => {
      const randomItem = optionList[index];
      index = index + 1;
      setIndex(index);
      options = [...options, { ...randomItem }];
      setOptions(options);
    };

    const reset = () => {
      setOptions([]);
      setIndex(0);
    };

    return (
      <div>
        <Select
          style={{
            width: '150px',
          }}
          defaultValue="tony"
        >
          {options.map((option, idx) => (
            <Select.Option key={option.key || idx} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
        <h4>多选</h4>
        <Select
          style={{
            width: '150px',
          }}
          multiple
          defaultValue={['tony']}
        >
          {options.map((option, idx) => (
            <Select.Option key={option.key || idx} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
        <button onClick={addOption}>add option</button>
        <button onClick={reset}>reset</button>
      </div>
    );
  }

  return <App />;
};

ChangeOptionDynamic.story = {
  name: 'change option dynamic',
};

let list = [
  {
    value: 'tony',
    label: 'Ironman',
    otherKey: {
      role: 1,
    },
  },
  {
    value: 'Thor',
    label: 'Thor',
    otherKey: {
      role: 2,
    },
  },
  {
    value: 'steve',
    label: 'Caption',
    otherKey: {
      role: 3,
    },
  },
  {
    value: 'peter',
    label: 'SpiderBoy',
    otherKey: {
      role: 4,
    },
  },
];

const SearchDemo1 = () => {
  const [optionList, setOptionList] = useState(list);
  const [loading, setLoading] = useState(false);

  const handleSearch = value => {
    setLoading(true);
    let length = Math.ceil(Math.random() * 10);
    let result = Array.from(
      {
        length,
      },
      (v, i) => {
        return {
          value: value + i,
          label: value + i,
          otherKey: {
            role: i,
          },
        };
      }
    );
    setTimeout(() => {
      setOptionList(result);
      setLoading(false);
    }, 1000);
  };

  const [value, setValue] = useState(optionList[0].value);

  const onChange = value => {
    console.log(value);
    setValue(value);
  };

  return (
    <div>
      受控：
      <Select
        filter
        style={{
          width: '150px',
        }}
        onSearch={v => handleSearch(v)}
        optionList={optionList}
        value={value}
        loading={loading}
        showClear
        onChange={onChange}
      ></Select>
      非受控：
      <Select
        style={{
          width: '150px',
        }}
        filter
        showClear
        onSearch={v => handleSearch(v)}
        optionList={optionList}
        loading={loading}
        onChange={onChange}
      ></Select>
      多选非受控
      <Select
        style={{
          width: '150px',
        }}
        showClear
        filter
        multiple
        onSearch={v => handleSearch(v)}
        optionList={optionList}
        loading={loading}
        onChange={onChange}
      ></Select>
    </div>
  );
};

import debounce from 'lodash/debounce';

class SearchDemo2 extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      optionList: [
        {
          value: 'abc',
          label: '抖音',
          type: 1,
        },
        {
          value: 'hotsoon',
          label: '火山小视频',
          type: 2,
        },
        {
          value: 'pipixia',
          label: '皮皮虾',
          type: 3,
        },
        {
          value: 'toutiao',
          label: '今日头条',
          type: 4,
        },
      ],
      value: [],
    };
    this.handleSearch = debounce(this.handleSearch, 800).bind(this);
    this.onChange = this.onChange.bind(this);
    this.customRender = this.customRender.bind(this);
  }

  handleSearch(inputValue) {
    this.setState({
      loading: true,
    });
    let length = Math.ceil(Math.random() * 100);
    let result = Array.from(
      {
        length,
      },
      (v, i) => {
        return {
          value: inputValue + i,
          label: 'label' + i,
          type: i + 1,
        };
      }
    );
    setTimeout(() => {
      this.setState({
        optionList: result,
        loading: false,
      });
    }, 2000);
  }

  onChange(value) {
    this.setState({
      value,
    });
    console.log(value);
  }

  customRender(optionNode) {
    return optionNode.value + optionNode.label;
  }

  render() {
    const { loading, optionList, value } = this.state;
    return (
      <div>
        <Select
          style={{
            width: 150,
          }}
          showClear
          filter
          labelInValue
          onSearch={this.handleSearch}
          optionList={optionList}
          loading={loading}
          onChange={this.onChange}
          placeholder="请选择"
        ></Select>
        <br />
        <br />
        <Select
          style={{
            width: 180,
          }}
          filter // labelInValue
          showClear
          multiple
          value={value}
          renderSelectedItem={this.customRender}
          onSearch={this.handleSearch}
          optionList={optionList}
          loading={loading}
          onChange={this.onChange}
          placeholder="请选择"
        ></Select>
      </div>
    );
  }
}

export const Search = () => (
  <>
    <SearchDemo1 />
    <SearchDemo2 />
  </>
);

Search.story = {
  name: 'search',
};

export const IncomeDetail = ({ config = {}, params = {} }) => {
  const [detailList, setDetailList] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState();
  let lock;

  const fetchData = (outParams = {}) => {
    if (lock) {
      return;
    }

    setLoading(true); // 参数
    // 请求

    fetch({
      url: URL.user_profit,
      method: 'get',
      baseURL: config.webcast_host,
      params,
    })
      .then(res => {
        lock = false;
        setLoading(false);
        console.log('++++', data);
      })
      .catch(() => {
        setLoading(false);
        Toast.show('网络异常,请稍后重试');
      });
  };

  useEffect(fetchData, []); // 监听滚动设置吸顶 以及加载更多

  useEffect(() => {
    window.addEventListener('scroll', function() {
      // 加载更多
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const screenHeight = screen.height;

      if (!loading && hasMore && scrollY + screenHeight + 300 > scrollHeight) {
        fetchData();
      }
    });
  }, [detailList.length]);
  return (
    <div>
      <Select></Select>
    </div>
  );
};

export const AllowCreate = () => (
  <Select
    style={{
      width: 500,
    }}
    optionList={optionList}
    allowCreate={true}
    multiple={true}
    filter={true}
    onChange={v => console.log(v)}
  ></Select>
);

AllowCreate.story = {
  name: 'allowCreate',
};

export const AllowCreateCustomRender = () => (
  <Select
    style={{
      width: 500,
    }}
    optionList={optionList}
    allowCreate={true}
    multiple={true}
    filter={true}
    onChange={v => console.log(v)}
    renderCreateItem={v => `semi: ${v}`}
  ></Select>
);

AllowCreateCustomRender.story = {
  name: 'allowCreate custom render',
};

let AllowCreateControlledDemo = () => {
  let [value, setValue] = useState();
  const optionList = [
    {
      value: 'abc',
      label: '抖音',
    },
    {
      value: 'hotsoon',
      label: '火山小视频',
    },
    {
      value: 'pipixia',
      label: '皮皮虾',
    },
    {
      value: 'toutiao',
      label: '今日头条',
    },
  ];
  const [list, setList] = useState(optionList);

  const handleSelect = v => {
    var lastOne = v[v.length - 1];

    if (lastOne && list.findIndex(item => item.value === lastOne) == -1) {
      list.push({
        value: lastOne,
        label: lastOne,
      });
    }

    setList(list);
    setValue(v);
  };

  return (
    <Select
      style={{
        width: 400,
      }}
      optionList={list}
      allowCreate={true}
      multiple={true}
      filter={true}
      value={value}
      onChange={handleSelect}
    ></Select>
  );
};

const AllowCreateDemo = () => {
  let [value, setValue] = useState();
  const optionList = [
    {
      value: 'abc',
      label: '抖音',
    },
    {
      value: 'hotsoon',
      label: '火山小视频',
    },
    {
      value: 'pipixia',
      label: '皮皮虾',
    },
    {
      value: 'toutiao',
      label: '今日头条',
    },
  ];
  const [list, setList] = useState(optionList);

  const handleSelect = v => {
    var lastOne = v[v.length - 1];

    if (lastOne && list.findIndex(item => item.value === lastOne) == -1) {
      list.push({
        value: lastOne,
        label: lastOne,
      });
    }

    setList(list); // setValue(v)
  };

  return (
    <Select
      style={{
        width: 400,
      }}
      optionList={list}
      defaultValue={['abc', 'hotsoon']}
      allowCreate={true}
      multiple={true}
      filter={true}
      onChange={handleSelect}
    ></Select>
  );
};

export const AllowCreateWithDefaultValue = () => <AllowCreateDemo />;

AllowCreateWithDefaultValue.story = {
  name: 'allowCreate with defaultValue',
};

class HideDemo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      optionList: [
        {
          value: 'abc',
          label: '抖音',
        },
        {
          value: 'hotsoon',
          label: '火山小视频',
        },
        {
          value: 'pipixia',
          label: '皮皮虾',
        },
        {
          value: 'toutiao',
          label: '今日头条',
        },
      ],
      selectedItems: [],
    };
    this.onChange = this.onChange.bind(this);
  }

  onChange(selectedItems) {
    this.setState({
      selectedItems,
    });
  }

  render() {
    let { optionList, selectedItems } = this.state;
    let filterOptions = optionList.filter(option => !selectedItems.includes(option.value));
    return (
      <Select
        value={selectedItems}
        multiple
        style={{
          width: 300,
        }}
        onChange={this.onChange}
        optionList={filterOptions}
      ></Select>
    );
  }
}

export const AutoHiddenSelectedItem = () => <HideDemo></HideDemo>;

AutoHiddenSelectedItem.story = {
  name: 'auto hidden selected item',
};

class CustomCreate extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      optionList: [
        {
          value: 'abc',
          label: '抖音',
        },
        {
          value: 'hotsoon',
          label: '火山小视频',
        },
        {
          value: 'pipixia',
          label: '皮皮虾',
        },
        {
          value: 'toutiao',
          label: '今日头条',
        },
        {
          value: 0,
          label: 0,
        },
      ],
      selectedItems: ['fefe'],
    };
    this.onChange = this.onChange.bind(this);
    this.customRender = this.customRender.bind(this);
    this.search = this.search.bind(this);
  }

  onChange(selectedItems) {
    console.log(selectedItems); // this.setState({ selectedItems, optionList: [] });

    this.setState({
      selectedItems,
    }); // this.setState({ optionList: [] });
  }

  customRender(v) {
    return (
      <>
        <span>label:{v.label}</span>
        <span>value:{v.value}</span>
      </>
    );
  }

  customCreate(inputValue, isFocus) {
    let style = {
      padding: 12,
      cursor: 'pointer',
      backgroundColor: isFocus ? 'var(--semi-color-fill-0)' : '#FFF',
    };
    return <div style={style}>{'create' + inputValue}</div>;
  }

  search(inputValue) {
    let length = Math.ceil(Math.random() * 10);
    let result = Array.from(
      {
        length,
      },
      (v, i) => {
        return {
          value: inputValue + i,
          label: inputValue + i,
          type: i + 1,
        };
      }
    );
    console.log(result); // result = result.concat(selectedOption);

    this.setState({
      optionList: result,
    });
  }

  render() {
    let { optionList, selectedItems } = this.state;
    return (
      <>
        <Select
          defaultValue={['abc']}
          filter
          style={{
            width: 300,
          }}
          multiple
          optionList={optionList}
          onSearch={this.search}
          onChange={this.onChange}
          emptyContent={null} // onChangeWithObject
        ></Select>
      </>
    );
  }
}

export const _CustomCreate = () => <CustomCreate></CustomCreate>;

_CustomCreate.story = {
  name: 'CustomCreate',
};

class OptionGroupDemo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      groups: [
        {
          label: 'Asia',
          children: [
            {
              label: 'China',
              value: 'zhongguo',
            },
            {
              label: 'Korea',
              value: 'hanguo',
            },
          ],
        },
        {
          label: 'Europe',
          children: [
            {
              label: 'Germany',
              value: 'deguo',
            },
            {
              label: 'France',
              value: 'faguo',
            },
          ],
        },
        {
          label: 'Other',
          children: [
            {
              label: 'vf',
              value: 'Sourth',
            },
          ],
        },
      ],
    };
  }

  renderGroup(group, index) {
    const options = group.children.map(option => (
      <Select.Option value={option.value} label={option.label} key={option.label} data-test-id={option.label} />
    ));
    return <Select.OptGroup key={`${index}-${group.label}`} label={group.label} data-test-id={group.label}>{options}</Select.OptGroup>;
  }

  render() {
    const { groups } = this.state;
    return (
      <>
        <Select
          placeholder="with key"
          id='with-key'
          style={{
            width: 180,
          }}
          filter
          showClear
        >
          {groups.map((group, index) => this.renderGroup(group, index))}
        </Select>

        <Select
          filter={(sugInput, option) => {
              let label = option.label.toUpperCase();
              let sug = sugInput.toUpperCase();
              return label.includes(sug);
          }}
          showClear
          id='without-key'
          style={{ width: "180px" }}
          placeholder="without key"
        >
          <Select.OptGroup label="Group1">
            <Select.Option value="douyin">
              Douyin
            </Select.Option>
            <Select.Option value="ulikecam">
              Ulikecam
            </Select.Option>
          </Select.OptGroup>
          <Select.OptGroup label="Group2">
            <Select.Option value="jianying">
              Capcut
            </Select.Option>
            <Select.Option value="xigua">
              Xigua
            </Select.Option>
          </Select.OptGroup>
        </Select>

      </>
    );
  }
}

export const SelectOptionGroup = () => <OptionGroupDemo />;

const BlurDemo = () => {
  const onBlur = (value, e) => {
    console.log(value);
    console.log(e);
    console.log('onBlur');
  };

  const onFocus = (value, e) => {
    console.log(value);
    console.log(e);
    console.log('onFocus');
  };

  return (
    <>
      <Select
        filter
        placeholder=""
        style={{
          width: 180,
        }}
        onBlur={onBlur}
        onFocus={onFocus}
      >
        <Select.Option value="zhongguo">China</Select.Option>
        <Select.Option value="hanguo">Korea</Select.Option>
        <Select.Option value="deguo">Germany</Select.Option>
        <Select.Option value="faguo">France</Select.Option>
      </Select>
      <br />
      <br />
      <br />
      <Select
        filter
        placeholder="多选"
        style={{
          width: 180,
        }}
        onBlur={onBlur}
        onFocus={onFocus}
        multiple
      >
        <Select.Option value="zhongguo">China</Select.Option>
        <Select.Option value="hanguo">Korea</Select.Option>
        <Select.Option value="deguo">Germany</Select.Option>
        <Select.Option value="faguo">France</Select.Option>
      </Select>
    </>
  );
};

export const SelectOnBlurOnFocus = () => <BlurDemo></BlurDemo>;

SelectOnBlurOnFocus.story = {
  name: 'Select onBlur/onFocus',
};

const AutoAdjustOverflowDemo = () => {
  const [list, setList] = useState([
    {
      value: 'abc',
      label: '1111',
    },
    {
      value: 'hotsoon',
      label: '1112',
    },
    {
      value: 'pipixia',
      label: '1113',
    },
    {
      value: 'toutiao',
      label: '1114',
    },
  ]);

  const onSearch = () => {
    let newList = Array.from(
      {
        length: Math.floor(Math.random() * 10),
      },
      (v, i) => {
        return {
          value: i,
          label: i,
        };
      }
    );
    setList(newList);
    console.log(newList);
  };

  return (
    <div
      style={{
        height: 180,
        margin: 250,
        border: '1px solid pink',
      }}
    >
      <Select
        optionList={list}
        filter={true}
        remote={true}
        onSearch={onSearch}
        style={{
          width: 200,
        }}
        multiple
      />
    </div>
  );
};

export const AutoAdjustOverflow = () => <AutoAdjustOverflowDemo></AutoAdjustOverflowDemo>;

AutoAdjustOverflow.story = {
  name: 'autoAdjustOverflow',
};

const AllowCreateWithFilter = () => {
  const [list, setList] = useState([
    {
      value: 'abc',
      label: 'abc',
      otherKey: 'abc',
    },
    {
      value: 'hotsoon',
      label: 'hotsoon',
      otherKey: 'efg',
    },
    {
      value: 'pipixia',
      label: 'pipixia',
      otherKey: 'hij',
    },
    {
      value: 'toutiao',
      label: 'toutiao',
      otherKey: 'klm',
    },
  ]);

  const filter = (sugInput, option) => {
    let compareKey = option.otherKey ? option.otherKey.toUpperCase() : '';
    let sug = sugInput.toUpperCase();
    return compareKey.includes(sug);
  };

  return (
    <div
      style={{
        height: 180,
        margin: 250,
      }}
    >
      <Select
        optionList={list}
        multiple
        filter={filter}
        style={{
          width: 200,
        }}
        allowCreate
      />
    </div>
  );
};

export const FilterAllowCreate = () => <AllowCreateWithFilter></AllowCreateWithFilter>;

FilterAllowCreate.story = {
  name: 'Filter + allowCreate',
};

const SelectRefDemo = () => {
  const ref = useRef();
  const secondRef = useRef();
  const [open, setOpen] = useState(false);
  const list = [
    {
      value: 'abc',
      label: 'Abc',
    },
    {
      value: 'hotsoon',
      label: 'Hotsoon',
    },
    {
      value: 'pipixia',
      label: 'Pipixia',
    },
    {
      value: 'toutiao',
      label: 'TooBuzz',
    },
  ];

  const change = () => {
    if (!open) {
      ref.current.open();
      setOpen(true);
    } else {
      ref.current.close();
      setOpen(false);
    }
  };

  const focus = () => {
    ref.current.focus();
  };

  const clearInput = () => {
    ref.current.clearInput();
  };

  const deselectAll = () => {
    ref.current.deselectAll();
  };

  const selectAll = () => {
    ref.current.selectAll();
  };

  return (
    <>
      <h4>onChangeWithObject = false</h4>
      <Select
        innerBottomSlot={
          <div>
            <Space>
              <Button onClick={change}>close</Button>
              <Button onClick={clearInput}>clearInput</Button>
              <Button onClick={deselectAll}>deselectAll</Button>
              <Button onClick={selectAll}>selectAll</Button>
            </Space>
          </div>
        }
        ref={ref}
        onChange={e => console.log(e)}
        placeholder="Business line"
        style={{
          width: 180,
        }}
        optionList={list}
        filter
        multiple
      ></Select>
      <Space>
        <Button onClick={change}>open</Button>
        <Button onClick={focus}>focus</Button>
        <Button onClick={clearInput}>clearInput</Button>
        <Button onClick={deselectAll}>deselectAll</Button>
        <Button onClick={selectAll}>selectAll</Button>
      </Space>
      <h4
        style={{
          marginTop: 20,
        }}
      >
        onChangeWithObject = true
      </h4>
      <Select
        innerBottomSlot={
          <div>
            <Space></Space>
          </div>
        }
        onChange={e => console.log(e)}
        onChangeWithObject
        ref={secondRef}
        placeholder="Business line"
        style={{
          width: 180,
        }}
        optionList={list}
        filter
        multiple
      ></Select>
      <Space>
        <Button onClick={() => secondRef.current.deselectAll()}>deselectAll</Button>
        <Button onClick={() => secondRef.current.selectAll()}>selectAll</Button>
      </Space>
    </>
  );
};

export const Ref = () => <SelectRefDemo />;

Ref.story = {
  name: 'ref',
};

export const CustomTriggerDemo = () => <CustomTrigger />;
CustomTriggerDemo.story = {
  name: 'custom trigger'
}

class VirtualizeClassDemo extends React.Component {
  constructor(props) {
    super(props);
    // this.handleSearch = this.handleSearch.bind(this);
    let newOptions = Array.from({ length: 1000 }, (v, i) => ({ label: `o-${i}`, value: `v-${v}-${i}` }));
    this.state = {
      optionList: newOptions,
    };
  }
  render() {
    let { groups, optionList } = this.state;
    let virtualize = {
      height: 300,
      widht: '100%',
      itemSize: 36,
    };
    return (
      <>
        <Select
          placeholder=""
          style={{ width: 180 }}
          filter
          onSearch={this.handleSearch}
          virtualize={virtualize}
          optionList={optionList}
        ></Select>
      </>
    );
  }
}

export const VirtualizeDemo = () => <VirtualizeClassDemo />;

VirtualizeDemo.story = {
  name: 'virtualize select'
}


const SelectPosition = () => {
  return (
    <div
      style={{
        height: 500,
        border: '1px solid red',
        overflow: 'auto',
      }}
    >
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <Select
        defaultValue="abc"
        style={{
          width: 120,
        }}
      >
        <Option value="abc">抖音</Option>
        <Option value="hotsoon">火山</Option>
        <Option value="pipixia" disabled>
          皮皮虾
        </Option>
        <Option value="xigua">西瓜视频</Option>
      </Select>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
      <p>p</p>
    </div>
  );
};

export { SelectPosition };
SelectPosition.story = {
  name: 'Select position problem'
}

const RenderOptionDemo = () => {

  const optionList = [
      { value: 'db-4', label: 'Doubao-Pro-4k', otherKey: 0, 'data-cy': 'option-1' },
      { value: 'db-32', label: 'Doubao-Pro-32K', otherKey: 1, 'data-cy': 'option-2' },
      { value: 'db-128', label: 'Doubao-Pro-128K', otherKey: 2, 'data-cy': 'option-3' },
      { value: 'db-lite-2', label: 'Doubao-Lite-4K', otherKey: 4, 'data-cy': 'option-4' },
      { value: 'db-lite-32', label: 'Doubao-Lite-32K', otherKey: 5, 'data-cy': 'option-5' },
      { value: 'db-lite-128', label: 'Doubao-Lite-128K', otherKey: 6, 'data-cy': 'option-6' },
      { value: 'gpt-4', label: 'GPT-4', otherKey: 6, 'data-cy': 'option-7' },
      { value: 'gpt-4-32', label: 'GPT-4-32K', otherKey: 7, 'data-cy': 'option-8' },
  ];

  const renderOptionItem = renderProps => {
    const {
      disabled,
      selected,
      label,
      value,
      focused,
      className,
      style,
      onMouseEnter,
      onClick,
      empty,
      emptyContent,
      ...rest
    } = renderProps;
    const optionCls = classNames({
      ['custom-option-render']: true,
      ['custom-option-render-focused']: focused,
      ['custom-option-render-disabled']: disabled,
      ['custom-option-render-selected']: selected,
    }, className); // Notice：

    // 1.props传入的style需在wrapper dom上进行消费，否则在虚拟化场景下会无法正常使用
    // 2.选中(selected)、聚焦(focused)、禁用(disabled)等状态的样式需自行加上，你可以从props中获取到相对的boolean值
    // 3.onMouseEnter需在wrapper dom上绑定，否则上下键盘操作时显示会有问题
    // 4.props传入的className需在wrapper dom上绑定，否则上下键盘操作时可能存在无法自动滚动展示的问题

    return (
      <div
        style={style}
        className={optionCls}
        onClick={() => onClick()}
        onMouseEnter={e => onMouseEnter()}
        {...rest}
      >
        <Checkbox checked={selected} />
        <div className="option-right">{label}</div>
      </div>
    );
  };

  return (
    <>
      <Select
        filter
        dropdownClassName="components-select-demo-renderOptionItem"
        optionList={optionList}
        style={{
          width: 300,
        }}
        data-cy="single"
        maxHeight={180}
        renderOptionItem={renderOptionItem}
      />
      <br />
      <br />
      <Select
        filter
        multiple
        dropdownClassName="components-select-demo-renderOptionItem"
        optionList={optionList}
        maxHeight={180}
        data-cy="multiple"
        style={{
          width: 450,
        }}
        renderOptionItem={renderOptionItem}
      />
    </>
  );
};

export const RenderOptionItem = () => <RenderOptionDemo />;

RenderOptionItem.story = {
  name: 'renderOptionItem',
};

const FilterDefaultOpen = () => {
  const [value1, setValue1] = useState('a-1');
  return (
    <>
      <Select
        placeholder=""
        style={{
          width: 180,
        }}
        filter
        defaultOpen
      >
        <Select.OptGroup label="Asia">
          <Select.Option value="a-1">China</Select.Option>
          <Select.Option value="a-2">Korea</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="Europe">
          <Select.Option value="b-1">Germany</Select.Option>
          <Select.Option value="b-2">France</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="South America">
          <Select.Option value="c-1">Peru</Select.Option>
        </Select.OptGroup>
      </Select>
      <Select
        placeholder=""
        style={{
          width: 180,
          marginLeft: 20,
        }}
        filter
        defaultOpen
        defaultValue="a-2"
      >
        <Select.OptGroup label="Asia">
          <Select.Option value="a-1">China</Select.Option>
          <Select.Option value="a-2">Korea</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="Europe">
          <Select.Option value="b-1">Germany</Select.Option>
          <Select.Option value="b-2">France</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="South America">
          <Select.Option value="c-1">Peru</Select.Option>
        </Select.OptGroup>
      </Select>
      <Select
        placeholder=""
        style={{
          width: 180,
          marginLeft: 20,
        }}
        filter
        defaultOpen
        value={value1}
        onChange={val => setValue1(val)}
      >
        <Select.Option value="a-1">China</Select.Option>
        <Select.Option value="a-2">Korea</Select.Option>
        <Select.Option value="b-1">Germany</Select.Option>
        <Select.Option value="b-2">France</Select.Option>
        <Select.Option value="c-1">Peru</Select.Option>
      </Select>
    </>
  );
};

export { FilterDefaultOpen };
FilterDefaultOpen.story = {
  name: 'Filter + defaultOpen'
};

const CustomSelect = props => {
  const { fieldRef, ...rest } = props;
  return <Select {...rest} ref={fieldRef} />;
};

const CustomFieldSelect = withField(CustomSelect);

const RefDemo = () => {
  const fieldRef = useRef(null);

  const onChange = () => {
    console.log(fieldRef);
    fieldRef.current.open();
    debugger;
  };

  return (
    <Form>
      <CustomFieldSelect field="test" initValue="se" fieldRef={fieldRef}></CustomFieldSelect>
      <Button onClick={onChange}>change</Button>
    </Form>
  );
};

export const RefFieldDemo = () => <RefDemo />;

RefFieldDemo.story = {
  name: 'Ref field demo',
};

const ValueZeroDemo = () => {
  const list = [
    {
      value: 6,
      label: '抖音小视频',
      otherKey: 0,
    },
    {
      value: 1,
      label: '火山小视频',
      disabled: true,
      otherKey: 1,
    },
    {
      value: 'pipixia',
      label: '皮皮虾',
      otherKey: 2,
    },
    {
      value: 'toutiao',
      label: '今日头条',
      otherKey: 3,
    },
  ];
  return (
    <Select
      placeholder="请选择业务线"
      style={{
        width: 180,
      }}
      optionList={list}
      value={0}
      renderSelectedItem={option => option.label + 1}
    ></Select>
  );
};

export const Value0 = () => <ValueZeroDemo />;

Value0.story = {
  name: 'value=0',
};

export const ScrollIntoView = () => (
  <div>
      <p>single selection</p>
      <Select defaultValue='v-11' defaultOpen style={{ width: 120, marginBottom: 300 }}>
          {new Array(50).fill(null).map((item, idx) => (
              <Option value={`v-${idx}`} key={idx}>{`option-${idx}`}</Option>
          ))}
      </Select>
      <p>single selection with no selected item</p>
      <Select style={{ marginBottom: 300, width: 120 }}>
          {new Array(50).fill(null).map((item, idx) => (
              <Option value={`v-${idx}`} key={idx}>{`option-${idx}`}</Option>
          ))}
      </Select>
      <p>The selected node is the last</p>
      <Select defaultValue='v-49' defaultOpen style={{ marginBottom: 300, width: 120 }}>
          {new Array(50).fill(null).map((item, idx) => (
              <Option value={`v-${idx}`} key={idx}>{`option-${idx}`}</Option>
          ))}
      </Select>
      <p>The selected node is the first</p>
      <Select defaultValue='v-0' style={{ marginBottom: 300, width: 120 }}>
          {new Array(50).fill(null).map((item, idx) => (
              <Option value={`v-${idx}`} key={idx}>{`option-${idx}`}</Option>
          ))}
      </Select>
      <p>multiple selection</p>
      <Select defaultValue={['v-25', 'v-9']} multiple style={{ marginBottom: 300, width: 220 }}>
          {new Array(30).fill(null).map((item, idx) => (
              <Option value={`v-${idx}`} key={idx}>{`option-${idx}`}</Option>
          ))}
      </Select>
      <p>multiple selection with no selected item</p>
      <Select multiple style={{ marginBottom: 300, width: 220 }}>
          {new Array(30).fill(null).map((item, idx) => (
              <Option value={`v-${idx}`} key={idx}>{`option-${idx}`}</Option>
          ))}
      </Select>
  </div>
);

ScrollIntoView.story = {
  name: 'scroll into view',
};


export const SelectInputPropsDemo = () => {

  const inputProps = {
    className: 'ttt',
    onCompositionEnd: (v) => console.log(v.target.value)
  };

  return (
    <Select 
      // onSearch={(v) => console.log(v)}
      optionList={list}
      inputProps={inputProps}
      multiple
      filter
      style={{ width: 200 }}
    >
    </Select>
  )
};
SelectInputPropsDemo.story = {
  name: 'inputProps',
};


export const AutoClearSearchValue = () => {
    const [val, setVal] = useState(['semi1']);
    const [clear, setClear] = useState(false);
    const optionList = [
        { label: 'semi1', value: 'semi1' },
        { label: 'semi2', value: 'semi2' },
        { label: 'semi3', value: 'semi3' },
        { label: 'semi4', value: 'semi4' },
        { label: 'semi5', value: 'semi5' },
        { label: 'semi6', value: 'semi6' },
    ];

    const [loading, setLoading] = useState(false);
    const [list, setList] = useState(optionList);
    const [value, setValue] = useState('');

    const handleChange = newValue => { setValue(newValue); };

    const data2 = [
        {
            label: "Design",
            value: '123456',
        }
    ]

    const handleSearch = (inputValue) => {
        setLoading(true);
        if (inputValue) {
            setTimeout(() => {
                setLoading(false);
                setList(data2);
            }, 1000);
        } else {
            setList(optionList)
            setLoading(false);
        }
    };

    return (
        <>  
            <h4>autoClearSearchValue</h4>
            <Switch checked={clear} onChange={checked => setClear(checked)}></Switch>

            <h4>Controlled mode + multiple</h4>
            <Select style={{ width: 400 }} multiple optionList={optionList} filter value={val} onChange={value => setVal(value)} autoClearSearchValue={clear}></Select>
            <br />
            <br />
            <h4>Uncontrolled mode + multiple</h4>
            <Select style={{ width: 400 }} multiple optionList={optionList} filter autoClearSearchValue={clear}></Select>
            <h4>Uncontrolled mode + multiple + defaultValue</h4>
            <Select style={{ width: 400 }} multiple optionList={optionList} filter defaultValue={['semi2']} autoClearSearchValue={clear}></Select>

            <h4>controlled mode + update optionList + remote + autoClearSearchValue = false</h4>
            <Select
              style={{ width: 400 }}
              multiple
              optionList={list}
              filter
              remote
              className='remote-select'
              loading={loading}
              value={value}
              onChange={handleChange}
              autoClearSearchValue={clear}
              onSearch={handleSearch}
            >
            </Select>
        </>
    )
}

AutoClearSearchValue.story = {
  name: 'AutoClearSearchValue',
};


export const RenderSelectedItemCallCount = () => {
      const list = [
        { "name": "夏可漫", "email": "xiakeman@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg" },
        { "name": "申悦", "email": "shenyue@example.com", "avatar": "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg" },
        { "name": "曲晨一", "email": "quchenyi@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/8bd8224511db085ed74fea37205aede5.jpg" },
        { "name": "文嘉茂", "email": "wenjiamao@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png" },
        { "name": "文嘉茂2", "email": "wenjiamao@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png" },
        { "name": "文嘉茂3", "email": "wenjiamao@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png" },
    ]

    const renderMultipleWithCustomTag = (optionNode, { onClose }) => {
        console.count('rerender')
        const content = (
            <Tag
                avatarSrc={optionNode.avatar}
                avatarShape='circle'
                closable={true}
                onClose={onClose}
                size='large'
            >
                {optionNode.name}
            </Tag>
        );
        return {
            isRenderInTag: false,
            content
        };
    }

    const renderCustomOption = (item, index) => {
        const optionStyle = {
            display: 'flex',
            paddingLeft: 24,
            paddingTop: 10,
            paddingBottom: 10
        }
        return (
            <Select.Option value={item.name} style={optionStyle} showTick={true}  {...item} key={item.email}>
                <Avatar size="small" src={item.avatar} />
                <div style={{ marginLeft: 8 }}>
                    <div style={{ fontSize: 14 }}>{item.name}</div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: 12, lineHeight: '16px', fontWeight: 'normal' }}>{item.email}</div>
                </div>
            </Select.Option>
        )
    }

    return (
        <>
            <Select
                placeholder='请选择'
                showClear
                multiple
                maxTagCount={2}
                style={{ width: 280, height: 40 }}
                onChange={v => console.log(v)}
                defaultValue={'夏可漫'}
                renderSelectedItem={renderMultipleWithCustomTag}
            >
                {list.map((item, index) => renderCustomOption(item, index))}
            </Select>
        </>
    );
}


RenderSelectedItemCallCount.story = {
  name: 'RenderSelectedItemCallCount',
};

const RenderSelectedItemWithMaxTagCount = () => {
  const list = [
      { "name": "夏可漫", "email": "xiakeman@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg" },
      { "name": "申悦", "email": "shenyue@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bf8647bffab13c38772c9ff94bf91a9d.jpg" },
      { "name": "曲晨一", "email": "quchenyi@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/8bd8224511db085ed74fea37205aede5.jpg" },
      { "name": "文嘉茂", "email": "wenjiamao@example.com", "avatar": "https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/6fbafc2d-e3e6-4cff-a1e2-17709c680624.png" },
  ];

  const renderMultipleWithCustomTag = (optionNode, { onClose }) => {
      const content = (
          <Tag
              avatarSrc={optionNode.avatar}
              avatarShape='circle'
              closable={true}
              onClose={onClose}
              size='large'
              style={{ maxWidth: '100%'}}
          >
              {optionNode.email}
          </Tag>
      );
      return {
          isRenderInTag: false,
          content
      };
  };

  const renderMultipleWithCustomTag2 = (optionNode, { onClose }) => {
      const content = (
          <Tag
              avatarSrc={optionNode.avatar}
              avatarShape='square'
              closable={true}
              onClose={onClose}
              size='large'
              style={{ maxWidth: '100%'}}
          >
              {optionNode.name}
          </Tag>
      );
      return {
          isRenderInTag: false,
          content
      };
  };

  const renderCustomOption = (item, index) => {
      const optionStyle = {
          display: 'flex',
          paddingLeft: 24,
          paddingTop: 10,
          paddingBottom: 10
      };
      return (
          <Select.Option value={item.name} style={optionStyle} showTick={true}  {...item} key={item.email}>
              <Avatar size="small" src={item.avatar} />
              <div style={{ marginLeft: 8 }}>
                  <div style={{ fontSize: 14 }}>{item.email}</div>
                  <div style={{ color: 'var(--color-text-2)', fontSize: 12, lineHeight: '16px', fontWeight: 'normal' }}>{item.email}</div>
              </div>
          </Select.Option>
      );
  };

  return (
      <>
        renderSelectedItem + maxTagCount=10 + defaultValue.length=2
        <br />
        <Select
            placeholder='请选择'
            maxTagCount={10}
            style={{ width: 350, marginTop: 20 }}
            onChange={v => console.log(v)}
            defaultValue={['夏可漫', '申悦']}
            multiple
            renderSelectedItem={renderMultipleWithCustomTag}
            ellipsisTrigger
            showRestTagsPopover
            expandRestTagsOnClick
        >
            {list.map((item, index) => renderCustomOption(item, index))}
        </Select>
        <br />
        <br />
        renderSelectedItem + maxTagCount=1 + defaultValue.length=2 + filter
        <br />
        <Select
            placeholder='请选择'
            maxTagCount={1}
            filter
            style={{ width: 350, marginTop: 20 }}
            onChange={v => console.log(v)}
            defaultValue={['夏可漫', '申悦']}
            multiple
            renderSelectedItem={renderMultipleWithCustomTag2}
            ellipsisTrigger
            showRestTagsPopover
            expandRestTagsOnClick
        >
            {list.map((item, index) => renderCustomOption(item, index))}
        </Select>
      </>
  );
};


export const NPlusTruncationStrategy = () => {
    const shortVal = ['semi11', 'semi1']
    const val = ['semi11', 'semi1', 'semi3', 'semi4', 'semi10']
    const allSelect = ['semi11', 'semi1', 'semi2', 'semi3', 'semi4', 'semi5', 'semi6', 'semi7', 'semi8', 'semi9', 'semi10']

    const options = [
        { label: 'semi1semi1', value: 'semi1' },
        { label: 'semi2semi2semi2', value: 'semi2' },
        { label: 'semi3semi3semi3semi3', value: 'semi3' },
        { label: 'semi4semi4semi4semi4semi4', value: 'semi4' },
        { label: 'semi5semi5semi5semi5semi5semi5', value: 'semi5' },
        { label: 'semi6semi6semi6semi6semi6semi6semi6', value: 'semi6' },
        { label: 'semi7semi7semi7semi7semi7semi7semi7', value: 'semi7' },
        { label: 'semi8semi8semi8semi8semi8semi8semi8', value: 'semi8' },
        { label: 'semi9semi9semi9semi9semi9semi9semi9', value: 'semi9' },
        { label: 'semi10semi10semi10semi10semi10semi10', value: 'semi10' },
        { label: '我是中文超长选项我真的真的真的真的真的真的超级长', value: 'semi11' },
    ];
    // expandRestTagsOnClick

    return (
        <>
            <h4>未设置宽度 和 maxTagCount </h4>
            defaultValue.length = 5
            <br /><br />
            <Select multiple optionList={options} defaultValue={val} ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br /><br />
            
            <h4>未设置宽度</h4>
            maxTagCount = 2 + defaultValue.length = 5
            <br /><br />
            <Select maxTagCount={2} multiple optionList={options} defaultValue={val} ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select> 
            <br /><br />
            maxTagCount = 2 + defaultValue.length = 5 + expandRestTagsOnClick=false
            <br /><br />
            <Select maxTagCount={2} multiple optionList={options} defaultValue={val} expandRestTagsOnClick={false} ellipsisTrigger showRestTagsPopover></Select>
            <br /><br />
            maxTagCount = 6 + defaultValue.length = 5
            <br /><br />
            <Select maxTagCount={6} multiple optionList={options} defaultValue={val} ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 6 + defaultValue.length = 5 + filter
            <br /><br />
            <Select maxTagCount={6} multiple optionList={options} defaultValue={val} filter ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br /><br />

            <h4>定宽</h4>
            maxTagCount = 2 + defaultValue.length = 2
            <br /><br />
            <Select style={{ width: '350px' }} maxTagCount={2} multiple optionList={options} defaultValue={shortVal} showClear ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 5 + defaultValue.length = 5
            <br /><br />
            <Select style={{ width: '550px' }} maxTagCount={5} multiple  optionList={options} defaultValue={val} showClear ellipsisTrigger showRestTagsPopove expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 10 + defaultValue.length = 11
            <br /><br />
            <Select style={{ width: '550px' }} maxTagCount={10} multiple  optionList={options} defaultValue={allSelect} showClear ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 10 + defaultValue.length = 11 + filter
            <br /><br />
            <Select style={{ width: '550px' }} maxTagCount={10} multiple  optionList={options} defaultValue={allSelect} filter showClear ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 10 + defaultValue.length = 11 + expandRestTagsOnClick=false
            <br /><br />
            <Select style={{ width: '550px' }} maxTagCount={10} multiple  optionList={options} defaultValue={allSelect} expandRestTagsOnClick={false} showClear ellipsisTrigger showRestTagsPopover></Select>
            <br /><br /><br />

            <h4>能保证正常渲染的最小宽度至少是120px</h4>
            <Select style={{ width: '120px' }} maxTagCount={10} multiple  optionList={options} defaultValue={val} showClear ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br /><br />

            <h4>前缀/后缀/insetLabel</h4>
            maxTagCount = 2 + defaultValue.length = 2 + prefix
            <br /><br />
            <Select style={{ width: '500px' }} maxTagCount={2} prefix={<IconSearch />} multiple  optionList={options} defaultValue={shortVal} ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 6 + defaultValue.length = 5 + suffix
            <br /><br />
            <Select style={{ width: '500px' }} maxTagCount={6} suffix={<IconSearch />} multiple  optionList={options} defaultValue={val} ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br />
            maxTagCount = 6 + defaultValue.length = 11 + insetLabel
            <br /><br />
            <Select style={{ width: '500px' }} maxTagCount={6} insetLabel={<IconSearch />} multiple  optionList={options} defaultValue={allSelect} ellipsisTrigger showRestTagsPopover expandRestTagsOnClick></Select>
            <br /><br /><br />

            <h4>renderSelectedItem</h4>
            <RenderSelectedItemWithMaxTagCount />
            <br />
        </>
    )
}

NPlusTruncationStrategy.story = {
  name: 'NPlusTruncationStrategy',
};

export const emptyContent = () => {
  const list = null;
  return (
    <Select placeholder='请选择业务线' emptyContent={null} style={{ width: 180 }} optionList={list} defaultOpen={true}/>
  )
}

export const Fix1584 = () => {
  return (
    <>
      defaultValue is null
      <br />
      <Select 
        style={{ width: 180 }} 
        defaultValue={null}
        placeholder="带搜索功能的单选"
        renderSelectedItem={(item) => {
          console.log('items', item);  
          return <div>{item.label}</div>}}
      >
        <Select.Option value="abc">抖音</Select.Option>
        <Select.Option value="ulikecam">轻颜相机</Select.Option>
        <Select.Option value="jianying">剪映</Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
      </Select>
      <br />
      <br />
      defaultValue is undefined
      <br />
      <Select 
        style={{ width: 180 }} 
        defaultValue={undefined}
        placeholder="带搜索功能的单选"
        renderSelectedItem={(item) => <div>{item.label}</div>}
      >
        <Select.Option value="abc">抖音</Select.Option>
        <Select.Option value="ulikecam">轻颜相机</Select.Option>
        <Select.Option value="jianying">剪映</Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
      </Select>
    </>
  );
}


export const Fix1560 = () => {
  return (
    <div>
      <h4>边界 case 测试</h4>
      <h4>maxTagCount = 3，截断最后一个 tag, 加减项正常</h4>
      <Select
        multiple
        maxTagCount={3}
        ellipsisTrigger
        showRestTagsPopover={true}
        restTagsPopoverProps={{ position: 'top' }}
        style={{ width: '255px' }}
        defaultValue={['abc', 'ulikecam', "xigua"]}
      >
        <Select.Option value="abc">抖音</Select.Option>
        <Select.Option value="ulikecam">轻颜相机</Select.Option>
        <Select.Option value="jianying">剪映</Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
      </Select>
      <br /><br />
      <h4>maxTagCount = 3，最大宽度只展示 2 个 Tag，加减项正常</h4>
      <Select
        multiple
        maxTagCount={2}
        ellipsisTrigger
        showRestTagsPopover={true}
        restTagsPopoverProps={{ position: 'top' }}
        style={{ width: '240px' }}
        defaultValue={['xigua', 'ulikecam', 'jianying', 'abc']}
      >
        <Select.Option value="abc">抖音</Select.Option>
        <Select.Option value="ulikecam">轻颜相机</Select.Option>
        <Select.Option value="jianying">剪映</Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
      </Select>
    </div>
  );
}

class VirtualizeAllowCreate extends React.Component {
    constructor(props) {
        super(props);
        const taskList=[{
            "task_id": 500333,
            "task_name": "抖音直播间-哈哈哈",
            "task_key": "hhh_watch_live"
        },]
        let newOptions = taskList.map(r=>({value:r.task_id,label:`${r.task_id} ${r.task_name}`}))
        this.state = {
            optionList: newOptions,
        };
    }
    render() {
        let { optionList } = this.state;
        let virtualize = {
            height: 270,
            width: '100%',
            itemSize: 36, // px
        };
        return (
            <>
                <Select
                    allowCreate
                    placeholder="拥有3k个Option的Select"
                    style={{ width: 260 }}
                    filter
                    onSearch={this.handleSearch}
                    virtualize={virtualize}
                    optionList={optionList}
                    renderCreateItem={(iv, isFocused, style) => <div style={{ padding: '6px 12px', ...style }}>输入 {iv}</div>} 
                ></Select>
            </>
        );
    }
}

// virtualize allowCreate + renderCreateItem, optionList render not as expected
export const Fix1856 = () => (<VirtualizeAllowCreate />); 


export const TestOptionKey = () => {
  return <><Select style={{ width: 300 }}>
      <Select.Option label='abc' value='2' key='abc'></Select.Option>
      <Select.Option label='efg' value='3' key='efg'></Select.Option>
      <Select.Option label='kkk' value='5'></Select.Option>
      <Select.Option label='fff' value='4'></Select.Option>
    </Select>
    <br/><br/>
    <Select style={{ width: 300 }} optionList={[
      { label: '1', value: '2', key: 'kkk' },
      { label: '2', value: '3', key: 'jjj' },
      { label: '3', value: '2' },
    ]}>
    </Select>
  </>
}

export const AllCaseOfBlur = () => {

  const BaseSelect = (props) => {
    return (
       <Select defaultValue="abc" style={{ width: 120 }} {...props} >
        <Select.Option value="abc">抖音</Select.Option>
        <Select.Option value="ulikecam">轻颜相机</Select.Option>
        <Select.Option value="jianying" disabled>
            剪映
        </Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
      </Select>
    )
  }
  return (
    <div>
      <h3>单选</h3>
      <Divider margin='12px' />
      <h5>默认配置</h5>
      <BaseSelect data-cy="singleDefault" onBlur={()=>{console.log('single default onBlur')}} />
      <br />
      <h5>filter</h5>
      <BaseSelect data-cy="singleFilter" filter onBlur={()=>{console.log('single filter onBlur')}} />
      <br />
      <h5>autoFocus</h5>
      <BaseSelect data-cy="singleAutoFocus" autoFocus onBlur={()=>{console.log('single autoFocus onBlur')}} />
      <br />
      <h5>clickToHide</h5>
      <BaseSelect data-cy="singleClickToHide" clickToHide onBlur={()=>{console.log('single clickToHide onBlur')}} />
      <br />
      <h5>showClear</h5>
      <BaseSelect data-cy="singleShowClear" showClear onBlur={()=>{console.log('single showClear onBlur')}} />

      <h3>多选</h3>
      <Divider margin='12px' />
      <h5>默认配置</h5>
      <BaseSelect data-cy="multipleDefault" multiple onBlur={()=>{console.log('multiple default onBlur')}} />
      <br />
      <h5>filter</h5>
      <BaseSelect data-cy="multipleFilter" multiple filter onBlur={()=>{console.log('multiple filter onBlur')}} />
      <h5>clickToHide</h5>
      <BaseSelect data-cy="multipleClickToHide" multiple clickToHide onBlur={()=>{console.log('multiple clickToHide onBlur')}} />
      <h5>showClear</h5>
      <BaseSelect data-cy="multipleShowClear" multiple showClear onBlur={()=>{console.log('multiple showClear onBlur')}} />
      <br />
      <br />
    </div>
  )
}

export const UpdateOtherKeyNotInList = () => {
  const [v, setV] = useState([
    {
      label: 'AA-Label',
      value: 'AA',
      otherProps: 'AA-OtherProps',
    },
  ]);

  const change = () => {
    setV([
      {
        label: 'AA-Label-2',
        value: 'AA',
        otherProps: 'AA-OtherProps-2',
      },
    ])
  }

  const renderSelectedItem = (optionNode) => {
    const { label, otherProps } = optionNode;
    const content = (
      <div className='render-content'>
        {label}-{otherProps}
      </div>
    );
    return {
      isRenderInTag: false,
      content,
    };
  };
  return (
    <>
      <Select
        value={v}
        onChange={setV}
        filter
        multiple
        renderSelectedItem={renderSelectedItem}
        onChangeWithObject
        style={{ width: 320 }}
      />
      <Button id='change' onClick={() => change()}>change</Button>
    </>
  );
};


export const ControledSameLabelInNode = () => {
    const [value, setValue] = useState();
    return <Select style={{ width: 180 }} 
        value={value}
        id='test'
        // motion={false}
        data-cy="singleControl"
        onChange={(value) => {
            console.log('change');
            console.log(value)
            setValue(value)
        }}>
        <Select.OptGroup label="Asia">
            <Select.Option value="a-1" label={<div>China</div>} className='a-1' data-cy='a-1' key={'a-1'}></Select.Option>
            <Select.Option value="a-2" label={<div>China</div>} className='a-2' data-cy='a-2' key={'a-2'}></Select.Option>
            <Select.Option value="a-3" label={<div>Korea</div>} className='a-3'></Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label="Europe">
            <Select.Option value="b-1" label={<div>Germany</div>}></Select.Option>
            <Select.Option value="b-2" label={<div>France</div>}></Select.Option>
        </Select.OptGroup>
    </Select>
}

export const SearchPosition = () => {
  
  return (<>
        <Select
          filter
          searchPosition='dropdown'
          onChangeWithObject
          placeholder={'single searchPosition=dropdown'}
          optionList={optionList}
          searchPlaceholder='dropdown input place'
          showClear
          autoFocus
          style={{ width: 320 }}
        />
        <Select
          filter
          multiple
          placeholder={'multiple searchPosition=dropdown'}
          searchPosition='dropdown'
          onChangeWithObject
          showClear
          searchPlaceholder='dropdown input place'
          autoClearSearchValue={false}
          optionList={optionList}
          style={{ width: 320 }}
        />
    </>
  )
}

export const fix2465 = () => {
  let singleSelectBox = useRef(null);
  let multipleSelectBox = useRef(null);

    let outSlotStyle = {
        backgroundColor: 'var(--semi-color-fill-0)',
        height: '36px',
        display: 'flex',
        paddingLeft: 32,
        color: 'var(--semi-color-link)',
        alignItems: 'center',
        cursor: 'pointer',
        borderTop: '1px solid var(--semi-color-border)',
        borderRadius: '0 0 6px 6px',
    };
    let singleOutSlotNode = (
        <div style={outSlotStyle}>
            <button onClick={(e)=>{singleSelectBox.current.close()}}>single close</button>
        </div>
    );
    let multipleOutSlotNode = (
        <div style={outSlotStyle}>
            <button onClick={(e)=>{multipleSelectBox.current.close()}}>multiple close</button>
        </div>
    );

    return (
        <div>
            <p>点击 Select 展开弹层后，点击 close 按钮关闭弹层，最后点击外部，检查 Select 聚焦样式是否消失 </p>
            <Select
                ref={singleSelectBox}
                style={{ width: 300 }}
                dropdownStyle={{ width: 180 }}
                maxHeight={150}
                outerBottomSlot={singleOutSlotNode}
                placeholder="单选"
                autoAdjustOverflow={false}
                position="bottom"
            >
                <Select.Option value="abc">抖音</Select.Option>
                <Select.Option value="ulikecam">轻颜相机</Select.Option>
                <Select.Option value="jianying">剪映</Select.Option>
                <Select.Option value="duoshan">多闪</Select.Option>
                <Select.Option value="xigua">西瓜视频</Select.Option>
            </Select>
            <br />
            <br />
            <Select
                ref={multipleSelectBox}
                style={{ width: 300 }}
                dropdownStyle={{ width: 180 }}
                maxHeight={150}
                outerBottomSlot={multipleOutSlotNode}
                placeholder="多选"
                autoAdjustOverflow={false}
                multiple
                position="bottom"
            >
                <Select.Option value="abc">抖音</Select.Option>
                <Select.Option value="ulikecam">轻颜相机</Select.Option>
                <Select.Option value="jianying">剪映</Select.Option>
                <Select.Option value="duoshan">多闪</Select.Option>
                <Select.Option value="xigua">西瓜视频</Select.Option>
            </Select>
            <Button onClick={()=>{multipleSelectBox.current.close()}}>close</Button>
        </div>
    );
}


export const Fix2853 = () => {
  return (
    <Select placeholder="" style={{ width: 180 }} filter>
        <Select.OptGroup key="a" label={<div>a</div>} >
            <Select.Option value="a-1" key="a-1">a-1</Select.Option>
            <Select.Option value="a-2" key="a-2">a-2</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label={<div>b</div>} >
            <Select.Option value="b-1">b-1</Select.Option>
            <Select.Option value="b-2">b-2</Select.Option>
        </Select.OptGroup>
        <Select.OptGroup label={<div>c</div>} >
            <Select.Option value="c-1">c-1</Select.Option>
        </Select.OptGroup>
    </Select>
  )
}