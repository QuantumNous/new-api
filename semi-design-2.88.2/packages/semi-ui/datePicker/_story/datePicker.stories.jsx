import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  startOfMonth,
  endOfMonth,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { Space, ConfigProvider, InputGroup, InputNumber, Form, withField, Button, RadioGroup, Radio } from '../../index';

// stores
import NeedConfirmDemo from './NeedConfirm';
import RenderDate from './RenderDate';
import RenderFullDate from './RenderFullDate';
import DateOffset from './DateOffset';
import AllTypesDemo from './AllTypes';
import Callbacks from './Callbacks';
import DatePicker from '../index';
import ExceptionDemo from './ExceptionDemo';
import ControlledDemo from './ControlledDemo';
import DisabledDate from './DisabledDate';
import CustomTrigger from './CustomTrigger';
import OverPopover from './OverPopover';
import OnChangeWithDateFirst from './OnChangeWithDateFirst';
import Multiple from './Multiple';
import Autofocus from './Autofocus';
import CycledDatePicker from './Cycled';
import AutoSwitchDate from './AutoSwitchDate';
import TimepikcerOpts from './TimePickerOpts';
import Density from './Density';
import DatePickerSlot from './DatePickerSlot';
import DatePickerTimeZone from './DatePickerTimeZone';
import BetterRangePicker from './BetterRangePicker';
import SyncSwitchMonth from './SyncSwitchMonth';
import { Checkbox } from '../../checkbox';
import Typography from '../../typography/typography';
import { IconClose, IconChevronDown } from '@douyinfe/semi-icons';
import * as dateFns from 'date-fns';

export {
    YearButton,
    PanelOpen,
    FixInputRangeFocus,
    InsetInput,
    InsetInputE2E,
    FixDefaultPickerValue,
    InputFormat,
    InputFormatDisabled,
    AutoFillTime,
    InputFormatConfirm,
    FixedTriggerRender,
    DisabledRange,
    FixDisabledMonth,
    FixRangePanelShift,
    InsetInputControlled,
    FeatInsetInputProps,
    FixMultiplePanelShift,
    FixTimeZone,
    FeatRefOpen,
    FeatRefFocus,
    FeatOnClickOutside,
    FeatRefClass,
    FixNeedConfirmInTabs,
    DynamicDisabledDate,
    FeatEtcGMT,
    FixDisabledDate,
    FeatInsetInputShowClear,
    AutoSplitInput,
    FixNeedConfirmControlled,
    FixedNaN,
    PresetsFunctionType,
    FixedSelectedStatus,
    FixedControlled,
    FixedControlledValue
} from './v2';


