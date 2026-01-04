import React, { useState } from 'react';

import Calendar from '../index';
import { Button, RadioGroup, Radio, LocaleProvider, Select } from '@douyinfe/semi-ui';
import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import en_US from '@douyinfe/semi-ui/locale/source/en_US';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';
import ar from '@douyinfe/semi-ui/locale/source/ar';
import vi_VN from '@douyinfe/semi-ui/locale/source/vi_VN';
import ru_RU from '@douyinfe/semi-ui/locale/source/ru_RU';
import id_ID from '@douyinfe/semi-ui/locale/source/id_ID';
import ms_MY from '@douyinfe/semi-ui/locale/source/ms_MY';
import th_TH from '@douyinfe/semi-ui/locale/source/th_TH';
import tr_TR from '@douyinfe/semi-ui/locale/source/tr_TR';
import pt_BR from '@douyinfe/semi-ui/locale/source/pt_BR';

const { Option } = Select;

export default {
  title: 'Calendar',
}

const time = new Date();
let id = 0;
const language = {
  zh_CN: zh_CN,
  en_GB: en_GB,
  ko_KR: ko_KR,
  ja_JP: ja_JP,
  ar: ar,
  vi_VN: vi_VN,
  ru_RU: ru_RU,
  id_ID: id_ID,
  ms_MY: ms_MY,
  th_TH: th_TH,
  tr_TR: tr_TR,
  pt_BR: pt_BR,
};

const events = [
  {
    allDay: true,
    children: <div style={{ backgroundColor: 'blue', height: '100%' }}>today-allDay</div>,
  },
  {
    start: time,
    children: <div style={{ backgroundColor: 'indigo', height: '100px' }}>today-now</div>,
  },
  {
    allDay: true,
    children: <div style={{ backgroundColor: 'green', height: '100%' }}>today-allDay2</div>,
  },
  {
    allDay: true,
    children: <div style={{ backgroundColor: 'blue', height: '100%' }}>today-allDay3</div>,
  },
  {
    allDay: true,
    children: <div style={{ backgroundColor: 'green', height: '100%' }}>today-allDay4</div>,
  },
];

const weeklyEvents = [
  {
    allDay: true,
    start: new Date(2019, 6, 15, 8, 0, 0),
    children: <div style={{ backgroundColor: 'blue', height: '100%' }}>7-15-AllDayA</div>,
  },
  {
    start: new Date(2019, 6, 16, 8, 32, 0),
    children: (
      <div style={{ backgroundColor: 'indigo', height: '100%' }}>
        7-16 8:32 here is a very long content just to see if the content will collapse or not not
        sure if this is long enough aaaaaaaaaaa
      </div>
    ),
  },
  {
    start: new Date(2019, 6, 16, 14, 30, 0),
    end: new Date(2019, 6, 16, 20, 0, 0),
    children: <div style={{ backgroundColor: 'indigo', height: '100%' }}>7-16 14:30-20:00</div>,
  },
  {
    start: new Date(2019, 6, 18, 14, 45, 0),
    end: new Date(2019, 6, 19, 6, 18, 0),
    children: (
      <div style={{ backgroundColor: 'indigo', height: '100%' }}>7-18 14:45 ~ 7-19 6:18</div>
    ),
  },
];
// const events = [];
const date = new Date(2019, 6, 18, 8, 0, 0);

const dailyEventStyle = {
  borderRadius: '3px',
  boxSizing: 'border-box',
  border: 'var(--semi-color-primary) 1px solid',
  padding: '10px',
  backgroundColor: 'var(--semi-color-primary-light-default)',
  height: '100%',
  overflow: 'hidden',
};
const allDayStyle = {
  borderRadius: '3px',
  boxSizing: 'border-box',
  border: 'var(--semi-color-bg-1) 1px solid',
  marginRight: '12px',
  padding: '2px 4px',
  backgroundColor: 'var(--semi-color-primary-light-active)',
  height: '100%',
  overflow: 'hidden',
};

