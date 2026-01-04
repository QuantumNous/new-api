import React, { useState, useCallback, useRef, useEffect } from 'react';
import GraphemeSplitter from 'grapheme-splitter';
import { isFunction, isString } from 'lodash';

import {
  Input,
  InputGroup,
  TextArea,
  TimePicker,
  DatePicker,
  AutoComplete,
  Cascader,
  Select,
  TagInput,
  Tree,
  TreeSelect,
  Icon,
  TabPane,
  Tabs,
  Button,
  Typography,
  Switch,
  Form,
  Space,
  Radio,
  InputNumber
} from '../../index';
import './input.scss';
import RTLWrapper from '../../configProvider/_story/RTLDirection/RTLWrapper';
import { IconSearch, IconCopy, IconClear, IconStar } from '@douyinfe/semi-icons';

export default {
  title: 'Input',
  parameters: {
    chromatic: { disableSnapshot: true },
  }
}

const { Title, Text } = Typography;

const log = (...args) => console.log(...args);

export const _Input = () => (
  <div
    className="input"
    style={{
      width: 200,
    }}
  >
      <Input onlyBorder={2} size={"large"} />
      <Input validateStatus="warning" />
    <Input validateStatus="error" />
    <br />
    <br />
    <Input size="large" />
    <Input size="large" validateStatus="warning" />
    <Input size="large" validateStatus="error" />
    <br />
    <br />
    <Input size="small" />
    <Input size="small" validateStatus="warning" />
    <Input size="small" validateStatus="error" />
  </div>
);

_Input.parameters = {
  chromatic: { disableSnapshot: false },
};

export const InputAutofocus = () => (
  <div className="input">
    <Input placeholder="ies input" autoFocus />
  </div>
);

InputAutofocus.story = {
  name: 'Input autoFocus',
};

export const InputPlaceholder = () => (
  <div className="input">
    <Input placeholder="ies input" />
  </div>
);

InputPlaceholder.story = {
  name: 'Input placeholder',
};

export const InputDisabled = () => (
  <div className="input">
    <Input disabled value="禁用文本框值" />
  </div>
);

InputDisabled.parameters = {
  chromatic: { disableSnapshot: false },
};

InputDisabled.story = {
  name: 'Input disabled',
};

export const InputClearable = () => (
  <div className="input">
    <Input showClear defaultValue="ies" />
    <Input showClear defaultValue="search input" type='search' />
  </div>
);

InputClearable.story = {
  name: 'Input showClear',
};

export const InputPrefixSuffixDemo = () => (
  <div className="input">
    <Input prefix="search" showClear defaultValue="Semi Design" />
    <Input prefix={<span>pre</span>} showClear defaultValue="Semi Design" />
    <Input prefix={<span>pre</span>} showClear defaultValue="Semi Design" />
    <Input suffix={<IconSearch />} autoFocus showClear defaultValue="Semi Design"></Input>
    <Input suffix="Semi Design" showClear defaultValue="Semi Design"></Input>
    <Input
      suffix={
        <Typography.Text
          strong
          type="secondary"
          style={{
            margin: '0 8px',
          }}
        >
          Suffix
        </Typography.Text>
      }
      showClear
      defaultValue="Semi Design"
    ></Input>
  </div>
);

InputPrefixSuffixDemo.story = {
  name: '前缀/后缀 Input prefix suffix',
};

InputPrefixSuffixDemo.parameters = {
  chromatic: { disableSnapshot: false },
};

export const InputAddonBeforeAddonAfter = () => (
  <div className="input">
    <Input addonBefore="https://" addonAfter=".com" />
  </div>
);

InputAddonBeforeAddonAfter.story = {
  name: '前置/后置标签 Input addonBefore addonAfter',
};

InputAddonBeforeAddonAfter.parameters = {
  chromatic: { disableSnapshot: false },
};

export const InputPassword = () => (
  <div className="input">
    <Input mode="password" placeholder="请输入密码" />
    <Input mode="password" defaultValue="ies" />
    <Input mode="password" showClear defaultValue="ies" />
    <Input mode="password" disabled defaultValue="ies" />
  </div>
);

InputPassword.story = {
  name: 'Input password',
};

InputPassword.parameters = {
  chromatic: { disableSnapshot: false },
};

