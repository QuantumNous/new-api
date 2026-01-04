import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { storiesOf } from '@storybook/react';
import { addDays, addWeeks, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import classNames from 'classnames';
import * as dateFns from 'date-fns';

import DatePicker, { DatePickerProps } from '../index';
import { DayStatusType } from '../index';
import { Button, Form, withField } from '../../index';
import {IconClose, IconChevronDown} from '@douyinfe/semi-icons';

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
      text: 'Next Week',
      start: addWeeks(new Date(), 1),
      end: addWeeks(new Date(), 2),
    },
    {
      text: 'Next Month',
      start: startOfMonth(addMonths(new Date(), 1)),
      end: endOfMonth(addMonths(new Date(), 1)),
    },
  ];

const stories = storiesOf('DatePicker', module);

stories.add('default', () => {
    const Demo = () => {
        const ref = useRef(null);
        useEffect(() => {
            console.log(ref.current);

            if (ref.current) {
                console.log('triggerElRef: ', ref.current.triggerElRef);
            }
        }, [ref.current]);

        return (
            <>
                <DatePicker ref={ref} style={{ display: 'inline-block' }} />
                <DatePicker
                    type='dateTime'
                    presets={presets.map(preset => ({
                        text: preset.text,
                        start: preset.start,
                    }))}
                    onPresetClick={(item, e) => {
                        const { start } = item;
                        console.log('preset click', item, e, start);
                    }}
                />
                <DatePicker
                    type="dateTime"
                    presets={[() => ({
                        start: new Date(),
                    })]}
                    onPresetClick={(item, e) => {
                        const { start } = item;
                        console.log('preset click', item, e, start);
                    }}
                />
            </>
        );
    };

    return <Demo />;
});

stories.add('useFullRender', () => {
  function Demo() {
    const renderFullDate = (dayNumber: number, fullDate: string, dayStatus: DayStatusType) => {
        const { isInRange, isHover, isSelected, isSelectedStart, isSelectedEnd } = dayStatus;
        const prefix = 'components-datepicker-demo';

        const dateCls = classNames({
            [`${prefix}-day-inrange`]: isInRange,
            [`${prefix}-day-hover`]: isHover,
            [`${prefix}-day-selected`]: isSelected,
            [`${prefix}-day-selected-start`]: isSelectedStart,
            [`${prefix}-day-selected-end`]: isSelectedEnd,
        });

        const dayStyle = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80%',
            height: '80%',
            borderRadius: '50%',
        };

        return (
            <div style={dayStyle} className={dateCls}>
                {dayNumber}
            </div>
        );
    };

    return <DatePicker style={{ width: 240 }} type={'dateRange'} renderFullDate={renderFullDate} />;
  }

  return <Demo />;
});

stories.add('triggerRender', () => {
  function Demo() {
    const ref = useRef();
    const [date, setDate] = useState(new Date());
    const formatToken = 'yyyy-MM-dd';
    const onChange = useCallback(date => {
        setDate(date);
    }, []);
    const onClear = useCallback(e => {
        e && e.stopPropagation();
        setDate(null);
    }, []);

    const closeIcon = useMemo(() => {
        return date ? <IconClose onClick={onClear} /> : <IconChevronDown />;
    }, [date]);

    return (
        <DatePicker
            ref={ref}
            onChange={onChange}
            value={date}
            format={formatToken}
            triggerRender={({ placeholder }) => (
                <Button theme={'light'} icon={closeIcon} iconPosition={'right'}>
                    {(date && dateFns.format(date, formatToken)) || placeholder}
                </Button>
            )}
        />
    );
}

  return <Demo />;
});


stories.add('Form.DatePicker', () => {
  function Demo() {
    const ref = useRef();
    const ref2 = useRef();
    const [open3, setOpen3] = useState(false);
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
    // const CustomDatePicker = (props: DatePickerProps & { fieldRef: React.Ref<Object> }) => {
    //   const { fieldRef, ...rest } = props;
    //   return (
    //     <DatePicker {...rest} ref={fieldRef}  />
    //   );
    // };
    
    // const CustomFieldDatePicker = withField(CustomDatePicker);

    return (
      <>
        <DatePicker type="dateRange" ref={ref} />
        <Form>
        {/* <CustomFieldDatePicker
              type="dateTimeRange"
              field="a"
              label="Form.DatePicker"
              presets={presets}
              open={open3}
              onPresetClick={() => {
                console.log('click presets', ref2);
                setOpen3(false);
                setTimeout(() => {
                  ref2.current &&  (ref2.current as any).foundation.closePanel();
                }, 0);
              }}
              onFocus={() => {
                console.log('focus');
                setOpen3(true);
              }}
              onBlur={() => {console.log('blur')}}
              style={{ width: 500 }}
              fieldRef={ref2}
          /> */}
        </Form>
      </>
    );
}

  return <Demo />;
});

stories.add('fix 1460', () => <DatePicker type={'month'} onChange={(date, dateString) => console.log('DatePicker changed: ', date, dateString)} />);