const weeklyEvents2 = [
  {
    allDay: true,
    start: new Date(2019, 6, 22, 8, 0, 0),
    children: <div style={{ backgroundColor: 'blue', height: '100%' }}>7-22-allDay</div>,
  },
  {
    start: new Date(2019, 6, 23, 8, 32, 0),
    children: <div style={{ backgroundColor: 'indigo', height: '100%' }}>7-23 8:32</div>,
  },
  {
    start: new Date(2019, 6, 23, 14, 30, 0),
    end: new Date(2019, 6, 23, 20, 0, 0),
    children: <div style={{ backgroundColor: 'indigo', height: '100%' }}>7-23 14:30-20:00</div>,
  },
  {
    start: new Date(2019, 6, 25, 14, 45, 0),
    end: new Date(2019, 6, 26, 6, 18, 0),
    children: (
      <div style={{ backgroundColor: 'indigo', height: '100%' }}>7-25 14:45 ~ 7-26 6:18</div>
    ),
  },
  {
    start: new Date(2019, 6, 25, 8, 0, 0),
    end: new Date(2019, 6, 27, 6, 0, 0),
    children: (
      <div style={{ backgroundColor: 'indigo', height: '100%' }}>7-25 8:00 ~ 7-27 6:00</div>
    ),
  },
  {
    start: new Date(2019, 6, 22, 9, 0, 0),
    end: new Date(2019, 6, 23, 23, 0, 0),
    children: (
      <div style={{ backgroundColor: 'LightSkyBlue', height: '100%' }}>7-22 9:00 ~ 7-23 23:00</div>
    ),
  },
  {
    start: new Date(2019, 6, 21, 6, 0, 0),
    end: new Date(2019, 6, 25, 6, 0, 0),
    children: (
      <div style={{ backgroundColor: 'YellowGreen', height: '100%' }}>7-21 6:00 ~ 7-25 6:00</div>
    ),
  },
  {
    start: new Date(2019, 6, 19, 20, 0, 0),
    end: new Date(2019, 6, 23, 14, 0, 0),
    children: (
      <div style={{ backgroundColor: 'pink', height: '100%' }}>7-19 20:00 ~ 7-23 14:00</div>
    ),
  },
  {
    start: new Date(2019, 6, 26, 10, 0, 0),
    end: new Date(2019, 6, 27, 16, 0, 0),
    children: <div style={{ backgroundColor: 'red', height: '100%' }}>7-26 10:00 ~ 7-27 16:00</div>,
  },
  {
    start: new Date(2019, 6, 18, 10, 0, 0),
    end: new Date(2019, 6, 30, 8, 0, 0),
    children: (
      <div style={{ backgroundColor: 'green', height: '100%' }}>7-18 10:00 ~ 7-30 8:00</div>
    ),
  },
];

export const DayCalendar = () => {
  return (
    <div>
      <Calendar
        mode="day"
        events={events}
        // displayValue={new Date(2019, 6, 16, 8, 0, 0)}
      ></Calendar>
    </div>
  );
};

DayCalendar.parameters = {
  chromatic: { disableSnapshot: true },
}

export const WeekCalendar = () => {
  return (
    <div>
      <Calendar displayValue={date} events={weeklyEvents}></Calendar>
    </div>
  );
};

export const ThisWeekCalendar = () => {
  return (
    <div>
      <Calendar events={weeklyEvents2} displayValue={new Date(2019, 6, 22, 8, 0, 0)}></Calendar>
    </div>
  );
};

export const MonthCalendar = () => {
  return <Calendar events={[...weeklyEvents2, ...weeklyEvents]} mode="month"></Calendar>;
};

MonthCalendar.parameters = {
  chromatic: { disableSnapshot: true },
}