export const ControlInput = () => {
  const [value, setValue] = useState('initString');
  return (
    <div className="input">
      <Input value={value} onChange={setValue} showClear />
      <Input value={value} onChange={log} showClear />
    </div>
  );
};

ControlInput.story = { name: '受控组件' };

export const UnControlInput = () => (
  <div className="input">
    <Input onChange={v => console.log(v)} defaultValue="initString" />
  </div>
);
UnControlInput.story = { name: '非受控组件' };

export const Password = () => (
  <div className="input">
    <Input type="password" />
  </div>
);

Password.story = {
  name: 'password',
};

const treeData = [
  {
    label: '亚洲',
    value: 'Asia',
    key: '0',
    children: [
      {
        label: '中国',
        value: 'China',
        key: '0-0',
        children: [
          {
            label: '北京',
            value: 'Beijing',
            key: '0-0-0',
          },
          {
            label: '上海',
            value: 'Shanghai',
            key: '0-0-1',
          },
        ],
      },
    ],
  },
  {
    label: '北美洲',
    value: 'North America',
    key: '1',
  },
];

export const Group = () => (
  <div className="input">
    <InputGroup>
      <Select
        placeholder="Name"
        style={{
          width: 100,
        }}
        optionList={[
          {
            value: 1,
            label: 1,
          },
          {
            value: 2,
            label: 2,
          },
        ]}
      />
      <Select
        placeholder="Score"
        style={{
          width: 140,
        }}
        optionList={[
          {
            value: 1,
            label: 1,
          },
          {
            value: 2,
            label: 2,
          },
        ]}
      />
    </InputGroup>
    <br />
    <br />
    {/* <InputGroup>
           <Input placeholder="Name" style={{ width: 100 }} />
           <InputNumber placeholder="Score" style={{ width: 140 }} />
       </InputGroup>
       <br/><br/>
       <InputGroup size={'small'}>
           <Select style={{ width: '100px' }} defaultValue='home'>
               <Option value='home'>Home</Option>
               <Option value='work'>Work</Option>
           </Select>
           <AutoComplete
               data={['Beijing Haidian']}
               placeholder='Address: '
               style={{ width: 180 }}
           >
           </AutoComplete>
       </InputGroup>
       <br/><br/>
       <InputGroup size={'small'}>
           <Select style={{ width: '100px' }} defaultValue='signup'>
               <Option value='signup'>Sign Up</Option>
               <Option value='signin'>Sign In</Option>
           </Select>
           <Input placeholder="Email" style={{ width: 180 }} />
       </InputGroup>
       <br/><br/>
        <InputGroup>
           <Select style={{ width: '100px' }} defaultValue='signup'>
               <Option value='signup'>Sign Up</Option>
               <Option value='signin'>Sign In</Option>
           </Select>
           <TreeSelect
               style={{ width: 300 }}
               treeData={treeData}
               placeholder="Please select"
           />
       </InputGroup>
       <br/><br/>
        <InputGroup>
           <Select style={{ width: 100 }} defaultValue='signup'>
               <Option value='signup'>Sign Up</Option>
               <Option value='signin'>Sign In</Option>
           </Select>
           <TreeSelect
               style={{ width: 300 }}
               treeData={treeData}
               placeholder="Please select"
           />
           <Cascader
               style={{ width: 300 }}
               treeData={treeData}
               placeholder="Please select"
           />
       </InputGroup> */}
  </div>
);

Group.story = {
  name: 'group',
};

Group.parameters = {
  chromatic: { disableSnapshot: false },
};

export const Textarea = () => <TextArea limit={100} onChange={v => console.log(v)} />;

Textarea.story = {
  name: 'textarea',
};

export const AutosizeTextarea = () => (
  <div className="input">
    <TextArea autosize onChange={v => console.log(v)} />
    {/* <TextArea autosize limit={500} onChange={v => console.log(v)} />
       <TextArea autosize rows={1} onChange={v => console.log(v)} /> */}
  </div>
);

AutosizeTextarea.story = {
  name: 'autosize textarea',
};

export const TextareaInnerMaxCount = () => (
  <div className="input">
    <TextArea defaultValue="TextArea without maxCount" />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="0123456789" />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System exceed maxCount" />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System autosize" autosize rows={2} />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System disabled" disabled />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System readonly" readonly />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System warning" validateStatus="warning" />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System error" validateStatus="error" />
    <br />
    <br />
    <TextArea maxCount={10} defaultValue="Semi Design System normal" validateStatus="normal" />
    <br />
    <br />
  </div>
);

