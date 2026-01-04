import React from 'react';
import PropTypes from 'prop-types';
import YearAndMonthFoundation, { MonthScrollItem, YearAndMonthAdapter, YearAndMonthFoundationProps, YearAndMonthFoundationState, YearScrollItem } from '@douyinfe/semi-foundation/datePicker/yearAndMonthFoundation';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import ScrollList from '../scrollList/index';
import ScrollItem from '../scrollList/scrollItem';
import { getYearAndMonth, getYears } from '@douyinfe/semi-foundation/datePicker/_utils/index';

import IconButton from '../iconButton';
import { IconChevronLeft } from '@douyinfe/semi-icons';
import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';

import { noop, stubFalse, isEqual } from 'lodash';
import { setYear, setMonth, set } from 'date-fns';
import { Locale } from '../locale/interface';
import { strings } from '@douyinfe/semi-foundation/datePicker/constants';
import { PanelType } from '@douyinfe/semi-foundation/datePicker/monthsGridFoundation';


const prefixCls = `${BASE_CLASS_PREFIX}-datepicker`;

export interface YearAndMonthProps extends YearAndMonthFoundationProps, BaseProps {
    locale?: Locale['DatePicker']
}

export type YearAndMonthState = YearAndMonthFoundationState;

class YearAndMonth extends BaseComponent<YearAndMonthProps, YearAndMonthState> {
    static propTypes = {
        currentYear: PropTypes.object,
        currentMonth: PropTypes.object,
        onSelect: PropTypes.func,
        locale: PropTypes.object,
        localeCode: PropTypes.string,
        monthCycled: PropTypes.bool,
        yearCycled: PropTypes.bool,
        noBackBtn: PropTypes.bool,
        disabledDate: PropTypes.func,
        density: PropTypes.string,
        presetPosition: PropTypes.oneOf(strings.PRESET_POSITION_SET),
        renderQuickControls: PropTypes.node,
        renderDateInput: PropTypes.node,
        type: PropTypes.oneOf(strings.TYPE_SET),
        startYear: PropTypes.number,
        endYear: PropTypes.number,
    };

    static defaultProps = {
        disabledDate: stubFalse,
        monthCycled: false,
        yearCycled: false,
        noBackBtn: false,
        onSelect: noop,
        type: 'month',
    };
    foundation: YearAndMonthFoundation;
    yearRef: React.RefObject<ScrollItem<YearScrollItem>>;
    monthRef: React.RefObject<ScrollItem<MonthScrollItem>>;

    constructor(props: YearAndMonthProps) {
        super(props);
        const now = new Date();

        let { currentYear, currentMonth } = props;

        const { year, month } = getYearAndMonth(currentYear, currentMonth);

        this.state = {
            years: getYears(props.startYear, props.endYear).map(year => ({
                value: year,
                year,
            })),
            months: Array(12)
                .fill(0)
                .map((v, idx) => ({
                    value: idx + 1,
                    month: idx + 1,
                })),
            currentYear: year,
            currentMonth: month,
        };

        this.yearRef = React.createRef();
        this.monthRef = React.createRef();
        this.foundation = new YearAndMonthFoundation(this.adapter);
    }

    get adapter(): YearAndMonthAdapter {
        return {
            ...super.adapter,
            // updateYears: years => this.setState({ years }),
            // updateMonths: months => this.setState({ months }),
            setCurrentYear: (currentYear, cb) => this.setState({ currentYear }, cb),
            setCurrentMonth: currentMonth => this.setState({ currentMonth }),
            setCurrentYearAndMonth: (currentYear, currentMonth) => this.setState({ currentYear, currentMonth }),
            notifySelectYear: (year) =>
                this.props.onSelect({
                    currentMonth: this.state.currentMonth,
                    currentYear: year,
                }),
            notifySelectMonth: (month) =>
                this.props.onSelect({
                    currentYear: this.state.currentYear,
                    currentMonth: month,
                }),
            notifySelectYearAndMonth: (year, month) =>
                this.props.onSelect({
                    currentYear: year,
                    currentMonth: month,
                }),
            notifyBackToMain: () => this.props.onBackToMain(),
        };
    }

    static getDerivedStateFromProps(props: YearAndMonthProps, state: YearAndMonthState) {
        const willUpdateStates: Partial<YearAndMonthState> = {};
        const { year, month } = getYearAndMonth(props.currentYear, props.currentMonth);

        if (!isEqual(props.currentYear, state.currentYear)) {
            willUpdateStates.currentYear = year;
        }

        if (!isEqual(props.currentMonth, state.currentMonth)) {
            willUpdateStates.currentMonth = month;
        }

        return willUpdateStates;
    }