const AddEventToCalendar = () => {
  const [event, setEvent] = useState([]);
  const [mode, setMode] = useState('day');

  const addEvent = () => {
    let newEvent = {
      allDay: true,
      start: new Date(),
      key: `${id}`,
      children: <div style={allDayStyle}>today-{id}</div>,
    };
    id++;
    setEvent([...event, newEvent]);
  };

  const removeEvent = () => {
    let newEvents = [...event];
    newEvents.pop();
    setEvent([...newEvents]);
  };
  return (
    <>
      <Button onClick={addEvent}>add</Button>
      <Button onClick={removeEvent}>remove</Button>
      <RadioGroup onChange={e => setMode(e.target.value)} value={mode}>
        <Radio value={'day'}>日视图</Radio>
        <Radio value={'week'}>周视图</Radio>
        <Radio value={'month'}>月视图</Radio>
      </RadioGroup>
      <Calendar events={event} mode={mode} />
    </>
  );
};

export const UpdateEvent = () => {
  const [event, setEvent] = useState([]);
  const [mode, setMode] = useState('day');
  const [updateId, setId] = useState(id);

  const addEvent = () => {
    let key = `${id}`;
    let newEvent = {
      allDay: true,
      start: new Date(),
      key,
      children: (
        <div
          style={allDayStyle}
          onClick={() => {
            console.log(key);
            setId(key);
          }}
        >
          today-{key}
        </div>
      ),
    };
    id++;
    setEvent([...event, newEvent]);
  };

  const updateEvent = () => {
    let ind = event.findIndex(item => {
      return item.key === updateId;
    });
    let newArr = [...event];
    newArr[ind].key = `${Math.random()}`;
    newArr[ind].children = <div style={allDayStyle}>today-{Math.random(0, 1)}</div>;
    setEvent(newArr);
  };

  return (
    <>
      <Button onClick={addEvent}>add</Button>
      <Button onClick={updateEvent}>update</Button>
      <RadioGroup onChange={e => setMode(e.target.value)} value={mode}>
        <Radio value={'day'}>日视图</Radio>
        <Radio value={'week'}>周视图</Radio>
        <Radio value={'month'}>月视图</Radio>
      </RadioGroup>
      <Calendar events={event} mode={mode} />
    </>
  );
};

UpdateEvent.parameters = {
  chromatic: { disableSnapshot: true },
}

export const DateGridRenderWeek = () => {
  return (
    <div>
      <Calendar
        displayValue={date}
        events={weeklyEvents}
        dateGridRender={(dateString, date) => {
          if (dateString === new Date(2019, 6, 16).toString()) {
            return (
              <div style={{ backgroundColor: 'red', height: '100%', width: '100%' }}>123test</div>
            );
          }
          return null;
        }}
      ></Calendar>
    </div>
  );
};

export const DateGridRenderMonth = () => {
  return (
    <div>
      <Calendar
        mode="month"
        displayValue={date}
        events={weeklyEvents}
        dateGridRender={(dateString, date) => {
          console.log(dateString);
          if (dateString === new Date(2019, 6, 16).toString()) {
            return (
              <div style={{ backgroundColor: 'red', height: '100%', width: '100%' }}>123test</div>
            );
          }
          return null;
        }}
      ></Calendar>
    </div>
  );
};

export const RangeCalenderMonth = () => {
  return (
    <div>
      <Calendar
        mode={'range'}
        range={[new Date(2019, 6, 22), new Date(2019, 6, 25)]}
        events={weeklyEvents2}
        displayValue={new Date(2019, 6, 22)}
      />
    </div>
  );
};

export const WithLocaleProvider = () => {
  const [locale, setLocale] = useState(zh_CN);
  const onLanguageChange = code => {
    setLocale(language[code]);
  };

  return (
    <LocaleProvider>
      <div style={{ borderBottom: '1px solid var(--semi-color-border)', paddingBottom: 20 }}>
        <Select
          onChange={onLanguageChange}
          insetLabel="切换语言"
          style={{ width: 250 }}
          defaultValue="zh_CN"
        >
          <Option value="zh_CN">中文</Option>
          <Option value="en_GB">英语（英）</Option>
          <Option value="ja_JP">日语</Option>
          <Option value="ko_KR">韩语</Option>
          <Option value="ar">阿拉伯语</Option>
          <Option value="vi_VN">越南语</Option>
          <Option value="ru_RU">俄罗斯语</Option>
          <Option value="id_ID">印尼语</Option>
          <Option value="ms_MY">马来语</Option>
          <Option value="th_TH">泰语</Option>
          <Option value="tr_TR">土耳其语</Option>
          <Option value="pt_BR">葡萄牙语（巴西）</Option>
        </Select>
      </div>
      <LocaleProvider locale={locale}>
        <Calendar mode="day" />
        <br />
        <Calendar mode="week" />
        <br />
        <Calendar mode="month" />
        <br />
      </LocaleProvider>
    </LocaleProvider>
  );
};