TextareaInnerMaxCount.story = {
  name: 'textarea inner maxCount ',
};

TextareaInnerMaxCount.parameters = {
  chromatic: { disableSnapshot: false },
};

class RefDemo extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
    };
    this.inputRef = React.createRef();
    this.focus = this.focus.bind(this);
  }

  focus(inputValue) {
    console.log(this.inputRef);
    debugger;
    this.inputRef.current.focus();
  }

  render() {
    return (
      <div>
        <Input ref={this.inputRef} />
        <Button onClick={this.focus}>focus</Button>
      </div>
    );
  }
}

class TARefDemo extends React.Component {
  constructor() {
    super();
    this.ref = React.createRef();
    this.focus = this.focus.bind(this);
    this.blur = this.blur.bind(this);
  }

  focus(val) {
    console.log(this.ref, val);
    this.ref.current.focus();
  }

  blur() {
    this.ref.current.blur();
  }

  render() {
    return (
      <div>
        <TextArea ref={this.ref} />
        <Button onClick={this.focus}>focus</Button>
        <Button onClick={this.blur}>blur</Button>
      </div>
    );
  }
}

export const InputRefDemo = () => (
  <>
    <RefDemo />
    <TARefDemo />
  </>
);

InputRefDemo.story = {
  name: 'ref的使用',
};

export const InputHideSuffix = () => (
  <div className="input" onClick={() => console.log('clicking DIV....')}>
    <Input suffix={<IconCopy onClick={() => console.log('clicking')} />} showClear hideSuffix />
  </div>
);

InputHideSuffix.story = {
  name: 'Input hideSuffix',
};

InputHideSuffix.parameters = {
  chromatic: { disableSnapshot: false },
};

export const TextareaInTabPane = () => (
  <div>
    <Tabs type="line">
      <TabPane tab="文档" itemKey="1">
        <TextArea
          autosize={true}
          value={
            '卡垃圾速度快；发神经地方；京阿是；大家；发生空间的浪费空间阿莱克斯\n决定分开了京阿是快进到风口浪尖阿斯顿克己复礼卡就是快乐减肥空间就是快乐的健康京阿是快的\n解放路口京阿是来对\n抗肌肤阿就是大家阿节点空间阿斯顿空间卡经典款九分裤阿是加快立法开始饭卡空间发考\n虑时间快放假啊肯德基快放辣椒的；放假啊；江东父老卡快放假\n啊快到家快放假啊的快乐减肥咖哩鸡的卡上看到肌肤卡经典空间卡；框架'
          }
        />
      </TabPane>
      <TabPane tab="快速起步" itemKey="2">
        <TextArea
          autosize={true}
          value={
            '1234\n卡垃圾速度快；发神经地方；京阿是；大家；发生空间的浪费空间阿莱克斯\n决定分开了京阿是快进到风口浪尖阿斯顿克己复礼卡就是快乐减肥空间就是快乐的健康京阿是快的\n解放路口京阿是来对\n抗肌肤阿就是大家阿节点空间阿斯顿空间卡经典款九分裤阿是加快立法开始饭卡空间发考\n虑时间快放假啊肯德基快放辣椒的；放假啊；江东父老卡快放假\n啊快到家快放假啊的快乐减肥咖哩鸡的卡上看到肌肤卡经典空间卡；框架'
          }
        />
      </TabPane>
    </Tabs>
  </div>
);

TextareaInTabPane.story = {
  name: 'Textarea in TabPane',
};

const ControlTextarea = () => {
  const [value, setValue] = useState('initString');
  return (
    <>
      <TextArea value={value} onChange={setValue} />
      <br />
      <TextArea value={value} onChange={setValue} autosize />
    </>
  );
};

export const ControlledTextarea = () => <ControlTextarea />;
ControlledTextarea.story = {
  name: '受控textarea'
}