    renderColYear(panelType: PanelType) {
        const { years, currentYear, currentMonth, months } = this.state;
        const { disabledDate, localeCode, yearCycled, yearAndMonthOpts } = this.props;
        const currentDate = setMonth(Date.now(), currentMonth[panelType] - 1);
        const left = strings.PANEL_TYPE_LEFT;
        const right = strings.PANEL_TYPE_RIGHT;

        const needDisabled = (year) => {
            if (panelType === right && currentYear[left]) {
                return currentYear[left] > year;
            }
            return false;
        };

        const list: any[] = years.map(({ value, year }) => {
            const isAllMonthDisabled = months.every(({ month }) => {
                return disabledDate(set(currentDate, { year, month: month - 1 }));
            });
            const isRightPanelDisabled = needDisabled(year);
            return ({
                year,
                value, // Actual rendered text
                disabled: isAllMonthDisabled || isRightPanelDisabled,
            });
        });
        let transform = (val: string) => val;
        if (localeCode === 'zh-CN' || localeCode === 'zh-TW') {
            // Only Chinese needs to add [year] after the selected year
            transform = val => `${val}年`;
        }
        return (
            <ScrollItem
                ref={this.yearRef}
                cycled={yearCycled}
                list={list}
                transform={transform}
                selectedIndex={years.findIndex(item => item.value === currentYear[panelType])}
                type="year"
                onSelect={item => this.selectYear(item as YearScrollItem, panelType)}
                mode="normal"
                {...yearAndMonthOpts}
            />
        );
    }

    selectYear = (item: YearScrollItem, panelType?: PanelType) => {
        this.foundation.selectYear(item, panelType);
    };

    selectMonth = (item: MonthScrollItem, panelType?: PanelType) => {
        this.foundation.selectMonth(item, panelType);
    };

    reselect = () => {
        const refKeys = ['yearRef', 'monthRef'];

        refKeys.forEach(key => {
            const ref = this[key];

            if (ref && ref.current && ref.current.scrollToIndex) {
                ref.current.scrollToIndex();
            }
        });
    };

    renderColMonth(panelType: PanelType) {
        const { months, currentMonth, currentYear } = this.state;
        const { locale, localeCode, monthCycled, disabledDate, yearAndMonthOpts } = this.props;
        let transform = (val: string) => val;
        const currentDate = setYear(Date.now(), currentYear[panelType]);
        const left = strings.PANEL_TYPE_LEFT;
        const right = strings.PANEL_TYPE_RIGHT;

        if (localeCode === 'zh-CN' || localeCode === 'zh-TW') {
            // Only Chinese needs to add [month] after the selected month
            transform = val => `${val}月`;
        }
        // i18n
        const list: MonthScrollItem[] = months.map(({ value, month }) => {
            const isRightPanelDisabled = panelType === right && currentMonth[left] && currentYear[left] === currentYear[right] && currentMonth[left] > month;

            return ({
                month,
                disabled: disabledDate(setMonth(currentDate, month - 1)) || isRightPanelDisabled,
                value: locale.fullMonths[value], // Actual rendered text
            });
        });
        const selectedIndex = list.findIndex(item => item.month === currentMonth[panelType]);
        return (
            <ScrollItem
                ref={this.monthRef}
                cycled={monthCycled}
                list={list}
                transform={transform}
                selectedIndex={selectedIndex}
                type="month"
                onSelect={item => this.selectMonth(item as MonthScrollItem, panelType)}
                mode='normal'
                {...yearAndMonthOpts}
            />
        );
    }

    backToMain: React.MouseEventHandler<HTMLButtonElement> = e => {
        e.nativeEvent.stopImmediatePropagation();
        this.foundation.backToMain();
    };

    renderPanel(panelType: PanelType) {

        return (
            <>
                <ScrollList>
                    {this.renderColYear(panelType)}
                    {this.renderColMonth(panelType)}
                </ScrollList>
            </>
        );
    }

    render() {
        const { locale, noBackBtn, density, presetPosition, renderQuickControls, renderDateInput, type } = this.props;
        const prefix = `${prefixCls}-yearmonth-header`;
        const bodyCls = `${prefixCls}-yearmonth-body`;

        // i18n
        const selectDateText = locale.selectDate;
        const iconSize = density === 'compact' ? 'default' : 'large';
        const buttonSize = density === 'compact' ? 'small' : 'default';
        const panelTypeLeft = strings.PANEL_TYPE_LEFT;
        const panelTypeRight = strings.PANEL_TYPE_RIGHT;

        let content = null;
        if (type === 'month') {
            content = this.renderPanel(panelTypeLeft);
        } else {
            content = (
                <div className={bodyCls}>
                    {this.renderPanel(panelTypeLeft)}
                    {this.renderPanel(panelTypeRight)}
                </div>
            );
        }

        return (
            <React.Fragment>
                {noBackBtn ? null : (
                    <div className={prefix}>
                        <IconButton
                            noHorizontalPadding={false}
                            icon={<IconChevronLeft aria-hidden size={iconSize} />}
                            size={buttonSize}
                            onClick={this.backToMain}
                        >
                            <span>{selectDateText}</span>
                        </IconButton>
                    </div>
                )}
                {
                    presetPosition ? (
                        <div style={{ display: 'flex' }}>
                            {/* todo: monthRange does not support presetPosition temporarily */}
                            {presetPosition === "left" && type !== 'monthRange' && renderQuickControls}
                            <div>
                                {renderDateInput}
                                {content}
                            </div>
                            {/* todo: monthRange does not support presetPosition temporarily */}
                            {presetPosition === "right" && type !== 'monthRange' && renderQuickControls}
                        </div>
                    ) :
                        <>
                            {renderDateInput}
                            {content}
                        </>
                }
            </React.Fragment>
        );
    }
}

export default YearAndMonth;