WithLocaleProvider.parameters = {
  chromatic: { disableSnapshot: true }
}

class EventRenderDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            mode: 'week',
            clickDate: '?'
        };
    }

    onSelect(e) {
        this.setState({
            mode: e.target.value,
        });
    }
    render() {
        const { mode } = this.state;
        const isMonthView = mode === 'month';
        const dailyEventStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--semi-color-primary) 1px solid',
            padding: '10px',
            backgroundColor: 'var(--semi-color-primary-light-default)',
            height: '100%',
            overflow: 'hidden',
        };
        const allDayStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--semi-color-bg-1) 1px solid',
            padding: '2px 4px',
            backgroundColor: 'var(--semi-color-primary-light-active)',
            height: '100%',
            overflow: 'hidden',
        };
        const dailyStyle = isMonthView ? allDayStyle : dailyEventStyle;
        const events = [
            {
                key: '0',
                start: new Date(2019, 5, 25, 14, 45, 0),
                end: new Date(2019, 6, 26, 6, 18, 0),
                children: <div style={dailyStyle}>6月25日 14:45 ~ 7月26日 6:18</div>,
            },
            {
                key: '1',
                start: new Date(2019, 6, 18, 10, 0, 0),
                end: new Date(2019, 6, 30, 8, 0, 0),
                children: <div style={allDayStyle}>7月18日 10:00 ~ 7月30日 8:00</div>,
            },
            {
                key: '2',
                start: new Date(2019, 6, 19, 20, 0, 0),
                end: new Date(2019, 6, 23, 14, 0, 0),
                children: <div style={allDayStyle}>7月19日 20:00 ~ 7月23日 14:00</div>,
            },
            {
                key: '3',
                start: new Date(2019, 6, 21, 6, 0, 0),
                end: new Date(2019, 6, 25, 6, 0, 0),
                children: <div style={allDayStyle}>7月21日 6:00 ~ 7月25日 6:00</div>,
            },
            {
                key: '4',
                allDay: true,
                start: new Date(2019, 6, 22, 8, 0, 0),
                children: <div style={allDayStyle}>7月22日 全天</div>,
            },
            {
                key: '5',
                start: new Date(2019, 6, 22, 9, 0, 0),
                end: new Date(2019, 6, 23, 23, 0, 0),
                children: <div style={allDayStyle}>7月22日 9:00 ~ 7月23日 23:00</div>,
            },
            {
                key: '6',
                start: new Date(2019, 6, 23, 8, 32, 0),
                children: <div style={dailyStyle}>7月23日 8:32</div>,
            },
            {
                key: '7',
                start: new Date(2019, 6, 23, 14, 30, 0),
                end: new Date(2019, 6, 23, 20, 0, 0),
                children: <div style={dailyStyle}>7月23日 14:30-20:00</div>,
            },
            {
                key: '8',
                start: new Date(2019, 6, 25, 8, 0, 0),
                end: new Date(2019, 6, 27, 6, 0, 0),
                children: <div style={allDayStyle}>7月25日 8:00 ~ 7月27日 6:00</div>,
            },
            {
                key: '9',
                start: new Date(2019, 6, 26, 10, 0, 0),
                end: new Date(2019, 6, 27, 16, 0, 0),
                children: <div style={allDayStyle}>7月26日 10:00 ~ 7月27日 16:00</div>,
            },
        ];
        const displayValue = new Date(2019, 6, 23, 8, 32, 0);
        return (
            <>
                <RadioGroup onChange={e => this.onSelect(e)} value={mode}>
                    <Radio value={'day'}>日视图</Radio>
                    <Radio value={'week'}>周视图</Radio>
                    <Radio value={'month'}>月视图</Radio>
                    <Radio value={'range'}>多日视图</Radio>
                </RadioGroup>
                <br />
                <br />
                <Calendar
                    height={400}
                    mode={mode}
                    displayValue={displayValue}
                    events={events}
                    onClick={(e, date) => { this.setState({clickDate: date.getDate()}); console.log(date.getDate())}}
                    range={mode === 'range' ? [new Date(2019, 6, 23), new Date(2019, 6, 26)] : []}
                ></Calendar>
                <div>当前点击的日期是{this.state.clickDate}号</div>
            </>
        );
    }
}