export default {
  title: 'DatePicker',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

export {
  ControlledDemo,
  NeedConfirmDemo,
  ExceptionDemo,
  AllTypesDemo,
  Callbacks,
  DisabledDate,
  CustomTrigger,
  OverPopover,
  OnChangeWithDateFirst,
  RenderDate,
  RenderFullDate,
  Autofocus,
  DateOffset,
  CycledDatePicker,
  AutoSwitchDate,
  TimepikcerOpts,
  Density,
  DatePickerSlot,
  DatePickerTimeZone,
  BetterRangePicker,
  SyncSwitchMonth,
}

const demoDiv = {
  marginTop: '20px',
  marginLeft: '20px',
};

export const DatePickerDefault = () => (
  <div style={{...demoDiv, height: '100vh'}}>
    <span>datePicker施工现场</span>
    <DatePicker
      insetLabel={<span>日期</span>}
      onChange={(str, date) => console.log(str)}
      onOpenChange={status => console.log(status)}
      placeholder="请选择日期"
    />
    <br />

    <span>datePicker默认显示</span>
    <DatePicker />
    <br />

    <span>defaultValue: 2019-07-09</span>
    <DatePicker defaultValue="2019-07-09" />
    <br />

    <span>defaultValue: 1569888000000</span>
    <DatePicker
      defaultValue={1569888000000}
      onChange={(input, value) => console.log({ input, value })}
    />
    <br />

    <span>defaultValue: new Date('2019-07-07')</span>
    <DatePicker
      defaultValue={new Date('2019-07-07')}
      onOpenChange={isOpen => console.log(isOpen)}
      defaultOpen
      motion={false}
    />
  </div>
);
DatePickerDefault.parameters = {
  chromatic: {
    disableSnapshot: false,
    delay: 300
  }
};

export const DatePickerCallbacks = () => {
  const printArgs = (...args) => console.log(...args);

  return (
    <div style={demoDiv}>
      <span>datePicker施工现场</span>
      <DatePicker onOpenChange={printArgs} />
      <br />

      <span>defaultValue: new Date('2019-07-07')</span>
      <DatePicker defaultValue={new Date('2019-07-07')} />
      <br />

      <span>defaultValue: 2019-07-09</span>
      <DatePicker defaultValue="2019-07-09" />
      <br />

      <span>defaultValue: 1569888000000</span>
      <DatePicker
        defaultValue={1569888000000}
        onChange={(input, value) => console.log(input, value)}
      />
    </div>
  );
};

export const DatePickerMultiple = () => <Multiple />;

export const DateRangePicker = () => (
  <div style={demoDiv}>
    <div>dateRangePicker</div>
    <DatePicker type="dateRange" insetLabel="结束日期" prefix="test" validateStatus="error" />
    <br />

    <div>small dateRangePicker</div>
    <DatePicker type="dateRange" size="small" disabled prefix="test" />
    <br />

    <div>large dateRangePicker</div>
    <DatePicker type="dateRange" size="large" />
    <br />

    <div>compact dateRangePicker</div>
    <DatePicker type="dateRange" density="compact" validateStatus="warning" />
    <br />

    <div>dateRangePicker with offset</div>
    <DatePicker
      type="dateRange"
      startDateOffset={date => startOfWeek(date, { weekStartsOn: 1 })}
      endDateOffset={date => endOfWeek(date, { weekStartsOn: 1 })}
    />
    <br />

    <div>defaultValue：07/01-08/02</div>
    <DatePicker type="dateRange" defaultValue={[new Date('2019-07-01'), new Date('2019-08-02')]} />
  </div>
);
DateRangePicker.parameters = {
  chromatic: { disableSnapshot: false },
};

const presets = [
  {
    text: 'Today',
    start: new Date(),
    end: new Date(),
  },
  {
    text: 'Tomorrow',
    start: addDays(new Date(), 1),
    end: addDays(new Date(), 1),
  },
  {
    text: 'Today After Tomorrow',
    start: addDays(new Date(), 2),
    end: addDays(new Date(), 2),
  },
  {
    text: 'Next Week',
    start: addWeeks(new Date(), 1),
    end: addWeeks(new Date(), 2),
  },
  {
    text: 'Next Month',
    start: startOfMonth(addMonths(new Date(), 1)),
    end: endOfMonth(addMonths(new Date(), 1)),
  },
  {
    text: 'Next Bimonthly',
    start: startOfMonth(addMonths(new Date(), 1)),
    end: endOfMonth(addMonths(new Date(), 2)),
  },
  {
    text: 'Next Quarter',
    start: startOfMonth(addMonths(new Date(), 3)),
    end: endOfMonth(addMonths(new Date(), 3)),
  },
];

export const DatePickerWithPresets = () => {
  const onPresetClick = (item, e) => {
    console.log('preset click', item, e);
  };
  const [presetPosition, setPresetPosition] = useState('right');
  const [insetInput, setInsetInput] = useState(false);
  const [presetArr, setPresetArr] = useState(presets);

   const BottomSlot = function(props) {
        const { style } = props;
        return (
            <div style={{ padding: '12px 20px', ...style }}>
                <div strong style={{ color: 'var(--semi-color-text-2)' }}>
                    定版前请阅读
                </div>
                <div link={{ href: 'https://semi.design/', target: '_blank' }}>发版须知</div>
            </div>
        );
    };
  return (
    <div style={demoDiv}>
      <span>带快捷选择的DatePicker</span>
      <br/>
      <br/>
       <RadioGroup onChange={e=>setPresetPosition(e.target.value)} value={presetPosition} aria-label="选择快捷选择面板位置" name="preset-radio-group">
            <Radio value={'left'}>left</Radio>
            <Radio value={'right'}>right</Radio>
            <Radio value={'top'}>top</Radio>
            <Radio value={'bottom'}>bottom</Radio>
        </RadioGroup>
        <Checkbox value={insetInput} onChange={e=>setInsetInput(e.target.checked)}>insetInput</Checkbox>
        <Checkbox value={presetArr} onChange={e=>setPresetArr(e.target.checked ? [...presets, ...presets, ...presets]:presets)}>more presets</Checkbox>
       <br/>
      <div>type="date"</div>
      <DatePicker
        type="date"
        presets={presetArr}
        insetInput={insetInput}
        presetPosition={presetPosition}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="dateTime"</div>
      <DatePicker
        type="dateTime"
        insetInput={insetInput}
        needConfirm
        bottomSlot={<BottomSlot/>}
        presetPosition={presetPosition}
        presets={presetArr.map(preset => ({
          text: preset.text,
          start: preset.start,
        }))}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="dateRange"</div>
      <DatePicker
        type="dateRange"
        presets={presetArr}
        insetInput={insetInput}
        presetPosition={presetPosition}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="dateTimeRange"</div>
      <DatePicker
        type="dateTimeRange"
        presets={presetArr}
        insetInput={insetInput}
        presetPosition={presetPosition}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="month"</div>
      <DatePicker
        type="month"
        insetInput={insetInput}
        presetPosition={presetPosition}
        presets={presetArr.map(preset => ({
          text: preset.text,
          start: preset.start,
        }))}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      {/* <br/>
      <br/>
      <div>type="monthRange"</div>
      <DatePicker
        type="monthRange"
        insetInput={insetInput}
        presetPosition={presetPosition}
        presets={presetArr.map(preset => ({
          text: preset.text,
          start: preset.start,
        }))}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      /> */}
      <br/>
      <br/>
      <div>type="date" density="compact"</div>
      <DatePicker
        type="date"
        presets={presetArr}
        insetInput={insetInput}
        density="compact"
        presetPosition={presetPosition}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="dateTime" density="compact"</div>
      <DatePicker
        type="dateTime"
        insetInput={insetInput}
        needConfirm
        density="compact"
        presetPosition={presetPosition}
        presets={presetArr.map(preset => ({
          text: preset.text,
          start: preset.start,
        }))}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="dateRange" density="compact"</div>
      <DatePicker
        type="dateRange"
        presets={presetArr}
        density="compact"
        insetInput={insetInput}
        presetPosition={presetPosition}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="dateTimeRange"  density="compact"</div>
      <DatePicker
        type="dateTimeRange"
        density="compact"
        presets={presetArr}
        insetInput={insetInput}
        presetPosition={presetPosition}
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
      <br/>
      <br/>
      <div>type="month" density="compact"</div>
      <DatePicker
        type="month"
        insetInput={insetInput}
        presetPosition={presetPosition}
        presets={presetArr.map(preset => ({
          text: preset.text,
          start: preset.start,
        }))}
        density="compact"
        onPresetClick={onPresetClick}
        onChange={(...args) => console.log(...args)}
      />
    </div>
  );
};

function isDisabled(dayStr) {
  return isBefore(new Date(dayStr), new Date());
}

export const DatePickerDisabledDate = () => (
  <div style={demoDiv}>
    <span>不可选日期</span>
    <DatePicker type="dateRange" presets={presets} disabledDate={isDisabled} />
  </div>
);

export const DateTimePicker = () => (
  <div style={demoDiv}>
    <span>dateTimePicker</span>
    <DatePicker
      defaultPickerValue={parseISO('2020-02-20 20:00:00')}
      type="dateTime"
      onChange={(...args) => console.log('onChange: ', ...args)}
    />
  </div>
);

export const DateTimeRangePicker = () => (
  <div style={demoDiv}>
    <span>dateTimeRangePicker</span>
    <DatePicker type="dateTimeRange" defaultPickerValue={parseISO('2020-02-20 20:00:00')} />
    <br />

    <span>dateTimeRangePicker</span>
    <DatePicker type="dateTimeRange" presets={presets} />
    <br />

    <span>dateTimeRangePicker - multiple</span>
    <DatePicker type="dateTimeRange" multiple />
    <br />
  </div>
);

export const YearPicker = () => (
  <>
    <div>
      <span>Year Picker</span>
      <DatePicker type="dateTimeRange" />
    </div>
    <div>
      <span>Year Picker</span>
      <DatePicker type="dateTimeRange" presets={presets} />
    </div>
  </>
);

export const MonthPicker = () => {
  const Demo = () => {
    const [controlledValue, setControlledValue] = useState('2019-09');
    const [controlledRangeValue, setControlledRangeValue] = useState(['2019-09', '2019-10']);


    const _setControlledValue = value => setControlledValue(value);
    const _setControlledRangeValue = value => setControlledRangeValue(value);


    return (
      <>
        <div>
          <span>MonthPicker</span>
          <DatePicker type="month" />
        </div>
        <div>
          <span>MonthPicker with presets</span>
          <DatePicker type="month" presets={presets} />
        </div>
        <div>
          <span>MonthPicker with disabledDate</span>
          <DatePicker
            type="month"
            disabledDate={str => {
              const date = new Date(str);

              if (str.length <= 4) {
                return date.getFullYear() < 2015;
              }

              return date.getMonth() + 1 < 10;
            }}
          />
        </div>
        <div>
          <span>MonthPicker with presets</span>
          <DatePicker type="month" presets={presets} />
        </div>
        <div>
          <span>MonthPicker with controlledValue</span>
          <DatePicker type="month" value={controlledValue} onChange={_setControlledValue} />
        </div>
        <br />
        <br />
        <h3>monthRange</h3>
        <div>
          <span>MonthRange Picker</span>
          <DatePicker type="monthRange"  />
        </div>
        <div>
          <span>MonthRange Picker with controlledValue</span>
          <DatePicker type="monthRange" value={controlledRangeValue} onChange={_setControlledRangeValue} />
        </div>
      </>
    );
  };

  return <Demo />;
};

export const MonthRangePicker = () => {
    const { Text } = Typography;
    const formatToken = 'yyyy-MM';
    const [controlledValue, setControlledValue] = useState(['2023-03', '2023-04']);
    const [triggerValue, setTriggerValue] = useState();

    const _setControlledValue = value => setControlledValue(value);

    const onChange = useCallback(date => {
      setTriggerValue(date);
    }, []);

    const onClear = useCallback(e => {
        e && e.stopPropagation();
        setTriggerValue(null);
    }, []);

    const closeIcon = useMemo(() => {
        return triggerValue ? <IconClose onClick={onClear} /> : <IconChevronDown />;
    }, [triggerValue]);

    const triggerContent = (placeholder) => {
        if (Array.isArray(triggerValue) && triggerValue.length) {
            return `${dateFns.format(triggerValue[0], formatToken)} ~ ${dateFns.format(triggerValue[1], formatToken)}`;
        } else {
            return '请选择年月时间范围';
        }
    };

    const TopSlot = function(props) {
      const { style } = props;
      return (
          <Space style={{ padding: '12px 20px', ...style }}>
              <Text strong style={{ color: 'var(--semi-color-text-2)' }}>
                  请选择月份范围
              </Text>
          </Space>
      );
    };

    const BottomSlot = function(props) {
      const { style } = props;
      return (
          <Space style={{ padding: '12px 20px', ...style }}>
              <Text strong style={{ color: 'var(--semi-color-text-2)' }}>
                  定版前请阅读
              </Text>
              <Text link={{ href: 'https://semi.design/', target: '_blank' }}>发版须知</Text>
          </Space>
      );
    };

    const disabledDate = date => {
        const deadDate = new Date('2023/3/1 00:00:00');
        return date.getTime() < deadDate.getTime(); 
    };

    const disabledRangeDate = date => {
        const deadDate = new Date('2025/3/1 00:00:00');
        const startDate = new Date('2024/11/1 00:00:00');
        return date.getTime() < startDate.getTime() || date.getTime() > deadDate.getTime(); 
    };

    return (
      <>
        <div>
          <div>default</div>
          <DatePicker type="monthRange" />
          <br />
          <br />
          <div>rangeSeparator 与 placeholder</div>
          <DatePicker type="monthRange" rangeSeparator={'➡️'} placeholder={['开始', '结束']} insetLabel='月份范围'/>
          <br />
          <br />
          <div>受控</div>
          <DatePicker type="monthRange" bottomSlot={<BottomSlot />} topSlot={<TopSlot />} value={controlledValue} onChange={_setControlledValue}/>
          <br />
          <br />
          <div>insetInput ➕ format</div>
          <div data-cy="monthRange">
            <DatePicker type="monthRange" insetInput format={'yyyy年MM月'} rangeSeparator={'到'} defaultValue={['2023-03', '2023-04']} style={{ width: 400 }}/>
          </div>
          <br />
          <div>triggerRender</div>
          <DatePicker 
            type="monthRange" 
            value={triggerValue} 
            onChange={onChange}
            triggerRender={({ placeholder }) => (
                <Button theme={'light'} icon={closeIcon} iconPosition='right'>
                    {triggerContent(placeholder)}
                </Button>
            )}
          />
          <br />
          <br />
          <div>年月禁用：禁用2023年3月前的所有年月</div>
          <DatePicker type="monthRange" disabledDate={disabledDate}/>
          <div>年月禁用：禁用2024年11月前 & 2025年2月后的所有年月</div>
          <DatePicker type="monthRange" disabledDate={disabledRangeDate}/>
          <br />
          <br />
          <div>validateStatus</div>
          <DatePicker type="monthRange" validateStatus='warning' />
          <br />
          <DatePicker type="monthRange" validateStatus='error' />
        </div>
      </>
    );
};

export const PropTypesAndDefaultProps = () => (
  <div>
    <article>
      <p>{JSON.stringify(Object.keys(DatePicker.propTypes))}</p>
      <p>{JSON.stringify(DatePicker.defaultProps)}</p>
    </article>
  </div>
);

export const InputReadOnly = () => <DatePicker inputReadOnly={true} />;

export const DropdownClassNameDropdownStyle = () => (
  <div>
    <h4>fontSize: 16，dropdownClassName: 'my-datePicker'</h4>
    <DatePicker
      dropdownStyle={{ fontSize: 16 }}
      dropdownClassName="my-datePicker"
      onChange={(date, dateString) => console.log(dateString)}
    />
  </div>
);

export const CustomPlaceholder = () => (
  <Space wrap>
    <DatePicker placeholder="请选择日期" insetLabel="默认" />
    <DatePicker placeholder={undefined} insetLabel="undefined" />
    <DatePicker placeholder="" insetLabel="空字符串" />
    <DatePicker placeholder={false} insetLabel="false" />
    <DatePicker placeholder={null} insetLabel="null" />
    <DatePicker placeholder="" type="dateRange" insetLabel="空字符串" />
  </Space>
);
CustomPlaceholder.parameters = {
  chromatic: { disableSnapshot: false },
};

export const FixNotifyChange = () => {
  function Demo() {
    const [tz, setTz] = useState(0);
    const [value, setVal] = useState();
    const [value2, setVal2] = useState();
    const [value3, setVal3] = useState();
    const [value4, setVal4] = useState();
    const withLog = fn => {
      return val => {
        console.log('notifyChange', val);
        fn(val);
      };
    };
    return (
      <ConfigProvider timeZone={tz}>
        <InputGroup>
          <InputNumber defaultValue={0} onChange={setTz} hideButtons />
          <DatePicker type="dateTimeRange" value={value} onChange={withLog(setVal)} />
          <DatePicker
            type="dateTimeRange"
            needConfirm
            value={value2}
            onConfirm={withLog(setVal2)}
          />
          <DatePicker type="date" value={value3} onChange={withLog(setVal3)} />
          <DatePicker type="dateRange" value={value4} onChange={withLog(setVal4)} />
        </InputGroup>
      </ConfigProvider>
    );
  }
  return <Demo />;
};

export const SelectNotDisabledDateV126 = () => {
  const defaultValue = ['2021-08-06', '2021-08-15'];
  const disabledMonth = dateStr => {
    const date = new Date(dateStr);
    const month = date.getMonth();
    if (month === 7) {
      return true;
    }
    return false;
  };
  const disabledDate = dateStr => {
    const date = new Date(dateStr);
    const day = date.getDate();
    if (day > 20 && day < 25) {
      return true;
    }
    return false;
  };

  let props = {
    type: 'dateRange',
    motion: false,
    defaultValue,
    onChange: (...args) => console.log('changed', ...args),
    style: { width: 300 },
  };

  return (
    <>
      <h4>dateRange type + disabled rangeStart and select rangeEnd</h4>
      <DatePicker {...props} disabledDate={disabledMonth} />
      <h4>date type + multiple select + given disabled defaultValue</h4>
      <DatePicker {...props} type="date" multiple disabledDate={disabledDate} />
    </>
  );
};

SelectNotDisabledDateV126.story = {
  name: 'select not disabled date(v1.26+)',
};

const CustomDatePicker = props => {
  const { fieldRef, ...rest } = props;
  return <DatePicker {...rest} ref={fieldRef} />;
};

const CustomFieldDatePicker = withField(CustomDatePicker);

export const FixOnFocus = () => {
  function FocusDemo() {
    const [open1, setOpen1] = useState(false);
    const [open2, setOpen2] = useState(false);
    const [open3, setOpen3] = useState(false);
    const ref = useRef();
    const ref2 = useRef();
    const presets = [
      {
        text: 'Today',
        start: new Date(),
        end: new Date(),
      },
      {
        text: 'Tomorrow',
        start: new Date(new Date().valueOf() + 1000 * 3600 * 24),
        end: new Date(new Date().valueOf() + 1000 * 3600 * 24),
      },
    ];
    return (
      <>
        <DatePicker
          type="date"
          presets={presets}
          open={open1}
          onPresetClick={() => {
            setOpen1(false);
          }}
          onFocus={() => {
            console.log('focus');
            setOpen1(true);
          }}
          onBlur={() => {
            console.log('blur');
          }}
          style={{ width: 300 }}
        />
        <br />
        <br />
        <DatePicker
          type="dateTimeRange"
          presets={presets}
          open={open2}
          onPresetClick={() => {
            console.log('click presets', ref);
            setOpen2(false);
            setTimeout(() => {
              ref.current.foundation.closePanel();
              console.log(ref);
            }, 0);
          }}
          onFocus={() => {
            console.log('focus');
            setOpen2(true);
          }}
          onBlur={() => {
            console.log('blur');
          }}
          style={{ width: 500 }}
          ref={ref}
        />
        <Form>
          <CustomFieldDatePicker
            type="dateTimeRange"
            field="a"
            label="Form.DatePicker"
            presets={presets}
            open={open3}
            onPresetClick={() => {
              console.log('click presets', ref2);
              setOpen3(false);
              setTimeout(() => {
                ref2.current && ref2.current.foundation.closePanel();
              }, 0);
            }}
            onFocus={() => {
              console.log('focus');
              setOpen3(true);
            }}
            onBlur={() => {
              console.log('blur');
            }}
            style={{ width: 500 }}
            fieldRef={ref2}
          />
        </Form>
      </>
    );
  }
  return <FocusDemo />;
};

FixOnFocus.story = {
  name: 'fix onFocus',
};

export const FixDisabledTimeCallback1418 = () => {
  function Demo() {
    const disabledTime2 = (date, panelType) => {
      console.log('disabledTime callback parameter: ', date, panelType);
      if (panelType === 'left') {
        return { disabledHours: () => [17, 18] };
      } else {
        return { disabledHours: () => [12, 13, 14, 15, 16, 17, 18] };
      }
    };

    return (
      <>
        <strong>fix disabledTime callback parameter bug</strong>
        <DatePicker
          type="dateTimeRange"
          hideDisabledOptions={false}
          disabledTime={disabledTime2}
          defaultValue={['2021-09-08', '2021-10-03']}
          style={{ width: 400 }}
        />
        <DatePicker
          type="dateTime"
          hideDisabledOptions={false}
          defaultValue={'2021-09-08'}
          disabledTime={disabledTime2}
          style={{ width: 400 }}
        />
      </>
    );
  }

  return <Demo />;
};

FixDisabledTimeCallback1418.story = {
  name: 'fix disabledTime callback #1418',
};

export const RangeSeparator = () => (
  <Space wrap>
    <div>
      <div>custom rangeSeparator</div>
      <DatePicker
        type="dateRange"
        rangeSeparator="-"
        defaultValue={[new Date('2019-07-01'), new Date('2019-08-02')]}
      />
      <DatePicker
        type="dateTimeRange"
        rangeSeparator="-"
        defaultValue={[new Date('2019-07-01'), new Date('2019-08-02')]}
      />
    </div>
    <div>
      <div>default rangeSeparator</div>
      <DatePicker
        type="dateRange"
        defaultValue={[new Date('2019-07-01'), new Date('2019-08-02')]}
      />
      <DatePicker
        type="dateTimeRange"
        defaultValue={[new Date('2019-07-01'), new Date('2019-08-02')]}
      />
    </div>
  </Space>
);

/**
 * 修复输入 '20221-12-20' 类似这种年份的日期会崩溃问题
 * https://github.com/DouyinFE/semi-design/issues/422
 * 
 * 非法日期的来源
 *  - 用户输入
 *  - 受控传入
 * @returns 
 */
export const FixParseISOBug = () => (
  <div>
    <label>
      <div>选择一个合法值，然后输入一个非法年份</div>
      <DatePicker defaultValue={'2021-12-20'} onChange={v => console.log('onChange', v)} />
    </label>
    <label>
      <div>defaultValue='20221-12-20'</div>
      <DatePicker defaultValue={'20221-12-20'} defaultOpen={true} motion={false} onChange={v => console.log('onChange', v)} />
    </label>
  </div>
);
FixParseISOBug.storyName = '修复 parseISO bug';
FixParseISOBug.parameters = {
  chromatic: { disableSnapshot: false },
};

export const FixNeedConfirm = () => {
  const defaultDate = '2021-12-27 10:37:13';
  const defaultDateRange = ['2021-12-27 10:37:13', '2022-01-28 10:37:13' ];
  const props = {
    needConfirm: true,
    onConfirm: (...args) => {
      console.log('Confirmed: ', ...args);
    },
    onChange: (...args) => {
      console.log('Changed: ', ...args);
    },
    onCancel: (...args) => {
      console.log('Canceled: ', ...args);
    },
  };

  return (
    <div>
      <div data-cy="1">
        <span>dateTime + needConfirm + defaultValue</span>
        <div>
          <DatePicker
            type="dateTime"
            defaultValue={defaultDate}
            {...props}
          />
        </div>
      </div>
      <div data-cy="2">
        <span>dateTime + needConfirm</span>
        <div>
          <DatePicker
            type="dateTime"
            {...props}
          />
        </div>
      </div>
      <div data-cy="3">
        <span>dateTimeRange + needConfirm + defaultValue</span>
        <div>
          <DatePicker
            type="dateTimeRange"
            defaultValue={defaultDateRange}
            {...props}
          />
        </div>
      </div>
      <div data-cy="4">
        <span>dateTimeRange + needConfirm</span>
        <div>
          <DatePicker
            type="dateTimeRange"
            {...props}
          />
        </div>
      </div>
    </div>
  )
}
FixNeedConfirm.storyName = '修复 needConfirm 取消后输入框显示错误';

/**
 * fix https://github.com/DouyinFE/semi-design/issues/388
 */
export const FixPresetsClick = () => {
  const presets = [
    {
      text: '清空',
      start: '',
      end: '',
    },
    {
      text: 'Tomorrow',
      start: new Date(new Date().valueOf() + 1000 * 3600 * 24),
      end: new Date(new Date().valueOf() + 1000 * 3600 * 24),
    },
  ];

  const handleChange = v => {
    console.log('change', v);
  };

  const handleConfirm = v => {
    console.log('confirm', v);
  }

  return (
    <div>
      <div>
        <label>
          <span>不设置 needConfirm</span>
          <DatePicker onChange={console.log} type="dateRange" presets={presets} />
        </label>
      </div>
      <div>
        <label>
          <span>设置 needConfirm</span>
          <DatePicker needConfirm onChange={handleChange} onConfirm={handleConfirm} type="dateTimeRange" presets={presets} />
        </label>
      </div>
    </div>
  );
};
FixPresetsClick.storyName = '修复 presets 点击后不收起问题';

/**
 * fix https://github.com/DouyinFE/semi-design/issues/410
 */
export const FixTriggerRenderClosePanel = () => {
  const [value, setValue] = useState([]);

  const handleChange = v => {
    console.log('change', v);
    setValue(v);
  };

  const formatValue = (dates) => {
    const dateStrs = dates.map(v => String(v));
    return dateStrs.join(' ~ ');
  };

  const showClear = Array.isArray(value) && value.length > 1;

  return (
    <Space>
      <DatePicker
        value={value}
        type="dateRange"
        onChange={handleChange}
        motion={false}
        triggerRender={({ placeholder }) => (
            <Button>
                {(value && formatValue(value)) || placeholder}
            </Button>
        )}
      />
      {showClear && (
        <Button onClick={() => setValue([])}>清除</Button>
      )}
    </Space>
  );
};
FixTriggerRenderClosePanel.storyName = "fix triggerRender close bug"

export const A11yKeyboardDemo = () => {
  const [value, setValue] = useState(new Date('2022-08-08 00:00'));
  const [rangeValue, setRangeValue] = useState([new Date('2022-08-08 00:00'), new Date('2022-08-09 12:00')]);

  const handleChange = v => {
    console.log('change', v);
    setValue(v);
  };

   const handleRangeChange = v => {
    console.log('change', v);
    setRangeValue(v);
  };

  return (
    <Space vertical align='start' data-cy="space">
      <div  data-cy="dateRange">
        <DatePicker
          value={rangeValue}
          type="dateRange"
          onChange={handleRangeChange}
          showClear
        />
      </div>
      <div data-cy="date">
        <DatePicker
          onChange={handleChange}
          showClear
          multiple
        />
      </div>
    </Space>
  );
};

A11yKeyboardDemo.storyName = "a11y keyboard demo";

/**
 * test with cypress
 */
export const NeedConfirmDelete = () => {
  return (
    <div data-cy="dateTimeRange">
      <DatePicker
        value={[new Date('2022-08-08 00:00'), new Date('2022-08-09 12:00')]}
        type="dateTimeRange"
        needConfirm
      />
    </div>
  );
};
NeedConfirmDelete.storyName = "cashedSelectedValue return to last selected when needConfirm & input invalid";

/**
 * test with cypress
 */
 export const CashedSelectedValue = () => {
  return (
    <Space>
      <div data-cy="date">
        <DatePicker
          defaultValue={new Date('2022-08-08')}
          type="date"
          motion={false}
        />
      </div>
      <div data-cy="dateTime">
        <DatePicker
          defaultValue={new Date('2022-08-08 19:11:00')}
          type="dateTime"
          motion={false}
        />
      </div>
      <div data-cy="dateRange">
        <DatePicker
          defaultValue={[new Date('2022-08-08'), new Date('2022-08-09')]}
          type="dateRange"
          motion={false}
        />
      </div>
    </Space>
  );
};
CashedSelectedValue.storyName = "cashedSelectedValue";

export const Fix1982 = () => {
  return <DatePicker type="monthRange" style={{ width: 200 }} />
}


export const Fix2567 = () => {
  const disabledDate = (date) => {
    const deadDate = new Date('2025/3/1 00:00:00');
    const startDate = new Date('2024/11/1 00:00:00');
    return date.getTime() < startDate.getTime() || date.getTime() > deadDate.getTime(); 
  }
  return (
    <div>
      <div>datePicker monthRange 对于三种需要矫正日期的处理</div>
      <br />
      <div>点击右侧面板 2024</div>
      <DatePicker defaultValue={['2024-11', '2025-01']}type="monthRange"  disabledDate={disabledDate} />
      <br />
      <br />
      <div>点击右侧面板 2024</div>
      <DatePicker defaultValue={['2024-12', '2025-01']}type="monthRange"  disabledDate={disabledDate} />
      <br />
      <br />
      <div>点击左侧面板 2025</div>
      <DatePicker defaultValue={['2024-11', '2025-01']}type="monthRange"  disabledDate={disabledDate} />
    </div>
  )
}