export const FixAddonBeforeShowClear = () => (
  <Space wrap>
    <Input
      style={{
        width: 300,
      }}
      autoFocus
      defaultValue="Semi Design"
      addonBefore="http://"
      showClear
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      addonAfter=".com"
      showClear
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      showClear
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      showClear
      validateStatus="warning"
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      showClear
      validateStatus="error"
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      mode="password"
      showClear
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      addonAfter=".com"
      mode="password"
      showClear
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      addonAfter=".com"
      mode="password"
      showClear
      size="small"
    />
    <Input
      style={{
        width: 300,
      }}
      defaultValue="Semi Design"
      addonBefore="http://"
      addonAfter=".com"
      mode="password"
      showClear
      size="large"
    />
  </Space>
);

FixAddonBeforeShowClear.story = {
  name: 'fix addonBefore + showClear',
};

FixAddonBeforeShowClear.parameters = {
  chromatic: { disableSnapshot: false },
};

export const FocusWhenClickPrefixSuffix = () => (
  <Space wrap>
    <Input
      style={{ width: 200 }}
      onFocus={() => console.log('focused')}
      prefix="search"
      defaultValue="Semi Design"
    />
    <Input
      style={{ width: 200 }}
      onFocus={() => console.log('focused')}
      onBlur={() => {
        console.log('blur');
      }}
      suffix={<IconSearch />}
      defaultValue="Semi Design"
    ></Input>
    <Input
      disabled
      style={{ width: 200 }}
      onFocus={() => console.log('focused')}
      prefix="search"
      suffix={<IconSearch />}
      defaultValue="disabled"
    />
  </Space>
);

FocusWhenClickPrefixSuffix.story = {
  name: 'focus when click prefix/suffix',
};

export const GetValueLengthEmojiLengthProcess = () => {
  function getValueLength(str) {
    if (isString(str)) {
      const splitter = new GraphemeSplitter();
      return splitter.countGraphemes(str);
    } else {
      return -1;
    }
  }

  const [getVisibleLengthFC, setGetVisibleLength] = useState(() => getValueLength);
  const [value, setValue] = useState();
  const handleSwitch = useCallback(value => {
    if (value) {
      setGetVisibleLength(() => getValueLength);
    } else {
      setGetVisibleLength(value);
    }
  }, []);
  const strExceed10 = '0123456789semi design';
  return (
    <div className="input">
      <div>
        <Title
          heading={6}
          style={{
            margin: 8,
          }}
        >
          getValueLength = {isFunction(getVisibleLengthFC) ? 'function' : 'null'}
        </Title>
        <Switch checked={isFunction(getVisibleLengthFC)} onChange={handleSwitch}>
          getValueLength
        </Switch>
      </div>
      <h4>maxLength=10</h4>
      <Input
        maxLength={10}
        getValueLength={getVisibleLengthFC}
        style={{
          width: 200,
        }}
      />
      <h4>controlled mode + maxLength=10</h4>
      <Input
        value={value}
        onChange={value => {
          console.log('input change', value);
          setValue(value);
        }}
        maxLength={10}
        getValueLength={getVisibleLengthFC}
        style={{
          width: 200,
        }}
      />
      <h4>controlled mode + given value exceed maxLength</h4>
      <div>
        <Input
          value={strExceed10}
          maxLength={10}
          getValueLength={getVisibleLengthFC}
          style={{
            width: 200,
          }}
        />
        {getVisibleLengthFC && (
          <Text>{`getValueLength('${strExceed10}')=${getVisibleLengthFC(strExceed10)}`}</Text>
        )}
      </div>
      <h4>maxCount=10</h4>
      <TextArea
        maxCount={10}
        getValueLength={getVisibleLengthFC}
        style={{
          width: 200,
        }}
      />
      <h4>maxCount=10 + maxLength=10</h4>
      <TextArea
        maxCount={10}
        maxLength={10}
        getValueLength={getVisibleLengthFC}
        style={{
          width: 200,
        }}
      />
      <h4>form.input + minLength=4</h4>
      <Form>
        <Form.Input
          field="username"
          minLength={4}
          getValueLength={getVisibleLengthFC}
          style={{
            width: 200,
          }}
        />
        <Button type="primary" htmlType="submit">
          提交
        </Button>
      </Form>
    </div>
  );
};

GetValueLengthEmojiLengthProcess.story = {
  name: 'getValueLength emoji length process',
};

GetValueLengthEmojiLengthProcess.parameters = {
  chromatic: { disableSnapshot: false },
};