export const EventRender  = () => <EventRenderDemo />;


export const WeekStartsOnDemo = () => {
    const [v, setV] = useState(6);
    const allDayStyle = {
      borderRadius: '3px',
      boxSizing: 'border-box',
      border: 'var(--semi-color-bg-1) 1px solid',
      padding: '2px 4px',
      backgroundColor: 'var(--semi-color-primary-light-active)',
      height: '100%',
      overflow: 'hidden',
    };
    const events = [
      {
        key: '0',
        start: new Date(2022, 8, 5, 14, 45, 0),
        end: new Date(2022, 8, 6, 6, 18, 0),
        children: <div style={allDayStyle}>9月5日 14:45 ~ 9月6日 6:18</div>,
      }
    ]
    return (
        <div>
            <RadioGroup defaultValue={v} aria-label="周起始日" name="demo-radio-group-vertical" onChange={e => setV(e.target.value)}>
                <Radio value={1}>周一</Radio>
                <Radio value={2}>周二</Radio>
                <Radio value={3}>周三</Radio>
                <Radio value={4}>周四</Radio>
                <Radio value={5}>周五</Radio>
                <Radio value={6}>周六</Radio>
                <Radio value={0}>周日</Radio>
            </RadioGroup>
            <Calendar
                mode="month"
                weekStartsOn={1}
                events={events}
                displayValue={new Date(2022, 8, 5, 14, 45, 0)} 
            ></Calendar>
      </div>
    )
}