const ShowClearTextarea = () => {
  const [value, setValue] = useState('initString');
  const handleChange = value => {
    setValue(value);
  };
  return (
    <>
      <div>受控+onFocus/onBlur</div>
      <TextArea
        value={value}
        onChange={v => handleChange(v)}
        showClear
        onClear={e => console.log('clear', e)}
        onFocus={() => console.log('focus')}
        onBlur={() => console.log('blur')}
      />
      <br />
      <br />
      <div>disabled</div>
      <TextArea defaultValue="123" disabled showClear onClear={e => console.log('clear', e)} />
      <br />
      <br />
      <div>readonly</div>
      <TextArea defaultValue="123" readonly showClear onClear={e => console.log('clear', e)} />
      <br />
      <br />
      <div>rows=1,cols=1</div>
      <TextArea rows={1} cols={1} showClear onClear={e => console.log('clear', e)} />
    </>
  );
};
export const TextareaShowClear = () => <ShowClearTextarea />;

TextareaShowClear.story = {
  name: 'textarea showClear',
};

export const ClearButton = () => {
  const [direction, setDirection] = React.useState('ltr');
  const treeData = [
    {
      label: '亚洲',
      value: 'Asia',
      key: '0',
      children: [
        {
          label: '中国',
          value: 'China',
          key: '0-0',
          children: [
            {
              label: '北京',
              value: 'Beijing',
              key: '0-0-0',
            },
            {
              label: '上海',
              value: 'Shanghai',
              key: '0-0-1',
            },
          ],
        },
      ],
    },
    {
      label: '北美洲',
      value: 'North America',
      key: '1',
    },
  ];
  return (
    <RTLWrapper
      onDirectionChange={dir => {
        console.log('dir', dir);
        setDirection(dir);
      }}
    >
      <Input defaultValue="semi" suffix={<IconClear />} />
      <Input defaultValue="semi" showClear suffix={<IconStar />} />
      <Input
        defaultValue="semi"
        showClear
        suffix={
          <Typography.Text
            strong
            type="secondary"
            style={direction === 'ltr' ? { marginRight: 8 } : { marginLeft: 8 }}
          >
            Suffix
          </Typography.Text>
        }
      />
      <Input showClear defaultValue="semi" />
      <Input showClear mode="password" defaultValue="semi" />
      <Input mode="password" defaultValue="semi" />
      <br />
      <br />
      <Cascader defaultValue="semi design" showClear />
      <Select defaultValue="semi design" showClear />
      <TagInput defaultValue={['semi design']} showClear />
      {/* <Transfer showClear /> */}
      <TimePicker defaultValue={new Date()} showClear />
      <DatePicker defaultValue={new Date()} showClear />
      <Tree filterTreeNode treeData={treeData} showClear />
      <TreeSelect defaultValue="semi design" showClear />
    </RTLWrapper>
  );
};

ClearButton.story = {
  name: 'clear button',
};

export const InputFocus = () => {
  const ref = React.useRef();
  const handleClick = () => {
    ref.current.focus();
  };
  return (
    <>
      <Button onClick={handleClick}>focus input</Button>
      <Input ref={ref} onChange={() => console.log('ref', ref) } onFocus={() => console.log('focus')} />
    </>
  );
};

export const TextAreaAutosize = () => {
  return (
    <div style={{ width: 200 }}>
      <TextArea autosize />
      <TextArea autosize rows={2} />
      <TextArea autosize={false} rows={2} />
      <TextArea autosize={{ minRows: 1 }} />
      <TextArea autosize={{ minRows: 1, maxRows: 3 }} onResize={({ height }) => console.log('onResize', height)}/>
      <TextArea autosize={{ maxRows: 3 }} rows={1} />
    </div>
  )
};
TextAreaAutosize.storyName = "textarea autosize";

export const InputA11y = () => {
  return (
    <div style={{ width: 300 }}>
      <Input prefix="search" defaultValue="Semi Design" showClear />
      <br/><br/>
      <Input aria-required prefix="search" defaultValue="Semi Design" showClear suffix="semi" />
      <br/><br/>
      <Input data-cy="password" defaultValue="Semi Design" mode="password" />
      <br/><br/>
      <Input defaultValue="Semi Design" mode="password" disabled />
      <br/><br/>
      <Input defaultValue='this value is too long' validateStatus='error' showClear></Input>
      <br/><br/>
      <TextArea defaultValue='semi' showClear />
      <TextArea aria-required defaultValue='不能为空' showClear />
      <InputGroup label={{ text: '成绩信息' }}>
          <Input placeholder="Name" style={{ width: 100 }} />
          <Input placeholder="Score" style={{ width: 140 }} />
      </InputGroup>
      <br/><br/>
      <Form onSubmit={() => alert('submit')}>
        <button>submit</button>
        <Form.Input field="password" label="密码按钮上敲击 Enter 测试是否会触发 Form submit" mode="password" />
      </Form>
    </div>
  );
}
InputA11y.storyName = "input a11y";

export const FixInputGroup = () => {
  const groupFocus = () => {
    console.log('group focus');
  }
  const groupBlur = () => {
    console.log('group blur');
  }
  const inputFocus = () => {
    console.log('input focus');
  }
  const inputBlur = () => {
    console.log('input blur');
  }

  return (
    <InputGroup disabled={true} onFocus={groupFocus} onBlur={groupBlur}>
        <Input disabled={false} onFocus={inputFocus} onBlur={inputBlur} placeholder="Name" style={{ width: 100 }} />
        <InputNumber placeholder="Score" style={{ width: 140 }} />
    </InputGroup>
  );
}

export const forwardRefFocus = () => {
  const myRef = useRef(null);
  let myRef2 = null;
  const commonProps = {
    prefix: 'Prefix',
    suffix: "Suffix",
    style: { width: 200 },
    defaultValue: 'hi' 
  }
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContents: 'flex-start', marginTop: 20 };

  return (
    <>
    <p>无 ref</p>
    <div style={rowStyle}>
      <Input {...commonProps} />
    </div>
    <p>对象式 ref，点击按钮通过 ref.current.focus()聚焦</p>
    <div style={rowStyle}>
      <Button
        style={{ marginRight: 20 }}
        onClick={() => {
          console.log(myRef);
          myRef && myRef.current && myRef.current.focus();
        }}
      >
        聚焦
      </Button>
      <Input  ref={myRef} {...commonProps}/>
    </div>
    <p>函数式 ref， 点击按钮通过 ref.focus()聚焦</p>
    <div style={rowStyle}>
      <Button
        style={{ marginRight: 20 }} 
        onClick={() => {
          myRef2 && myRef2.focus();
        }}
      >
        聚焦
      </Button>
      <Input 
        ref={(node) => {
          myRef2 = node
        }}
        {...commonProps}
      />
    </div>
  </>
)};

export const TextAutoSizeResize = () => {
  const [width, setWidth] = useState(800);

  return (
    <div>
      <Space style={{ marginBottom: 20 }}>
        <Button onClick={() => setWidth(100)}>width=100</Button>
        <Button onClick={() => setWidth(1000)}>width=1000</Button>
      </Space>
      <div style={{ width, maxWidth: '100%' }}>
        <TextArea autosize defaultValue='semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design ' />
      </div>
    </div>
  )
};

export const FixInputAutoFocus = () => {
  const longStr = 'semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design';
  const inputRef = useRef();
  const [selection, setSelection] = useState();
  useEffect(() => {
    const start = inputRef.current.selectionStart;
    const end = inputRef.current.selectionEnd;
    setSelection({ start, end, length: longStr.length });
  }, []);
  return (
    <div>
      <Input ref={inputRef} style={{ width: 200 }} autoFocus defaultValue={longStr} />
      <div data-cy="start">start: {selection?.start}</div>
      <div data-cy="end">end: {selection?.end}</div>
    </div>
  )
};

export const FixTextAreaAutoFocus = () => {
  const inputRef = useRef();
  const [selection, setSelection] = useState();
  useEffect(() => {
    const start = inputRef.current.selectionStart;
    const end = inputRef.current.selectionEnd;
    setSelection({ start, end });
  }, []);
  const longStr = 'semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design semi design';
  return (
    <div>
      <TextArea ref={inputRef} style={{ width: 200 }} autoFocus defaultValue={longStr} />
      <div data-cy="start">start: {selection?.start}</div>
      <div data-cy="end">end: {selection?.end}</div>
    </div>
  )
};

export const LongPlaceholder = () => {
  return (<Input 
    placeholder="Long placeholder test Long placeholder test Long placeholder test"
    style={{width: 200}}
  />)
};