export const MonthEventRender = () => {
  const allDayStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--semi-color-bg-1) 1px solid',
            padding: '2px 4px',
            backgroundColor: 'var(--semi-color-primary-light-active)',
            height: '100%',
            overflow: 'hidden',
        };
        const events = [
            {
                key: '0',
                start: new Date(2019, 5, 25, 14, 45, 0),
                children: <div className="eventDay" style={allDayStyle}>6月25日 14:45</div>,
            },
            {
                key: '1',
                start: new Date(2019, 6, 18, 10, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月18日 10:00</div>,
            },
            {
                key: '2',
                start: new Date(2019, 6, 19, 20, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月19日 20:00</div>,
            },
            {
                key: '3',
                start: new Date(2019, 6, 21, 6, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月21日 6:00</div>,
            },
            {
                key: '4',
                allDay: true,
                start: new Date(2019, 6, 22, 8, 0, 0),
                children: <div className="eventDay" style={allDayStyle}>7月22日 全天</div>,
            },
            {
                key: '5',
                start: new Date(2019, 6, 23, 9, 0, 0),
                allDay: true,
                children: <div className="eventDay" >7月23日 全天</div>,
            },
            {
                key: '6',
                start: new Date(2019, 6, 24, 8, 32, 0),
                children: <div className="eventDay" style={allDayStyle}>7月24日 8:32</div>,
            },
            {
                key: '7',
                start: new Date(2019, 6, 25, 8, 32, 0),
                end: new Date(2019, 6, 26, 8, 32, 0),
                children: <div className="eventDay" style={allDayStyle}>7月25日 8:32 - 7月26日 8:32</div>,
            }

        ];
        return (
            <Calendar
              height={400}
              mode={'month'}
              displayValue={new Date(2019, 6, 23, 8, 32, 0)}
              events={events}
            ></Calendar>
        )
}

export const Fix1892 = () => {
    const [events, setEvents] = React.useState([]);
        const allDayStyle = {
            borderRadius: '3px',
            boxSizing: 'border-box',
            border: 'var(--semi-color-bg-1) 1px solid',
            padding: '2px 4px',
            backgroundColor: 'var(--semi-color-primary-light-active)',
            height: '100%',
            overflow: 'hidden',
        };
        const dailyStyle = allDayStyle;
        const events1 = [
            {
                key: '0',
                start: new Date(2019, 5, 25, 14, 45, 0),
                end: new Date(2019, 6, 26, 6, 18, 0),
                children: <div style={dailyStyle}>6月25日 14:45 ~ 7月26日 6:18</div>,
            },
            {
                key: '1',
                start: new Date(2019, 6, 18, 10, 0, 0),
                end: new Date(2019, 6, 30, 8, 0, 0),
                children: <div style={allDayStyle}>7月18日 10:00 ~ 7月30日 8:00</div>,
            },
            {
                key: '2',
                start: new Date(2019, 6, 19, 20, 0, 0),
                end: new Date(2019, 6, 23, 14, 0, 0),
                children: <div style={allDayStyle}>7月19日 20:00 ~ 7月23日 14:00</div>,
            },
            {
                key: '3',
                start: new Date(2019, 6, 21, 6, 0, 0),
                end: new Date(2019, 6, 25, 6, 0, 0),
                children: <div style={allDayStyle}>7月21日 6:00 ~ 7月25日 6:00</div>,
            },
            {
                key: '4',
                allDay: true,
                start: new Date(2019, 6, 22, 8, 0, 0),
                children: <div style={allDayStyle}>7月22日 全天</div>,
            },
            {
                key: '5',
                start: new Date(2019, 6, 22, 9, 0, 0),
                end: new Date(2019, 6, 23, 23, 0, 0),
                children: <div style={allDayStyle}>7月22日 9:00 ~ 7月23日 23:00</div>,
            },
            {
                key: '6',
                start: new Date(2019, 6, 23, 8, 32, 0),
                children: <div style={dailyStyle}>7月23日 8:32</div>,
            },
            {
                key: '7',
                start: new Date(2019, 6, 23, 14, 30, 0),
                end: new Date(2019, 6, 23, 20, 0, 0),
                children: <div style={dailyStyle}>7月23日 14:30-20:00</div>,
            },
            {
                key: '8',
                start: new Date(2019, 6, 25, 8, 0, 0),
                end: new Date(2019, 6, 27, 6, 0, 0),
                children: <div style={allDayStyle}>7月25日 8:00 ~ 7月27日 6:00</div>,
            },
            {
                key: '9',
                start: new Date(2019, 6, 26, 10, 0, 0),
                end: new Date(2019, 6, 27, 16, 0, 0),
                children: <div style={allDayStyle}>7月26日 10:00 ~ 7月27日 16:00</div>,
            },
        ];
        return (
            <>
                <Calendar
                    height={305}
                    mode={'month'}
                    displayValue={new Date(2019, 6, 23, 8, 32, 0)}
                    events={events}
                ></Calendar>
                <Button onClick={()=> setEvents(events1)}>change events</Button>
            </>
        );
    }
// When event start and end are very close, the event dom structure exists and has a minimum height
export const DayEventMinHeight = () => {

  const [mode, setMode] = useState('day');

  const dailyEventStyle = {
    borderRadius: '3px',
    boxSizing: 'border-box',
    border: 'var(--semi-color-primary) 1px solid',
    padding: '10px',
    backgroundColor: 'var(--semi-color-primary-light-default)',
    height: '100%',
    overflow: 'hidden',
  };  

  const events = [
    {
      key: '1',
      start: new Date(2019, 6, 23, 8, 22, 0),
      end: new Date(2019, 6, 23, 8, 23, 0),
      children: <div style={dailyEventStyle}>7月23日 8:32</div>,
    },
    {
      key: '2',
      start: new Date(2019, 6, 23, 8, 50, 0),
      end: new Date(2019, 6, 23, 9, 30, 0),
      children: <div style={dailyEventStyle}>7月23日 8:50</div>,
    },
    {
      key: '3',
      start: new Date(2019, 6, 23, 9, 50, 0),
      end: new Date(2019, 6, 23, 11, 30, 0),
      children: <div style={dailyEventStyle}>7月23日 9:50</div>,
    },
  ];

  const displayValue = new Date(2019, 6, 23, 8, 32, 0);

  return (
    <>
      <RadioGroup onChange={e => {setMode(e.target.value)}} value={mode}>
        <Radio value={'day'}>日视图</Radio>
        <Radio value={'week'}>周视图</Radio>
        <Radio value={'range'}>多日视图</Radio>
      </RadioGroup>
      <br />
      <br />
      <Calendar
        height={400}
        mode={mode}
        displayValue={displayValue}
        events={events}
        minEventHeight={50}
        range={mode === 'range' ? [new Date(2019, 6, 23), new Date(2019, 6, 26)] : []}></Calendar>
    </>
  )
} 


export const TestDemo = () => {

  const [mode, setMode] = useState('day');

  const dailyEventStyle = {
    borderRadius: '3px',
    boxSizing: 'border-box',
    border: 'var(--semi-color-primary) 1px solid',
    padding: '10px',
    backgroundColor: 'var(--semi-color-primary-light-default)',
    height: '100%',
    overflow: 'hidden',
  };  

  const events = [
    {
      key: '1',
      start: new Date(2019, 6, 23, 8, 22, 0),
      end: new Date(2019, 6, 23, 8, 23, 0),
      children: <div style={dailyEventStyle}>7月23日 8:32</div>,
    },
    {
      key: '2',
      start: new Date(2019, 6, 23, 8, 22, 0),
      end: new Date(2019, 6, 23, 8, 23, 0),
      children: <div style={dailyEventStyle}>7月23日 8:32 重复</div>,
    },
    {
      key: '3',
      start: new Date(2019, 6, 23, 8, 22, 0),
      end: new Date(2019, 6, 23, 8, 23, 0),
      children: <div style={dailyEventStyle}>7月23日 8:32 重复</div>,
    },
    {
      key: '4',
      start: new Date(2019, 6, 23, 8, 22, 0),
      end: new Date(2019, 6, 23, 8, 23, 0),
      children: <div style={dailyEventStyle}>7月23日 8:32 重复</div>,
    },
    {
      key: '5',
      start: new Date(2019, 6, 23, 8, 55, 0),
      end: new Date(2019, 6, 23, 9, 30, 0),
      children: <div style={dailyEventStyle}>7月23日 8:50</div>,
    },
    {
      key: '6',
      start: new Date(2019, 6, 23, 10, 55, 0),
      end: new Date(2019, 6, 23, 11, 30, 0),
      children: <div style={dailyEventStyle}>7月23日 10:55</div>,
    },
     {
      key: '7',
      start: new Date(2019, 6, 23, 10, 55, 0),
      end: new Date(2019, 6, 23, 11, 30, 0),
      children: <div style={dailyEventStyle}>7月23日 10:55</div>,
    },
  ];

  const displayValue = new Date(2019, 6, 23, 8, 32, 0);

  return (
    <>
      <RadioGroup onChange={e => {setMode(e.target.value)}} value={mode}>
        <Radio value={'day'}>日视图</Radio>
        <Radio value={'week'}>周视图</Radio>
        <Radio value={'range'}>多日视图</Radio>
      </RadioGroup>
      <br />
      <br />
      <Calendar
        height={400}
        mode={mode}
        displayValue={displayValue}
        events={events}
        minEventHeight={50}
        range={mode === 'range' ? [new Date(2019, 6, 23), new Date(2019, 6, 26)] : []}></Calendar>
    </>
  )
} 